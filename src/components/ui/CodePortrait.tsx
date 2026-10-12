import { useEffect, useRef, useState } from 'react'

import { createCodePortrait, PORTRAIT_DURATION } from '@/animations/codePortrait'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useLanguage } from '@/i18n/LanguageContext'

interface CodePortraitProps {
  src: string
  alt: string
  caption: string
}

export function CodePortrait({ src, alt, caption }: CodePortraitProps) {
  const imageRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const replayRef = useRef<(() => void) | null>(null)
  const [preparedSrc, setPreparedSrc] = useState<string | null>(null)
  const reduced = usePrefersReducedMotion()
  const { t } = useLanguage()

  useEffect(() => {
    const image = imageRef.current
    const canvas = canvasRef.current
    if (!image || !canvas || reduced) return
    let disposed = false
    let visible = false
    let elapsed = 0
    let previous = 0
    let frame = 0
    let render: ReturnType<typeof createCodePortrait> = null
    // Separate CORS sampling from the displayed image: an unsupported remote
    // host must never turn a working portrait into a broken image.
    const sample = new Image()
    sample.crossOrigin = 'anonymous'

    const stop = () => {
      cancelAnimationFrame(frame)
      frame = 0
      previous = 0
    }
    const tick = (now: number) => {
      frame = 0
      if (!visible || document.hidden || !render || disposed) return
      if (previous) elapsed += now - previous
      previous = now
      render(elapsed)
      if (elapsed < PORTRAIT_DURATION) frame = requestAnimationFrame(tick)
    }
    const resume = () => {
      if (visible && !document.hidden && render && !frame && elapsed < PORTRAIT_DURATION) {
        frame = requestAnimationFrame(tick)
      }
    }
    const prepare = () => {
      if (disposed || !visible || !sample.complete || !sample.naturalWidth) return
      render = createCodePortrait(sample, canvas)
      if (!render) {
        stop()
        canvas.style.opacity = '0'
        setPreparedSrc(null)
        return
      }
      render(elapsed)
      setPreparedSrc(src)
      resume()
    }
    replayRef.current = () => {
      stop()
      elapsed = 0
      render?.(0)
      resume()
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) {
        if (render) resume()
        else prepare()
      } else stop()
    }, { threshold: 0.15 })
    observer.observe(canvas)
    const resize = new ResizeObserver(() => { if (render) prepare() })
    resize.observe(canvas)
    const onVisibility = () => { if (document.hidden) stop(); else resume() }
    const onLoad = () => {
      if (image.naturalWidth) sample.src = image.currentSrc || image.src
    }
    sample.onload = () => { void document.fonts.ready.then(prepare) }
    sample.onerror = () => { if (!disposed) setPreparedSrc(null) }
    document.addEventListener('visibilitychange', onVisibility)
    image.addEventListener('load', onLoad)
    onLoad()

    return () => {
      disposed = true
      stop()
      observer.disconnect()
      resize.disconnect()
      image.removeEventListener('load', onLoad)
      sample.onload = null
      sample.onerror = null
      document.removeEventListener('visibilitychange', onVisibility)
      replayRef.current = null
      canvas.style.opacity = '0'
    }
  }, [src, reduced])

  return (
    <figure className="relative ml-auto aspect-[3/4] max-w-xs overflow-hidden bg-ink lg:-mt-10">
      <div data-portrait className="absolute inset-x-0 top-0 h-[116%]">
        <img
          ref={imageRef}
          src={src}
          srcSet={src === '/portrait-640.webp'
            ? '/portrait-320.webp 320w, /portrait-640.webp 640w' : undefined}
          sizes="(min-width: 640px) 320px, 80vw"
          alt={alt}
          loading="lazy"
          decoding="async"
          width={640}
          height={640}
          className="h-full w-full object-cover grayscale"
        />
        <canvas ref={canvasRef} aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0" />
      </div>
      <figcaption className="pointer-events-none absolute bottom-3 left-3 bg-ink/80 px-3 py-1 font-mono text-[10px] tracking-[0.25em] text-ember uppercase">
        {caption}
      </figcaption>
      {preparedSrc === src && !reduced && (
        <button type="button" onClick={() => replayRef.current?.()}
          aria-label={t.about.replayPortrait}
          title={t.about.replayPortrait}
          className="absolute top-3 right-3 flex min-h-11 min-w-11 items-center justify-center border border-bone/20 bg-ink/75 text-bone transition-colors hover:border-ember hover:text-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6" />
          </svg>
        </button>
      )}
    </figure>
  )
}
