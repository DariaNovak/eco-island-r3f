import { ENVIRONMENT, TIME, WEATHER, WEATHER_CHANNELS, isWeatherKey, type WeatherChannel } from '../config'
import { clamp, damp } from './math'
import { daylightAt, wrapHour } from './dayCycle'
import type { Rng } from './random'

/**
 * Стан довкілля, що змінюється щокадру: час доби, поточна (змішана) погода
 * і накопичувальні ефекти — сніговий покрив, вологість ґрунту, блискавки.
 * Це звичайний об'єкт без React: його мутує stepEnvironment, а сцена
 * читає значення у своїх useFrame, не викликаючи ре-рендерів.
 */
export interface Environment extends Record<WeatherChannel, number> {
  hour: number
  elapsed: number
  daylight: number
  snowCover: number
  wetness: number
  /** Яскравість поточного спалаху блискавки 0..1. */
  lightning: number
  nextLightning: number
  /** Напрямок вітру, рад (повільно обертається). */
  windAngle: number
}

/** Керування симуляцією зі стору. weather — ключ пресету; невідомий ключ трактується як «ясно». */
export interface EnvironmentControls {
  weather: string
  autoTime: boolean
  timeSpeed: number
}

const presetFor = (key: string) => (isWeatherKey(key) ? WEATHER[key] : WEATHER.clear)

export function createEnvironment(weatherKey: string = 'clear', hour: number = TIME.start): Environment {
  const preset = presetFor(weatherKey)
  return {
    hour,
    elapsed: 0,
    daylight: daylightAt(hour),
    rain: preset.rain,
    snow: preset.snow,
    fog: preset.fog,
    cloud: preset.cloud,
    wind: preset.wind,
    storm: preset.storm,
    snowCover: 0,
    wetness: 0,
    lightning: 0,
    nextLightning: ENVIRONMENT.lightningInterval,
    windAngle: 0.6,
  }
}

/**
 * Один крок симуляції довкілля.
 * @param env — об'єкт з createEnvironment (мутується)
 * @param controls — { weather, autoTime, timeSpeed } зі стору
 * @param dt — крок часу, с
 * @param rng — генератор випадкових чисел [0, 1) (для блискавок)
 */
export function stepEnvironment(env: Environment, controls: EnvironmentControls, dt: number, rng: Rng = Math.random): Environment {
  const target = presetFor(controls.weather)
  env.elapsed += dt

  if (controls.autoTime) {
    env.hour = wrapHour(env.hour + (dt * 24 * controls.timeSpeed) / TIME.dayLengthSeconds)
  }
  env.daylight = daylightAt(env.hour)

  for (const channel of WEATHER_CHANNELS) {
    env[channel] = damp(env[channel], target[channel], ENVIRONMENT.blendSpeed, dt)
  }

  // Сніг накопичується під час снігопаду і тане від сонця та дощу.
  if (env.snow > 0.3) {
    env.snowCover += (dt / ENVIRONMENT.snowAccumulateSeconds) * env.snow
  } else {
    const melt = 0.4 + env.daylight + env.rain * 2
    env.snowCover -= (dt / ENVIRONMENT.snowMeltSeconds) * melt
  }
  env.snowCover = clamp(env.snowCover, 0, 1)

  // Дощ зволожує ґрунт; без дощу він поступово висихає.
  env.wetness += env.rain > 0.2 ? (dt / ENVIRONMENT.wetSeconds) * env.rain : -dt / ENVIRONMENT.drySeconds
  env.wetness = clamp(env.wetness, 0, 1)

  env.lightning = Math.max(0, env.lightning - dt * 5)
  if (env.storm > 0.6) {
    env.nextLightning -= dt
    if (env.nextLightning <= 0) {
      env.lightning = 1
      env.nextLightning = ENVIRONMENT.lightningInterval * (0.3 + rng() * 1.4)
    }
  }

  env.windAngle += dt * 0.03 * (0.2 + env.wind)
  return env
}

/** Чи активні світлячки: вночі, без опадів і сильного вітру. Повертає 0..1. */
export function fireflyFactor(env: Environment): number {
  const night = 1 - env.daylight
  return clamp(night * (1 - env.rain * 1.5) * (1 - env.snow) * (1 - env.wind * 0.6), 0, 1)
}
