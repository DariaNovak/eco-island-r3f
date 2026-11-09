import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import type { BufferAttribute, Points } from 'three'
import { PARTICLES } from '../../config'
import { fireflyFactor } from '../../lib/environment'
import { environment } from '../../store/runtime'

/** Мінімальна зміна яскравості, при якій варто перезаливати атрибут на GPU. */
const OPACITY_EPSILON = 0.02
const noRaycast = () => null

/**
 * Світлячки над островом — Sparkles з drei. З'являються в темряві
 * і ховаються від дощу, снігу та вітру. Sparkles не має uniform прозорості,
 * тому плавно змінюємо атрибут opacity кожної частинки.
 */
export function Fireflies() {
  const sparkles = useRef<Points>(null)
  const shown = useRef(-1)

  useFrame(() => {
    const target = fireflyFactor(environment)
    const points = sparkles.current
    if (!points) return
    points.visible = target > OPACITY_EPSILON
    if (Math.abs(target - shown.current) < OPACITY_EPSILON) return

    const opacity = points.geometry.attributes.opacity as BufferAttribute
    ;(opacity.array as Float32Array).fill(target)
    opacity.needsUpdate = true
    shown.current = target
  })

  return (
    <Sparkles
      ref={sparkles}
      count={PARTICLES.fireflies}
      scale={[40, 4, 40]}
      position={[0, 3, 0]}
      size={14}
      speed={0.35}
      noise={1.5}
      color="#d8ff6b"
      raycast={noRaycast}
    />
  )
}
