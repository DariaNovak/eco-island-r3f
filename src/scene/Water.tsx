import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import {
  Color,
  DataTexture,
  LinearFilter,
  RedFormat,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Camera,
  type Mesh,
} from 'three'
import { TERRAIN, TOOLS, WATER, WORLD, entitySpec, isEntityType } from '../config'
import { useDisposable } from '../hooks/useDisposable'
import { isCleanClick } from '../lib/math'
import { addRipple } from '../lib/ripples'
import { fullRect, type GridRect, type HeightField } from '../lib/terrain'
import { waterFragmentShader, waterVertexShader } from '../shaders/water'
import { useIslandStore } from '../store/useIslandStore'
import { environment, pendingTerrainEdit, ripples, sky, sunDirection } from '../store/runtime'

/**
 * Переводить висоти в межах rect у 8-бітну текстуру (0..255 ↔ minHeight..maxHeight).
 * Під час мазка пензля переписується лише змінена ділянка.
 */
function writeHeightTexture(texture: DataTexture, field: HeightField, rect: GridRect): void {
  const data = texture.image.data as Uint8Array
  const n = field.resolution
  const scale = 255 / (field.maxHeight - field.minHeight)
  for (let row = rect.rowMin; row <= rect.rowMax; row++) {
    for (let col = rect.colMin; col <= rect.colMax; col++) {
      const i = row * n + col
      data[i] = Math.round((field.heights[i] - field.minHeight) * scale)
    }
  }
  texture.needsUpdate = true
}

function createHeightTexture(field: HeightField): DataTexture {
  const n = field.resolution
  const texture = new DataTexture(new Uint8Array(n * n), n, n, RedFormat)
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  writeHeightTexture(texture, field, fullRect(field))
  return texture
}

const createWaterMaterial = () =>
  new ShaderMaterial({
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
    transparent: true,
    fog: true,
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uTime: { value: 0 },
        uWaveHeight: { value: WATER.baseWaveHeight },
        uWindDirection: { value: new Vector2(1, 0) },
        uRipples: { value: null },
        uRippleLifetime: { value: WATER.rippleLifetime },
        uHeightMap: { value: null },
        uTerrainSize: { value: TERRAIN.size },
        uTerrainResolution: { value: TERRAIN.segments + 1 },
        uHeightRange: { value: new Vector2(TERRAIN.minHeight, TERRAIN.maxHeight) },
        uDeepColor: { value: new Color(WATER.colors.deep) },
        uShallowColor: { value: new Color(WATER.colors.shallow) },
        uFoamColor: { value: new Color(WATER.colors.foam) },
        uSkyColor: { value: new Color() },
        uSunDirection: { value: new Vector3() },
        uSunColor: { value: new Color() },
        uSunIntensity: { value: 1 },
        uAmbient: { value: 0.5 },
        uRain: { value: 0 },
      },
    ]),
  })

const viewDirection = new Vector3()

interface CameraTracker {
  previous: Vector3 | null
  cooldown: number
}

/**
 * Інтерактивна вода з власним шейдером.
 * Реагує на вітер і грозу (висота хвиль), на кліки (брижі в точці кліку),
 * на падіння об'єктів (бризки додає Entity) та на швидкий рух камери.
 */
export function Water() {
  const field = useIslandStore((s) => s.field)
  const mesh = useRef<Mesh<BufferGeometry, ShaderMaterial>>(null)
  const material = useDisposable(createWaterMaterial)
  // Новий острів — нова текстура (заповнюється повністю один раз).
  const heightTexture = useMemo(() => createHeightTexture(field), [field])
  useEffect(() => () => heightTexture.dispose(), [heightTexture])

  /** Стан камери для «тривоги» води: попередня позиція і таймер. */
  const cameraTracker = useRef<CameraTracker>({ previous: null, cooldown: 0 })

  useEffect(() => {
    const m = mesh.current
    if (!m) return
    const u = m.material.uniforms
    u.uHeightMap.value = heightTexture
    u.uRipples.value = ripples.data
  }, [heightTexture])

  useFrame(({ camera }, delta) => {
    const m = mesh.current
    if (!m) return
    const u = m.material.uniforms
    const env = environment
    u.uTime.value = env.elapsed
    u.uWaveHeight.value =
      WATER.baseWaveHeight + env.wind * WATER.windWaveHeight + env.storm * WATER.stormWaveHeight
    u.uWindDirection.value.set(Math.cos(env.windAngle), Math.sin(env.windAngle))
    u.uSkyColor.value.copy(sky.skyHorizon)
    u.uSunDirection.value.copy(sunDirection)
    u.uSunColor.value.copy(sky.sun)
    u.uSunIntensity.value = sunDirection.y > 0 ? sky.sunIntensity : 0
    u.uAmbient.value = sky.ambient + env.lightning
    u.uRain.value = env.rain

    // Поки триває мазок пензля — береги змінюються наживо, але лише в зміненій ділянці.
    const edit = pendingTerrainEdit.rect
    if (edit && u.uHeightMap.value) {
      writeHeightTexture(u.uHeightMap.value as DataTexture, field, edit)
      pendingTerrainEdit.rect = null
    }

    disturbByCamera(camera, delta, cameraTracker.current)
  })

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!isCleanClick(event)) return
    event.stopPropagation()
    const { tool, spawnAt, notify } = useIslandStore.getState()
    addRipple(ripples, event.point.x, event.point.z, environment.elapsed, 1)
    if (TOOLS[tool].kind !== 'spawn' || !isEntityType(tool)) return
    // Камінь можна кинути в море — він сплесне і піде на дно.
    if (entitySpec(tool).allowUnderwater) {
      spawnAt({ x: event.point.x, y: WORLD.waterLevel, z: event.point.z }, 1)
    } else {
      notify('Тут вода — оберіть сушу')
    }
  }

  return (
    <mesh
      ref={mesh}
      material={material}
      rotation-x={-Math.PI / 2}
      position-y={WORLD.waterLevel}
      onClick={handleClick}
    >
      <planeGeometry args={[WATER.size, WATER.size, WATER.segments, WATER.segments]} />
    </mesh>
  )
}

/**
 * Якщо камера рухається швидко, у точці, куди вона дивиться, на воді
 * з'являються брижі — вода «відчуває» спостерігача.
 */
function disturbByCamera(camera: Camera, delta: number, tracker: CameraTracker): void {
  if (!tracker.previous) {
    tracker.previous = camera.position.clone()
    return
  }
  const speed = tracker.previous.distanceTo(camera.position) / Math.max(delta, 1e-3)
  tracker.previous.copy(camera.position)
  tracker.cooldown -= delta
  if (speed < WATER.cameraRippleSpeed || tracker.cooldown > 0) return

  camera.getWorldDirection(viewDirection)
  if (viewDirection.y >= -0.05) return
  const t = (WORLD.waterLevel - camera.position.y) / viewDirection.y
  const x = camera.position.x + viewDirection.x * t
  const z = camera.position.z + viewDirection.z * t
  addRipple(ripples, x, z, environment.elapsed, 0.5)
  tracker.cooldown = WATER.cameraRippleInterval
}
