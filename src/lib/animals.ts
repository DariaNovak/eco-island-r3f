import { ANIMAL, type AnimalConfig } from '../config'
import { range, type Rng } from './random'

export type HeightSampler = (x: number, z: number) => number

/**
 * Обирає напрямок наступного стрибка тварини.
 * Тварина повертає на випадковий кут, але якщо попереду вода —
 * розвертається до центру острова, щоб не стрибати в море.
 *
 * @param x, z — поточна позиція
 * @param heading — поточний курс, рад (0 = +Z)
 * @param heightAt — (x, z) => висота рельєфу
 * @returns новий курс, рад
 */
export function planHop(
  x: number,
  z: number,
  heading: number,
  rng: Rng,
  heightAt: HeightSampler,
  waterLevel: number,
  config: AnimalConfig = ANIMAL,
): number {
  const candidate = heading + range(rng, -config.maxTurn, config.maxTurn)
  const aheadX = x + Math.sin(candidate) * config.lookAhead
  const aheadZ = z + Math.cos(candidate) * config.lookAhead

  if (heightAt(aheadX, aheadZ) > waterLevel + 0.25) return candidate

  const towardCenter = Math.atan2(-x, -z)
  return towardCenter + range(rng, -0.3, 0.3)
}

/** Імпульс стрибка для курсу heading і маси mass. */
export function hopImpulse(heading: number, mass: number, config: AnimalConfig = ANIMAL) {
  return {
    x: Math.sin(heading) * config.hopImpulseForward * mass,
    y: config.hopImpulseUp * mass,
    z: Math.cos(heading) * config.hopImpulseForward * mass,
  }
}
