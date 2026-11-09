import { Suspense } from 'react'
import { Physics } from '@react-three/rapier'
import { PHYSICS, type Vec3 } from '../config'
import { useIslandStore } from '../store/useIslandStore'
import { CameraRig } from './CameraRig'
import { EnvironmentDriver } from './EnvironmentDriver'
import { Lighting } from './Lighting'
import { SkyDome } from './SkyDome'
import { Terrain } from './Terrain'
import { Water } from './Water'
import { Entities } from './entities/Entities'
import { Clouds } from './weather/Clouds'
import { Fireflies } from './weather/Fireflies'
import { Precipitation } from './weather/Precipitation'

const GRAVITY: Vec3 = [0, -PHYSICS.gravity, 0]

/** Композиція 3D-сцени. Порядок важливий лише для EnvironmentDriver (див. його пріоритет). */
export function Experience() {
  const physicsPaused = useIslandStore((s) => s.physicsPaused)
  const showColliders = useIslandStore((s) => s.showColliders)

  return (
    <>
      <EnvironmentDriver />
      <SkyDome />
      <Lighting />
      <CameraRig />

      {/* Rapier завантажує WASM асинхронно — до того сцена показує небо й воду. */}
      <Suspense fallback={null}>
        <Physics gravity={GRAVITY} paused={physicsPaused} debug={showColliders}>
          <Terrain />
          <Entities />
        </Physics>
      </Suspense>

      <Water />
      <Clouds />
      <Precipitation kind="rain" />
      <Precipitation kind="snow" />
      <Fireflies />
    </>
  )
}
