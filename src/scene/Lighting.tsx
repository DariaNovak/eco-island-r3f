import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Vector3, type DirectionalLight, type FogExp2, type HemisphereLight } from 'three'
import { environment, sky, sunDirection } from '../store/runtime'

const moonDirection = new Vector3()
const SUN_DISTANCE = 60
const SHADOW_EXTENT = 38
const MOON_COLOR = new Color('#9fb4ff')
const MOON_INTENSITY = 0.7
/** Базова густина туману в ясну погоду та її приріст при густому тумані. */
const FOG_DENSITY = { base: 0.0045, max: 0.03 }

/**
 * Сонце/місяць (одне спрямоване світло з тінями), небесне розсіяне світло
 * та експоненційний туман. Усі параметри щокадру беруться з runtime-стану.
 */
export function Lighting() {
  const sun = useRef<DirectionalLight>(null)
  const hemi = useRef<HemisphereLight>(null)
  const fog = useRef<FogExp2>(null)

  useFrame(() => {
    const light = sun.current
    const h = hemi.current
    const f = fog.current
    if (!light || !h || !f) return
    const isDay = sunDirection.y > -0.02
    // Вночі те саме світло «стає» місяцем з протилежного боку неба.
    const direction = isDay ? sunDirection : moonDirection.copy(sunDirection).negate()
    light.position.copy(direction).multiplyScalar(SUN_DISTANCE)

    if (isDay) {
      light.color.copy(sky.sun)
      light.intensity = sky.sunIntensity * Math.min(1, Math.max(0, sunDirection.y * 6))
    } else {
      light.color.copy(MOON_COLOR)
      light.intensity = MOON_INTENSITY * (1 - environment.cloud * 0.7)
    }

    h.color.copy(sky.hemiSky)
    h.groundColor.copy(sky.hemiGround)
    h.intensity = sky.ambient * 1.6 + environment.lightning * 3.5

    f.color.copy(sky.skyHorizon)
    f.density = FOG_DENSITY.base + environment.fog * FOG_DENSITY.max
  })

  return (
    <>
      <fogExp2 ref={fog} attach="fog" args={['#bfe6ff', FOG_DENSITY.base]} />
      <hemisphereLight ref={hemi} />
      <directionalLight
        ref={sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
        shadow-camera-near={1}
        shadow-camera-far={SUN_DISTANCE * 2}
      />
    </>
  )
}
