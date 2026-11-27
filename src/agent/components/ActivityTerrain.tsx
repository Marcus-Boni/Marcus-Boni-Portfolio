import { motion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'

import type { GitHubActivityPayload } from '@/agent/github-activity'
import { useLanguage } from '@/i18n/LanguageContext'
import type { Locale } from '@/i18n/translations'
import { cn } from '@/lib/utils'

import { IconArrowUpRight, IconGitBranch } from './icons'

/**
 * Kokonut UI `CD-10` (Activity Terrain) ported to Signal & Ink and powered by
 * live GitHub contribution data from `GET /agent/v1/github`.
 *
 * Signature Kokonut interactions preserved:
 * - Contribution heatmap that tilts upward into a rotatable 3D isometric terrain.
 * - Spring-driven pitch (`Flat` ↔ `Terrain`), rubber-banded drag yaw/pitch with
 *   flick coast inertia, wave-out column rise (`easeOutBack`), and per-column
 *   hover bump springs.
 * - Full keyboard navigation (`ArrowLeft`/`Right`/`Up`/`Down`), live `aria-live`
 *   day readout, `prefers-reduced-motion` instant settle, and automatic theme
 *   repainting across Signal & Ink light/dark modes using CSS custom properties.
 */

const DAYS = 7
const GAP = 0.18
const MAX_HEIGHT = 4.2
const DEG = Math.PI / 180
const PITCH_TERRAIN = 56 * DEG
const YAW_TERRAIN = 18 * DEG
const YAW_LIMIT = 38 * DEG
const PITCH_LIMIT = 66 * DEG
const DRAG_YAW = 0.32 * DEG
const DRAG_PITCH = 0.36 * DEG
const SPIN_HALF_LIFE = 0.16
const SPIN_IN = (YAW_TERRAIN * Math.LN2) / SPIN_HALF_LIFE
const PITCH_STIFFNESS = 140
const PITCH_DAMPING = 2 * Math.sqrt(PITCH_STIFFNESS)
const EDGE_STIFFNESS = 180
const BUMP_STIFFNESS = 400
const BUMP_DAMPING = 2 * Math.sqrt(BUMP_STIFFNESS) * 0.7
const BUMP = 0.45
const WAVE = 0.7
const PADDING = 24
const REST_EPSILON = 0.0005
const EASE_OUT = [0.23, 1, 0.32, 1] as const

const DAY_LABELS: Record<Locale, readonly string[]> = {
  pt: ['Seg', '', 'Qua', '', 'Sex', '', ''],
  en: ['Mon', '', 'Wed', '', 'Fri', '', ''],
}

interface Cell {
  index: number
  col: number
  row: number
  count: number
  level: number
  height: number
  date: Date
}

interface Pose {
  yaw: number
  pitch: number
  scale: number
  cx: number
  cy: number
}

type Rgb = [number, number, number]

interface Palette {
  levels: Rgb[]
  accent: Rgb
  text: string
  font: string
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

function easeOutBack(t: number): number {
  const c = 1.4
  const u = t - 1
  return 1 + (c + 1) * u * u * u + c * u * u
}

function rubber(value: number, min: number, max: number): number {
  if (value < min) {
    return min - 0.18 * (1 - Math.exp((value - min) / 0.18))
  }
  if (value > max) {
    return max + 0.18 * (1 - Math.exp((max - value) / 0.18))
  }
  return value
}

function parseDay(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function buildCells(data: readonly number[], endDate: string): Cell[] {
  const end = parseDay(endDate)
  const start = new Date(end.getTime() - (data.length - 1) * 86_400_000)
  const offset = (start.getUTCDay() + 6) % 7
  const max = Math.max(1, ...data)
  return data.map((count, index): Cell => {
    const slot = index + offset
    const norm = count / max
    return {
      index,
      col: Math.floor(slot / DAYS),
      row: slot % DAYS,
      count,
      level: count === 0 ? 0 : Math.min(4, Math.ceil(norm * 4)),
      height: 0.06 + norm ** 0.85 * MAX_HEIGHT,
      date: new Date(start.getTime() + index * 86_400_000),
    }
  })
}

function parseCssColorToRgb(raw: string): Rgb {
  const trimmed = raw.trim()
  const rgbMatch = trimmed.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i)
  if (rgbMatch) {
    return [
      Math.round(Number(rgbMatch[1])),
      Math.round(Number(rgbMatch[2])),
      Math.round(Number(rgbMatch[3])),
    ]
  }
  const srgbMatch = trimmed.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i)
  if (srgbMatch) {
    return [
      Math.round(Number(srgbMatch[1]) * 255),
      Math.round(Number(srgbMatch[2]) * 255),
      Math.round(Number(srgbMatch[3]) * 255),
    ]
  }
  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1)
    const full = hex.length === 3 ? hex.replace(/./g, '$&$&') : hex
    const n = Number.parseInt(full, 16)
    if (Number.isFinite(n)) {
      return [Math.floor(n / 65_536) % 256, Math.floor(n / 256) % 256, n % 256]
    }
  }
  return [140, 130, 120]
}

function shade([r, g, b]: Rgb, amount: number): string {
  const k = 1 - amount
  return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`
}

/**
 * Resolves `light-dark(...)` CSS custom properties through a temporary child
 * probe's computed `color`, guaranteeing accurate RGB channels in every browser
 * across both Signal & Ink light and dark schemes.
 */
function readPalette(container: HTMLElement): Palette {
  const probe = document.createElement('span')
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  probe.style.pointerEvents = 'none'
  container.appendChild(probe)

  const resolve = (expr: string): string => {
    probe.style.color = expr
    return getComputedStyle(probe).color
  }

  try {
    const levels = [0, 1, 2, 3, 4].map((level) =>
      parseCssColorToRgb(resolve(`var(--terrain-${level})`)),
    )
    const accent = parseCssColorToRgb(resolve('var(--terrain-accent)'))
    const text = resolve('var(--color-smoke)')
    const font = getComputedStyle(container).fontFamily
    return { levels, accent, text, font }
  } finally {
    probe.remove()
  }
}

function project(pose: Pose, x: number, y: number, z: number): [number, number] {
  const cos = Math.cos(pose.yaw)
  const sin = Math.sin(pose.yaw)
  const xr = x * cos - z * sin
  const zr = x * sin + z * cos
  return [
    pose.cx + xr * pose.scale,
    pose.cy +
      (zr * Math.cos(pose.pitch) - y * Math.sin(pose.pitch)) * pose.scale,
  ]
}

function visibleFaces(
  pose: Pose,
  x0: number,
  z0: number,
  h: number,
): { points: [number, number][]; tone: number }[] {
  const x1 = x0 + 1 - GAP
  const z1 = z0 + 1 - GAP
  const p = (x: number, y: number, z: number) => project(pose, x, y, z)
  const faces: { points: [number, number][]; tone: number }[] = []
  const sin = Math.sin(pose.yaw)
  const cos = Math.cos(pose.yaw)

  if (h > 0.02 && pose.pitch > 0.01) {
    if (cos > 0) {
      faces.push({
        points: [p(x0, 0, z1), p(x1, 0, z1), p(x1, h, z1), p(x0, h, z1)],
        tone: 0.22,
      })
    } else {
      faces.push({
        points: [p(x0, 0, z0), p(x1, 0, z0), p(x1, h, z0), p(x0, h, z0)],
        tone: 0.22,
      })
    }
    if (sin > 0.001) {
      faces.push({
        points: [p(x1, 0, z0), p(x1, 0, z1), p(x1, h, z1), p(x1, h, z0)],
        tone: 0.38,
      })
    } else if (sin < -0.001) {
      faces.push({
        points: [p(x0, 0, z0), p(x0, 0, z1), p(x0, h, z1), p(x0, h, z0)],
        tone: 0.38,
      })
    }
  }

  faces.push({
    points: [p(x0, h, z0), p(x1, h, z0), p(x1, h, z1), p(x0, h, z1)],
    tone: 0,
  })
  return faces
}

function inside(points: [number, number][], x: number, y: number): boolean {
  let hit = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i]
    const [xj, yj] = points[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      hit = !hit
    }
  }
  return hit
}

function drawPolygon(ctx: CanvasRenderingContext2D, points: [number, number][]) {
  ctx.beginPath()
  ctx.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i][0], points[i][1])
  }
  ctx.closePath()
}

function formatDayLabel(date: Date, locale: Locale): string {
  return date.toLocaleDateString(locale === 'pt' ? 'pt-BR' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function formatMonthLabel(date: Date, locale: Locale): string {
  return date
    .toLocaleDateString(locale === 'pt' ? 'pt-BR' : 'en-US', {
      month: 'short',
      timeZone: 'UTC',
    })
    .replace('.', '')
}

export function ActivityTerrain({
  activity,
  defaultFlat = false,
  className,
}: {
  activity: GitHubActivityPayload
  defaultFlat?: boolean
  className?: string
}) {
  const { locale, t } = useLanguage()
  const calendar = activity.contributions

  const cells = useMemo(
    () => (calendar ? buildCells(calendar.days, calendar.endDate) : []),
    [calendar],
  )
  const weeks = (cells[cells.length - 1]?.col ?? 0) + 1
  const total = calendar?.windowTotal ?? 0

  const [flat, setFlat] = useState(defaultFlat)
  const [active, setActive] = useState<Cell | null>(null)
  const [dragging, setDragging] = useState(false)

  const rootRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const paletteRef = useRef<Palette | null>(null)
  const cellsRef = useRef(cells)

  const sim = useRef({
    yaw: 0,
    yawSpeed: 0,
    pitch: 0,
    pitchSpeed: 0,
    pitchTarget: defaultFlat ? 0 : PITCH_TERRAIN,
    bumps: new Float64Array(cells.length),
    bumpSpeeds: new Float64Array(cells.length),
    hovered: -1,
    origin: { col: 0, row: 3 },
    width: 0,
    height: 0,
    dpr: 1,
    drag: null as null | {
      id: number
      x: number
      y: number
      yaw: number
      pitch: number
      moved: boolean
      samples: { t: number; x: number; y: number }[]
    },
    raf: 0,
    last: 0,
    visible: false,
    started: false,
    reduceMotion: false,
  })

  useEffect(() => {
    cellsRef.current = cells
    if (sim.current.bumps.length !== cells.length) {
      sim.current.bumps = new Float64Array(cells.length)
      sim.current.bumpSpeeds = new Float64Array(cells.length)
    }
  }, [cells])

  const columnHeight = useCallback(
    (cell: Cell, lift: number) => {
      const s = sim.current
      const span = Math.hypot(weeks, DAYS) || 1
      const d =
        Math.hypot(cell.col - s.origin.col, cell.row - s.origin.row) / span
      const local = clamp(lift * (1 + WAVE) - d * WAVE, 0, 1)
      return cell.height * easeOutBack(local) + (s.bumps[cell.index] ?? 0)
    },
    [weeks],
  )

  const pose = useCallback((): Pose & { lift: number } => {
    const s = sim.current
    const lift = clamp(s.pitch / PITCH_TERRAIN, 0, 1.2)
    const w = weeks
    const corners: [number, number][] = [
      [0, 0],
      [w, 0],
      [0, DAYS],
      [w, DAYS],
    ]
    const probe: Pose = { yaw: s.yaw, pitch: s.pitch, scale: 1, cx: 0, cy: 0 }
    let minX = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY

    for (const [x, z] of corners) {
      for (const y of [0, MAX_HEIGHT * Math.min(lift, 1)]) {
        const [px, py] = project(probe, x - w / 2, y, z - DAYS / 2)
        minX = Math.min(minX, px)
        maxX = Math.max(maxX, px)
        minY = Math.min(minY, py)
        maxY = Math.max(maxY, py)
      }
    }

    const scale = Math.min(
      (s.width - PADDING * 2) / Math.max(1, maxX - minX),
      (s.height - PADDING * 2) / Math.max(1, maxY - minY),
    )

    return {
      yaw: s.yaw,
      pitch: s.pitch,
      scale,
      cx: s.width / 2 - ((minX + maxX) / 2) * scale,
      cy: s.height / 2 - ((minY + maxY) / 2) * scale + 5,
      lift,
    }
  }, [weeks])

  const ordered = useCallback(
    (p: Pose) => {
      const sin = Math.sin(p.yaw)
      const cos = Math.cos(p.yaw)
      const depth = (c: Cell) =>
        (c.col + 0.5 - weeks / 2) * sin + (c.row + 0.5 - DAYS / 2) * cos
      return [...cellsRef.current].sort((a, b) => depth(a) - depth(b))
    },
    [weeks],
  )

  const drawLabels = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      p: Pose,
      lift: number,
      palette: Palette,
    ) => {
      const alpha = clamp(1 - lift * 1.6, 0, 1)
      if (alpha === 0) return
      const list = cellsRef.current
      const dayLabels = DAY_LABELS[locale]

      ctx.globalAlpha = alpha
      ctx.fillStyle = palette.text
      ctx.font = `10px ${palette.font}`
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'

      let month = -1
      for (const cell of list) {
        if (cell.row !== 0 && cell.index !== 0) continue
        const m = cell.date.getUTCMonth()
        if (m !== month && cell.col < weeks - 1) {
          month = m
          const [x, y] = project(p, cell.col - weeks / 2, 0, -0.75 - DAYS / 2)
          ctx.fillText(formatMonthLabel(cell.date, locale), x, y)
        }
      }

      ctx.textAlign = 'right'
      for (let row = 0; row < DAYS; row += 1) {
        if (dayLabels[row]) {
          const [x, y] = project(p, -0.35 - weeks / 2, 0, row + 0.4 - DAYS / 2)
          ctx.fillText(dayLabels[row], x, y)
        }
      }
      ctx.globalAlpha = 1
    },
    [locale, weeks],
  )

  const draw = useCallback(() => {
    const s = sim.current
    const canvas = canvasRef.current
    const root = rootRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !root || !ctx || !s.width) return

    paletteRef.current ??= readPalette(root)
    const palette = paletteRef.current
    const p = pose()

    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0)
    ctx.clearRect(0, 0, s.width, s.height)
    drawLabels(ctx, p, p.lift, palette)
    ctx.lineJoin = 'round'

    for (const cell of ordered(p)) {
      const h = columnHeight(cell, p.lift)
      const color =
        cell.index === s.hovered ? palette.accent : palette.levels[cell.level]
      for (const face of visibleFaces(
        p,
        cell.col - weeks / 2,
        cell.row - DAYS / 2,
        h,
      )) {
        drawPolygon(ctx, face.points)
        const fill = shade(color, face.tone)
        ctx.fillStyle = fill
        ctx.fill()
        ctx.strokeStyle = fill
        ctx.lineWidth = 0.6
        ctx.stroke()
      }
    }
  }, [columnHeight, drawLabels, ordered, pose, weeks])

  const hitTest = useCallback(
    (x: number, y: number) => {
      const p = pose()
      const list = ordered(p)
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const cell = list[i]
        const h = columnHeight(cell, p.lift)
        for (const face of visibleFaces(
          p,
          cell.col - weeks / 2,
          cell.row - DAYS / 2,
          h,
        )) {
          if (inside(face.points, x, y)) return cell
        }
      }
      return null
    },
    [columnHeight, ordered, pose, weeks],
  )

  const stepSprings = useCallback((dt: number) => {
    const s = sim.current
    let energy = 0
    if (!s.drag) {
      s.yawSpeed *= 0.5 ** (dt / SPIN_HALF_LIFE)
      let target = s.yaw
      if (s.pitchTarget === 0) target = 0
      else if (s.yaw > YAW_LIMIT) target = YAW_LIMIT
      else if (s.yaw < -YAW_LIMIT) target = -YAW_LIMIT

      if (target !== s.yaw) {
        s.yawSpeed +=
          ((target - s.yaw) * EDGE_STIFFNESS -
            s.yawSpeed * 2 * Math.sqrt(EDGE_STIFFNESS)) *
          dt
      }
      s.yaw += s.yawSpeed * dt
      energy = Math.max(energy, Math.abs(s.yawSpeed), Math.abs(target - s.yaw))

      const force =
        (s.pitchTarget - s.pitch) * PITCH_STIFFNESS -
        s.pitchSpeed * PITCH_DAMPING
      s.pitchSpeed += force * dt
      s.pitch += s.pitchSpeed * dt
      energy = Math.max(
        energy,
        Math.abs(s.pitchSpeed),
        Math.abs(s.pitchTarget - s.pitch),
      )
    }

    for (let i = 0; i < s.bumps.length; i += 1) {
      const target = i === s.hovered && s.pitch > 0.1 ? BUMP : 0
      s.bumpSpeeds[i] +=
        ((target - s.bumps[i]) * BUMP_STIFFNESS -
          s.bumpSpeeds[i] * BUMP_DAMPING) *
        dt
      s.bumps[i] += s.bumpSpeeds[i] * dt
      energy = Math.max(
        energy,
        Math.abs(s.bumpSpeeds[i]) * 0.1,
        Math.abs(target - s.bumps[i]),
      )
    }
    return energy
  }, [])

  const tickRef = useRef<(now: number) => void>(() => {})

  useEffect(() => {
    tickRef.current = (now: number) => {
      const s = sim.current
      s.raf = 0
      const dt = s.last ? Math.min((now - s.last) / 1000, 1 / 30) : 1 / 60
      s.last = now
      const energy = stepSprings(dt)
      draw()
      if ((s.drag || energy > REST_EPSILON) && s.visible) {
        s.raf = requestAnimationFrame((ts) => tickRef.current(ts))
      } else {
        s.last = 0
      }
    }
  }, [draw, stepSprings])

  const turnIn = useCallback(() => {
    const s = sim.current
    if (Math.abs(s.yaw) > 2 * DEG) return
    if (s.reduceMotion) s.yaw = YAW_TERRAIN
    else s.yawSpeed = SPIN_IN
  }, [])

  const wake = useCallback(() => {
    const s = sim.current
    if (s.reduceMotion) {
      s.pitch = s.pitchTarget
      s.yaw = clamp(s.yaw, -YAW_LIMIT, YAW_LIMIT)
      s.pitchSpeed = 0
      s.yawSpeed = 0
      s.bumps.fill(0)
      draw()
      return
    }
    if (!s.raf && s.visible) {
      s.raf = requestAnimationFrame((ts) => tickRef.current(ts))
    }
  }, [draw])

  useEffect(() => {
    const s = sim.current
    const canvas = canvasRef.current
    if (!canvas) return

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    s.reduceMotion = reducedMotionQuery.matches

    const resize = new ResizeObserver(([entry]) => {
      s.width = entry.contentRect.width
      s.height = entry.contentRect.height
      s.dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(s.width * s.dpr)
      canvas.height = Math.round(s.height * s.dpr)
      draw()
    })
    resize.observe(canvas)

    let onScreen = false
    const update = () => {
      s.visible = onScreen && !document.hidden
      if (s.visible) {
        if (!s.started) {
          s.started = true
          if (s.pitchTarget > 0) turnIn()
        }
        wake()
      } else if (s.raf) {
        cancelAnimationFrame(s.raf)
        s.raf = 0
        s.last = 0
      }
    }
    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      update()
    })
    intersection.observe(canvas)
    document.addEventListener('visibilitychange', update)

    const repaint = () => {
      paletteRef.current = null
      draw()
    }
    const htmlObserver = new MutationObserver(repaint)
    htmlObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme'],
    })
    const colorSchemeMeta = document.querySelector('meta[name="color-scheme"]')
    const metaObserver = new MutationObserver(repaint)
    if (colorSchemeMeta) {
      metaObserver.observe(colorSchemeMeta, {
        attributes: true,
        attributeFilter: ['content'],
      })
    }
    const scheme = window.matchMedia('(prefers-color-scheme: dark)')
    scheme.addEventListener('change', repaint)

    return () => {
      resize.disconnect()
      intersection.disconnect()
      htmlObserver.disconnect()
      metaObserver.disconnect()
      scheme.removeEventListener('change', repaint)
      document.removeEventListener('visibilitychange', update)
      cancelAnimationFrame(s.raf)
      s.raf = 0
    }
  }, [draw, turnIn, wake])

  if (!calendar || cells.length === 0) return null

  const setView = (
    nextFlat: boolean,
    origin?: { col: number; row: number },
  ) => {
    const s = sim.current
    setFlat(nextFlat)
    s.origin = origin ?? { col: nextFlat ? weeks : 0, row: 3 }
    s.pitchTarget = nextFlat ? 0 : PITCH_TERRAIN
    s.yawSpeed = 0
    if (!nextFlat) turnIn()
    wake()
  }

  const localPoint = (event: PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    return rect
      ? { x: event.clientX - rect.left, y: event.clientY - rect.top }
      : { x: 0, y: 0 }
  }

  const hover = (cell: Cell | null) => {
    const s = sim.current
    const index = cell ? cell.index : -1
    if (index !== s.hovered) {
      s.hovered = index
      setActive(cell)
      if (s.reduceMotion) draw()
      else wake()
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const s = sim.current
    const { x, y } = localPoint(event)
    event.currentTarget.setPointerCapture(event.pointerId)
    const cell = hitTest(x, y)
    if (cell) s.origin = { col: cell.col, row: cell.row }
    s.drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      yaw: s.yaw,
      pitch: s.pitch,
      moved: false,
      samples: [{ t: event.timeStamp, x: event.clientX, y: event.clientY }],
    }
    s.yawSpeed = 0
    s.pitchSpeed = 0
    setDragging(true)
    hover(cell)
    wake()
  }

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const s = sim.current
    const drag = s.drag
    if (!drag || drag.id !== event.pointerId) {
      if (event.pointerType === 'mouse') {
        const { x, y } = localPoint(event)
        hover(hitTest(x, y))
      }
      return
    }
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    if (!drag.moved && Math.hypot(dx, dy) > 4) drag.moved = true
    if (!drag.moved) return
    s.yaw = rubber(drag.yaw + dx * DRAG_YAW, -YAW_LIMIT, YAW_LIMIT)
    s.pitch = rubber(drag.pitch + dy * DRAG_PITCH, 0, PITCH_LIMIT)
    drag.samples.push({ t: event.timeStamp, x: event.clientX, y: event.clientY })
    if (drag.samples.length > 5) drag.samples.shift()
    if (s.reduceMotion) draw()
    else wake()
  }

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const s = sim.current
    const drag = s.drag
    if (!drag || drag.id !== event.pointerId) return
    s.drag = null
    setDragging(false)
    if (!drag.moved) {
      wake()
      return
    }
    const first = drag.samples[0]
    const lastSample = drag.samples[drag.samples.length - 1] ?? first
    const dt = Math.max((lastSample.t - first.t) / 1000, 0.016)
    const vx = (lastSample.x - first.x) / dt
    const vy = (lastSample.y - first.y) / dt
    const recent = event.timeStamp - lastSample.t < 80
    s.yawSpeed = recent ? vx * DRAG_YAW : 0
    s.pitchSpeed = recent ? vy * DRAG_PITCH : 0
    const projected = s.pitch + s.pitchSpeed * 0.15
    const nextFlat = projected < PITCH_TERRAIN / 2
    setFlat(nextFlat)
    s.pitchTarget = nextFlat ? 0 : PITCH_TERRAIN
    wake()
  }

  const handlePointerLeave = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!sim.current.drag && event.pointerType === 'mouse') hover(null)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    const list = cellsRef.current
    const current = list[sim.current.hovered] ?? list[list.length - 1]
    if (!current) return
    const next = list.find(
      (c) => c.col === current.col + move[0] && c.row === current.row + move[1],
    )
    hover(next ?? current)
  }

  const readout = active
    ? t.agent.terrain.dayReadout(active.count, formatDayLabel(active.date, locale))
    : t.agent.terrain.windowSummary(total, weeks)

  const latestRelease = activity.releases[0]

  return (
    <motion.section
      ref={rootRef}
      initial={{ opacity: 0, y: 6, filter: 'blur(3px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.32, ease: EASE_OUT }}
      aria-label={t.agent.terrain.title}
      className={cn(
        'mt-4 select-none overflow-hidden rounded-2xl border border-line bg-ink-soft/60',
        className,
      )}
    >
      {/* Header: GitHub handle, live day readout & Flat/Terrain toggle */}
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 pb-1">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`https://github.com/${encodeURIComponent(activity.username)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium text-bone transition-colors hover:text-ember focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember"
            >
              <IconGitBranch className="size-3.5 text-ember" />
              <span>@{activity.username}</span>
              <IconArrowUpRight className="size-3 text-smoke" />
            </a>
            <span className="font-mono text-[10px] text-smoke tabular-nums">
              · {t.agent.terrain.activeDays(calendar.activeDays)}
            </span>
            {calendar.longestStreak > 1 && (
              <span className="hidden font-mono text-[10px] text-smoke tabular-nums sm:inline">
                · {t.agent.terrain.streak(calendar.longestStreak)}
              </span>
            )}
          </div>

          <p
            aria-live="polite"
            className="mt-1 truncate text-xs text-bone-dim tabular-nums"
          >
            {readout}
          </p>
        </div>

        <div
          role="group"
          aria-label={t.agent.terrain.viewToggleLabel}
          className="inline-flex shrink-0 rounded-full border border-line bg-ink p-0.5 font-mono text-[10px]"
        >
          {(
            [
              [t.agent.terrain.flat, true],
              [t.agent.terrain.terrain, false],
            ] as const
          ).map(([label, value]) => (
            <button
              key={label}
              type="button"
              aria-pressed={flat === value}
              onClick={() => flat !== value && setView(value)}
              className={cn(
                'rounded-full px-2.5 py-1 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember',
                flat === value
                  ? 'bg-ember text-ink'
                  : 'text-smoke hover:text-bone',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive 3D Isometric Terrain Canvas */}
      <canvas
        ref={canvasRef}
        role="img"
        tabIndex={0}
        aria-label={t.agent.terrain.canvasAria(total, weeks)}
        onBlur={() => {
          if (!sim.current.drag) hover(null)
        }}
        onKeyDown={handleKeyDown}
        onLostPointerCapture={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerLeave={handlePointerLeave}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={cn(
          'block h-56 w-full touch-pan-y outline-none focus-visible:ring-1 focus-visible:ring-ember focus-visible:ring-inset sm:h-64',
          dragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
      />

      {/* Footer: drag cue / latest release + Signal & Ink 5-level legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/70 px-4 py-2.5 font-mono text-[10px] text-smoke">
        <div className="flex min-w-0 items-center gap-2 truncate">
          {latestRelease ? (
            <>
              <a
                href={latestRelease.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-bone-dim transition-colors hover:text-ember"
              >
                <span>
                  {t.agent.terrain.latestRelease}: {latestRelease.repo} {latestRelease.tag}
                </span>
                <IconArrowUpRight className="size-3 shrink-0" />
              </a>
              <span className="hidden truncate text-smoke/80 md:inline">
                · {t.agent.terrain.dragHint}
              </span>
            </>
          ) : (
            <span className="truncate">{t.agent.terrain.dragHint}</span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <span className="mr-1">{t.agent.terrain.less}</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <span
              key={level}
              aria-hidden="true"
              className="size-2.5 rounded-[3px]"
              style={{ background: `var(--terrain-${level})` }}
            />
          ))}
          <span className="ml-1">{t.agent.terrain.more}</span>
        </div>
      </div>
    </motion.section>
  )
}
