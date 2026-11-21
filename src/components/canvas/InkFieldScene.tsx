import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

import { inkFieldFragment, inkFieldVertex } from '@/animations/glsl/inkField'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { pointerState } from '@/hooks/usePointer'
import { scrollState } from '@/lib/scroll-state'
import { paintColor, useTheme, type Theme } from '@/lib/theme'
import { clamp, lerp } from '@/lib/utils'

type Uniforms = Record<string, THREE.IUniform>

/**
 * Hands the shader the page's tokens as they paint right now. The shader
 * writes what it is given straight to the screen, with no encoding step. Dark
 * keeps three's sRGB decode, which lands on a deeper black and a redder ember
 * than the page's: the look the field was tuned on. Light skips the decode, so
 * the paper under the field is the page's paper and the hero has no edge.
 */
function setPalette(uniforms: Uniforms, canvas: HTMLElement, theme: Theme) {
  const space = theme === 'light' ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace
  const set = (name: string, token: string) =>
    (uniforms[name].value as THREE.Color).setStyle(paintColor(canvas, token), space)
  set('uInk', '--color-ink')
  set('uBone', '--color-bone')
  set('uEmber', '--color-ember')
  uniforms.uLight.value = theme === 'light' ? 1 : 0
}

function InkPlane() {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const { size, viewport, gl } = useThree()
  const theme = useTheme()
  const smooth = useRef({ x: 0, y: 0, velocity: 0, reveal: 0 })

  // Built with the palette already in: the first frame is the bare page colour.
  const uniforms = useMemo(() => {
    const initial: Uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uVelocity: { value: 0 },
      uReveal: { value: 0 },
      uLight: { value: 0 },
      uInk: { value: new THREE.Color() },
      uBone: { value: new THREE.Color() },
      uEmber: { value: new THREE.Color() },
    }
    setPalette(initial, gl.domElement, theme)
    return initial
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a later scheme goes through the effect
  }, [gl])

  useEffect(() => {
    const material = materialRef.current
    if (material) setPalette(material.uniforms, gl.domElement, theme)
  }, [gl, theme])

  useFrame((_, delta) => {
    const material = materialRef.current
    if (!material) return
    const s = smooth.current

    // ease everything so the field feels liquid, never twitchy
    s.x = lerp(s.x, pointerState.x, 0.05)
    s.y = lerp(s.y, pointerState.y, 0.05)
    const targetVelocity = clamp(Math.abs(scrollState.velocity) / 60, 0, 1)
    s.velocity = lerp(s.velocity, targetVelocity, 0.08)
    s.reveal = lerp(s.reveal, 1, 0.016)

    material.uniforms.uTime.value += delta
    material.uniforms.uPointer.value.set(s.x, s.y)
    material.uniforms.uVelocity.value = s.velocity
    material.uniforms.uReveal.value = s.reveal
    material.uniforms.uResolution.value.set(
      size.width * viewport.dpr,
      size.height * viewport.dpr,
    )
  })

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={inkFieldVertex}
        fragmentShader={inkFieldFragment}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  )
}

/**
 * Full-bleed WebGL ink field behind the hero. The render loop is suspended
 * (`frameloop="never"`) whenever the hero leaves the viewport, so it costs
 * nothing once scrolled past. DPR is capped lower on touch/mobile. `Hero`
 * does not mount it under reduced motion; its own backdrop stands in.
 */
export function InkFieldScene() {
  const isDesktop = useIsDesktop()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(true)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { threshold: 0 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <Canvas
        className="absolute inset-0"
        frameloop={active ? 'always' : 'never'}
        dpr={[1, isDesktop ? 1.5 : 1]}
        gl={{
          antialias: false,
          powerPreference: 'high-performance',
          // an opaque buffer starts out black: on paper that is a flash
          // between mounting and the first frame
          alpha: true,
        }}
        orthographic
        camera={{ position: [0, 0, 1], zoom: 1 }}
        style={{ position: 'absolute' }}
      >
        <InkPlane />
      </Canvas>
    </div>
  )
}
