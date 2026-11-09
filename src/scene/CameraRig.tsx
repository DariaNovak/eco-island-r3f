import { useEffect, useRef, type ComponentRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { CAMERA } from '../config'
import { useIslandStore } from '../store/useIslandStore'

/** Орбітальна камера з обмеженнями; вимикається на час мазка пензлем. */
export function CameraRig() {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const sculpting = useIslandStore((s) => s.sculpting)
  const resetToken = useIslandStore((s) => s.cameraResetToken)

  useEffect(() => {
    const instance = controls.current
    if (resetToken === 0 || !instance) return
    instance.object.position.set(...CAMERA.position)
    instance.target.set(...CAMERA.target)
    instance.update()
  }, [resetToken])

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={!sculpting}
      target={CAMERA.target}
      enableDamping
      dampingFactor={0.08}
      minDistance={CAMERA.minDistance}
      maxDistance={CAMERA.maxDistance}
      maxPolarAngle={CAMERA.maxPolarAngle}
    />
  )
}
