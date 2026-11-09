import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import type { Vec3 } from '../../config'
import { createRng, range } from '../../lib/random'
import { environment } from '../../store/runtime'
import { geometries, materials } from '../assets'

const CLOUD_COUNT = 16
const AREA = 150
const HEIGHT: [number, number] = [38, 48]
const WIND_SPEED = 3
const noRaycast = () => null

interface Cloud {
  id: number
  position: Vec3
  puffs: { id: number; position: Vec3; scale: Vec3 }[]
}

/** Детерміноване розташування хмар: кожна — купка з 3–5 «клубків». */
function createClouds(): Cloud[] {
  const rng = createRng(77)
  return Array.from({ length: CLOUD_COUNT }, (_, id) => ({
    id,
    position: [range(rng, -AREA / 2, AREA / 2), range(rng, ...HEIGHT), range(rng, -AREA / 2, AREA / 2)],
    puffs: Array.from({ length: 3 + Math.floor(rng() * 3) }, (_, i) => ({
      id: i,
      position: [range(rng, -4, 4), range(rng, -0.6, 0.8), range(rng, -2, 2)],
      scale: [range(rng, 2.2, 4), range(rng, 1.4, 2.2), range(rng, 1.8, 3)],
    })),
  }))
}

/**
 * Low-poly хмари, що пливуть за вітром і перевертаються на інший край неба.
 * Колір і прозорість спільного матеріалу оновлює updateSharedMaterials,
 * тому при грозі всі хмари разом темніють.
 */
export function Clouds() {
  const clouds = useMemo(() => createClouds(), [])
  const group = useRef<Group>(null)

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    const step = (0.3 + environment.wind) * WIND_SPEED * Math.min(delta, 0.1)
    const dx = Math.cos(environment.windAngle) * step
    const dz = Math.sin(environment.windAngle) * step
    for (const cloud of g.children) {
      cloud.position.x = wrap(cloud.position.x + dx)
      cloud.position.z = wrap(cloud.position.z + dz)
    }
  })

  return (
    <group ref={group}>
      {clouds.map((cloud) => (
        <group key={cloud.id} position={cloud.position}>
          {cloud.puffs.map((puff) => (
            <mesh
              key={puff.id}
              geometry={geometries.cloudPuff}
              material={materials.cloud}
              position={puff.position}
              scale={puff.scale}
              raycast={noRaycast}
            />
          ))}
        </group>
      ))}
    </group>
  )
}

const wrap = (value: number) => ((((value + AREA / 2) % AREA) + AREA) % AREA) - AREA / 2
