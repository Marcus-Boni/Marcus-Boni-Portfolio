import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import { inkFieldFragment, inkFieldVertex } from '@/animations/glsl/inkField'
import { pointerState } from '@/hooks/usePointer'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { scrollState } from '@/lib/scroll-state'
import { clamp, lerp } from '@/lib/utils'

const INK = new THREE.Color('#0d0c0a')
const BONE = new THREE.Color('#ece7df')
const EMBER = new THREE.Color('#ff4d17')

function InkPlane() {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const { size, viewport } = useThree()
  const smooth = useRef({ x: 0, y: 0, velocity: 0, reveal: 0 })

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uVelocity: { value: 0 },
      uReveal: { value: 0 },
      uInk: { value: INK },
      uBone: { value: BONE },
      uEmber: { value: EMBER },
    }),
    [],
  )

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
 * Full-bleed WebGL ink field behind the hero. Static fallback gradient when
 * the user prefers reduced motion.
 */
export function InkFieldScene() {
  const reduced = usePrefersReducedMotion()

  if (reduced) {
    return (
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 70% 20%, #1c1815 0%, #0d0c0a 60%)',
        }}
      />
    )
  }

  return (
    <Canvas
      className="absolute inset-0"
      dpr={[1, 1.75]}
      gl={{
        antialias: false,
        powerPreference: 'high-performance',
        alpha: false,
      }}
      orthographic
      camera={{ position: [0, 0, 1], zoom: 1 }}
      style={{ position: 'absolute' }}
    >
      <InkPlane />
    </Canvas>
  )
}
