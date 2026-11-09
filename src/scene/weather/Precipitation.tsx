import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  NormalBlending,
  ShaderMaterial,
  Vector2,
  Vector3,
  type Blending,
  type Points,
} from 'three'
import { PARTICLES } from '../../config'
import { useDisposable } from '../../hooks/useDisposable'
import { createRng, range } from '../../lib/random'
import { precipitationFragmentShader, precipitationVertexShader } from '../../shaders/precipitation'
import { environment, sky } from '../../store/runtime'

type PrecipitationKind = 'rain' | 'snow'

interface KindSpec {
  count: number
  speed: [number, number]
  fallSpeed: number
  size: number
  color: string
  blending: Blending
  seed: number
}

/** Відмінності між дощем і снігом — дані, а не окремі компоненти. */
const KINDS: Record<PrecipitationKind, KindSpec> = {
  rain: {
    count: PARTICLES.rainCount,
    speed: [14, 22],
    fallSpeed: 1,
    size: 9,
    color: '#a9c8e8',
    blending: NormalBlending,
    seed: 11,
  },
  snow: {
    count: PARTICLES.snowCount,
    speed: [1.2, 2.4],
    fallSpeed: 1,
    size: 5,
    color: '#ffffff',
    blending: AdditiveBlending,
    seed: 23,
  },
}

const noRaycast = () => null

function createGeometry({ count, speed, seed }: KindSpec): BufferGeometry {
  const rng = createRng(seed)
  const [w, h, d] = PARTICLES.volume
  const positions = new Float32Array(count * 3)
  const speeds = new Float32Array(count)
  const seeds = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = range(rng, -w / 2, w / 2)
    positions[i * 3 + 1] = range(rng, 0, h)
    positions[i * 3 + 2] = range(rng, -d / 2, d / 2)
    speeds[i] = range(rng, speed[0], speed[1])
    seeds[i] = rng()
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aSpeed', new BufferAttribute(speeds, 1))
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1))
  return geometry
}

function createMaterial(kindName: PrecipitationKind): ShaderMaterial {
  const kind = KINDS[kindName]
  return new ShaderMaterial({
    vertexShader: precipitationVertexShader,
    fragmentShader: precipitationFragmentShader,
    defines: kindName === 'snow' ? { SNOW: '' } : {},
    transparent: true,
    depthWrite: false,
    blending: kind.blending,
    uniforms: {
      uTime: { value: 0 },
      uVolume: { value: new Vector3(...PARTICLES.volume) },
      uFallSpeed: { value: kind.fallSpeed },
      uWind: { value: new Vector2() },
      uSize: { value: kind.size },
      uPixelRatio: { value: 1 },
      uColor: { value: new Color(kind.color) },
      uOpacity: { value: 0 },
    },
  })
}

/**
 * Дощ або сніг як GPU-система частинок. Інтенсивність опадів (0..1) з довкілля
 * керує прозорістю; коли опадів немає, Points зовсім не рендеряться.
 */
export function Precipitation({ kind: kindName }: { kind: PrecipitationKind }) {
  const kind = KINDS[kindName]
  const points = useRef<Points<BufferGeometry, ShaderMaterial>>(null)
  const dpr = useThree((s) => s.viewport.dpr)
  const geometry = useDisposable(() => createGeometry(kind))
  const material = useDisposable(() => createMaterial(kindName))
  const tint = useMemo(() => new Color(kind.color), [kind])

  useFrame(() => {
    const p = points.current
    if (!p) return
    const intensity = environment[kindName]
    p.visible = intensity > 0.01
    if (!p.visible) return

    const u = p.material.uniforms
    u.uTime.value = environment.elapsed
    u.uOpacity.value = Math.min(1, intensity) * (kindName === 'rain' ? 0.55 : 0.9)
    u.uPixelRatio.value = dpr
    const wind = environment.wind * (kindName === 'rain' ? 1 : 2.5)
    u.uWind.value.set(Math.cos(environment.windAngle) * wind, Math.sin(environment.windAngle) * wind)
    // Вночі опади темніші — інакше «світяться» на тлі неба.
    u.uColor.value.copy(tint).multiplyScalar(0.25 + sky.ambient * 1.4 + environment.lightning)
  })

  return (
    <points
      ref={points}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      raycast={noRaycast}
      visible={false}
    />
  )
}
