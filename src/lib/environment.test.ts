import { describe, expect, it } from 'vitest'
import { TIME, WEATHER } from '../config'
import { createEnvironment, fireflyFactor, stepEnvironment, type Environment, type EnvironmentControls } from './environment'
import type { Rng } from './random'

const controls = (weather: string, extra: Partial<EnvironmentControls> = {}): EnvironmentControls => ({ weather, autoTime: false, timeSpeed: 1, ...extra })

function run(env: Environment, weather: string, seconds: number, extra?: Partial<EnvironmentControls>, rng?: Rng) {
  const dt = 1 / 30
  for (let t = 0; t < seconds; t += dt) stepEnvironment(env, controls(weather, extra), dt, rng)
  return env
}

describe('stepEnvironment', () => {
  it('плавно наближає канали погоди до пресету', () => {
    const env = createEnvironment('clear', 12)
    stepEnvironment(env, controls('rain'), 0.1)
    expect(env.rain).toBeGreaterThan(0)
    expect(env.rain).toBeLessThan(0.2)
    run(env, 'rain', 15)
    expect(env.rain).toBeCloseTo(WEATHER.rain.rain, 2)
    expect(env.cloud).toBeCloseTo(WEATHER.rain.cloud, 2)
  })

  it('сніг накопичується під час снігопаду і тане після', () => {
    const env = run(createEnvironment('snow', 12), 'snow', 15)
    expect(env.snowCover).toBeGreaterThan(0.3)
    run(env, 'snow', 60)
    expect(env.snowCover).toBe(1)
    run(env, 'clear', 60)
    expect(env.snowCover).toBe(0)
  })

  it('дощ зволожує ґрунт, а без дощу він висихає', () => {
    const env = run(createEnvironment('rain', 12), 'rain', 10)
    expect(env.wetness).toBe(1)
    run(env, 'clear', 40)
    expect(env.wetness).toBe(0)
  })

  it('блискавки б\'ють лише під час грози', () => {
    const calm = run(createEnvironment('rain', 12), 'rain', 20, {}, () => 0.5)
    expect(calm.nextLightning).toBe(createEnvironment().nextLightning)

    const env = createEnvironment('storm', 12)
    let flashes = 0
    for (let i = 0; i < 30 * 20; i++) {
      const before = env.lightning
      stepEnvironment(env, controls('storm'), 1 / 30, () => 0.5)
      if (env.lightning > before) flashes++
    }
    expect(flashes).toBeGreaterThan(2)
  })

  it('з автоматичним часом доба триває dayLengthSeconds і загортається через північ', () => {
    const env = createEnvironment('clear', 23)
    stepEnvironment(env, controls('clear', { autoTime: true }), TIME.dayLengthSeconds / 24)
    expect(env.hour).toBeCloseTo(0, 5)

    const frozen = createEnvironment('clear', 10)
    stepEnvironment(frozen, controls('clear'), 100)
    expect(frozen.hour).toBe(10)
  })

  it('невідома погода трактується як ясна', () => {
    const env = run(createEnvironment('rain', 12), 'tornado', 20)
    expect(env.rain).toBeCloseTo(0, 2)
  })
})

describe('fireflyFactor', () => {
  it('світлячки є ясної ночі, але не вдень і не під дощем', () => {
    expect(fireflyFactor(createEnvironment('clear', 0))).toBeGreaterThan(0.5)
    expect(fireflyFactor(createEnvironment('clear', 12))).toBe(0)
    expect(fireflyFactor(createEnvironment('rain', 0))).toBe(0)
  })
})
