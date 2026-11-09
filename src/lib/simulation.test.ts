import { describe, expect, it } from 'vitest'
import { ANIMAL, WATER } from '../config'
import { hopImpulse, planHop } from './animals'
import { buoyancyForce, equilibriumDepth } from './physics'
import { activeRipples, addRipple, createRippleBuffer } from './ripples'
import { createRng } from './random'

describe('planHop', () => {
  const island = (x: number, z: number) => 5 - Math.hypot(x, z) * 0.5 // суша в радіусі 10 м

  it('на суші змінює курс не більше ніж на maxTurn', () => {
    const rng = createRng(3)
    for (let i = 0; i < 50; i++) {
      const heading = planHop(0, 0, 1, rng, island, 0)
      expect(Math.abs(heading - 1)).toBeLessThanOrEqual(ANIMAL.maxTurn)
    }
  })

  it('біля води розвертається до центру острова', () => {
    const rng = createRng(5)
    // Тварина на березі (x = 9.5) дивиться в море (+X, курс π/2).
    const heading = planHop(9.5, 0, Math.PI / 2, rng, island, 0)
    expect(Math.sin(heading)).toBeLessThan(-0.9)
  })

  it('імпульс стрибка спрямований за курсом і пропорційний масі', () => {
    const impulse = hopImpulse(0, 2)
    expect(impulse.x).toBeCloseTo(0, 6)
    expect(impulse.z).toBeCloseTo(ANIMAL.hopImpulseForward * 2, 6)
    expect(impulse.y).toBeCloseTo(ANIMAL.hopImpulseUp * 2, 6)
  })
})

describe('buoyancyForce', () => {
  const g = 9.81

  it('над водою сила Архімеда відсутня', () => {
    expect(buoyancyForce(10, 0, 1, 0.5, g)).toBe(0)
    expect(buoyancyForce(10, -2, 1, 0.5, g)).toBe(0)
  })

  it('на глибині рівноваги легке тіло врівноважене, повністю занурене — виштовхується', () => {
    const mass = 4
    const height = 2
    const density = 0.6
    const weight = mass * g
    expect(buoyancyForce(mass, equilibriumDepth(height, density), height, density, g)).toBeCloseTo(weight, 6)
    expect(buoyancyForce(mass, height, height, density, g)).toBeGreaterThan(weight)
  })

  it('камінь (густина > 1) тоне навіть повністю зануреним', () => {
    expect(buoyancyForce(10, 5, 1, 2.6, g)).toBeLessThan(10 * g)
    expect(equilibriumDepth(1, 2.6)).toBe(Infinity)
  })
})

describe('ripple buffer', () => {
  it('зберігає брижі та перезаписує найстаріші по колу', () => {
    const buffer = createRippleBuffer(2)
    expect(activeRipples(buffer, 0, WATER.rippleLifetime)).toBe(0)

    addRipple(buffer, 1, 2, 0)
    addRipple(buffer, 3, 4, 1)
    expect(activeRipples(buffer, 1, WATER.rippleLifetime)).toBe(2)

    addRipple(buffer, 5, 6, 2, 0.5)
    expect(Array.from(buffer.data.slice(0, 4))).toEqual([5, 6, 2, 0.5])
    expect(activeRipples(buffer, 1 + WATER.rippleLifetime + 0.1, WATER.rippleLifetime)).toBe(1)
  })
})
