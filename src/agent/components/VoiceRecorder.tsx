import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useLanguage } from '@/i18n/LanguageContext'

import { IconArrowUp, IconClose } from './icons'

/**
 * Full Kokonut UI `AI-05` (AI Voice) waveform ported to Signal & Ink and wired
 * to the browser's Web Speech API (`SpeechRecognition`) — a direct nod to
 * Marcus's own voice-dictation project ISPer.
 *
 * Uses Kokonut's single zero-re-render `requestAnimationFrame` loop writing
 * `scaleY` transforms directly to 40 vertical bars inside a soft edge mask.
 */

const BAR_COUNT = 36
const BAR_IDS = Array.from({ length: BAR_COUNT + 1 }, (_, i) => `vbar-${i}`)
const BAR_PITCH = 5
const SAMPLE_MS = 70
const REST_LEVEL = 0.14
const STILL_LEVELS = BAR_IDS.map(
  (_, i) => 0.25 + 0.5 * Math.abs(Math.sin(i * 0.55) * Math.cos(i * 0.21)),
)
const EDGE_MASK =
  'linear-gradient(to right, transparent, black 14%, black 88%, transparent)'
const EASE_OUT = [0.23, 1, 0.32, 1] as const

interface SpeechRecognitionAlternativeLike {
  transcript: string
}

interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: SpeechRecognitionAlternativeLike
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function createVoiceSimulator() {
  let speaking = true
  let switchAt = 0
  let gate = 0.5
  return (time: number) => {
    if (time >= switchAt) {
      speaking = !speaking
      switchAt = time + (speaking ? 650 + Math.random() * 1100 : 180 + Math.random() * 380)
    }
    gate += ((speaking ? 1 : 0) - gate) * 0.32
    const t = time / 1000
    const syllable = Math.abs(Math.sin(t * Math.PI * 4.4 + Math.sin(t * 1.7) * 2))
    const grain = 0.65 + Math.random() * 0.35
    return REST_LEVEL + gate * syllable * grain * (1 - REST_LEVEL)
  }
}

function formatSeconds(total: number): string {
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function VoiceRecorder({
  onCancel,
  onComplete,
}: {
  onCancel: () => void
  onComplete: (transcript: string) => void
}) {
  const { locale, t } = useLanguage()
  const reduced = usePrefersReducedMotion()
  const [seconds, setSeconds] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [unsupported, setUnsupported] = useState(() => !getSpeechRecognitionCtor())

  const rowRef = useRef<HTMLDivElement>(null)
  const barRefs = useRef<(HTMLSpanElement | null)[]>([])
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const transcriptRef = useRef('')

  // Start Web Speech API recognition if available
  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return
    const recognition = new Ctor()
    recognition.lang = locale === 'pt' ? 'pt-BR' : 'en-US'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event) => {
      let combined = ''
      for (let i = 0; i < event.results.length; i += 1) {
        combined += event.results[i][0]?.transcript ?? ''
      }
      const clean = combined.trim()
      transcriptRef.current = clean
      setTranscript(clean)
    }
    recognition.onerror = () => {
      /* keep the bar responsive so the user can cancel or submit */
    }
    try {
      recognition.start()
      recognitionRef.current = recognition
    } catch {
      window.queueMicrotask(() => setUnsupported(true))
    }
    return () => {
      try {
        recognition.stop()
      } catch {
        /* already stopped */
      }
    }
  }, [locale])

  // Elapsed timer
  useEffect(() => {
    const started = Date.now()
    const id = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - started) / 1000))
    }, 250)
    return () => window.clearInterval(id)
  }, [])

  // Kokonut AI-05 scrolling waveform rAF loop (zero React re-renders)
  useEffect(() => {
    const row = rowRef.current
    const bars = barRefs.current
    if (!row) return

    if (reduced) {
      bars.forEach((bar, idx) => {
        if (bar) bar.style.transform = `scaleY(${STILL_LEVELS[idx].toFixed(3)})`
      })
      return
    }

    const simulate = createVoiceSimulator()
    const samples = BAR_IDS.map(() => REST_LEVEL)
    let phase = 0
    let last = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const dt = Math.min(now - last, 100)
      last = now
      phase += dt / SAMPLE_MS
      while (phase >= 1) {
        phase -= 1
        samples.shift()
        samples.push(simulate(now))
      }
      row.style.transform = `translateX(${(-phase * BAR_PITCH).toFixed(2)}px)`
      bars.forEach((bar, idx) => {
        if (bar) bar.style.transform = `scaleY(${samples[idx].toFixed(3)})`
      })
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [reduced])

  const finish = () => {
    try {
      recognitionRef.current?.stop()
    } catch {
      /* ignore */
    }
    const clean = transcriptRef.current.trim()
    if (clean) onComplete(clean)
    else onCancel()
  }

  return (
    <motion.div
      initial={{ opacity: 0, filter: 'blur(3px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(3px)' }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
      className="flex flex-col gap-3 px-4 py-3.5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full bg-ember motion-safe:animate-pulse"
          />
          <span className="truncate text-sm text-bone">
            {unsupported
              ? t.agent.voice.unsupported
              : transcript || t.agent.voice.listening}
          </span>
        </div>

        <span className="shrink-0 font-mono text-xs text-smoke tabular-nums">
          {formatSeconds(seconds)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div
          aria-hidden="true"
          className="relative h-8 flex-1 overflow-hidden"
          style={{ maskImage: EDGE_MASK, WebkitMaskImage: EDGE_MASK }}
        >
          <div
            ref={rowRef}
            className="flex h-full items-center gap-[3px] will-change-transform"
          >
            {BAR_IDS.map((id, idx) => (
              <span
                key={id}
                ref={(el) => {
                  barRefs.current[idx] = el
                }}
                className="h-7 w-[2px] shrink-0 origin-center rounded-full bg-ember/80 will-change-transform"
                style={{ transform: `scaleY(${REST_LEVEL})` }}
              />
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            aria-label={t.agent.voice.discard}
            className="flex h-8 items-center gap-1 rounded-full px-3 text-xs text-smoke transition-colors hover:bg-ink hover:text-bone"
          >
            <IconClose className="size-3.5" />
            <span>{t.agent.voice.discard}</span>
          </button>

          {!unsupported && (
            <button
              type="button"
              disabled={!transcript.trim()}
              onClick={finish}
              aria-label={t.agent.input.send}
              className="flex size-8 items-center justify-center rounded-full bg-ember text-ink transition-colors hover:bg-bone disabled:bg-ink disabled:text-smoke"
            >
              <IconArrowUp className="size-4" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
