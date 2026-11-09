import { useFrame } from '@react-three/fiber'
import type { Vec3 } from '../config'
import { stepEnvironment } from '../lib/environment'
import { sampleSky, sunDirection as computeSunDirection } from '../lib/dayCycle'
import { weatherUniforms } from '../shaders/weatherPatch'
import { useIslandStore } from '../store/useIslandStore'
import { environment, sky, sunDirection } from '../store/runtime'
import { updateSharedMaterials } from './assets'

/** Обмеження кроку: після перемикання вкладки погода не «перестрибує». */
const MAX_DELTA = 1 / 10
/** Від'ємний пріоритет — цей useFrame виконується раніше за інші. */
const PRIORITY = -1

const sunScratch: Vec3 = [0, 0, 0]

/**
 * Невидимий компонент — «серце» симуляції довкілля.
 * Раз на кадр просуває час і погоду, рахує кольори неба та оновлює
 * спільні уніформи, які потім читають усі інші компоненти сцени.
 */
export function EnvironmentDriver() {
  useFrame((_, delta) => {
    const { weather, autoTime, timeSpeed } = useIslandStore.getState()
    stepEnvironment(environment, { weather, autoTime, timeSpeed }, Math.min(delta, MAX_DELTA))

    sunDirection.fromArray(computeSunDirection(environment.hour, sunScratch))
    sampleSky(sunDirection.y, environment.cloud, sky)

    weatherUniforms.uSnow.value = environment.snowCover
    weatherUniforms.uWet.value = environment.wetness
    updateSharedMaterials(environment)
  }, PRIORITY)

  return null
}
