/** Генератор випадкових чисел у [0, 1) — Math.random або детермінований createRng. */
export type Rng = () => number

/**
 * Детермінований генератор псевдовипадкових чисел mulberry32.
 * Повертає функцію, яка при кожному виклику дає число в [0, 1).
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Випадкове число в діапазоні [min, max). */
export function range(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min)
}

/** Випадковий елемент масиву. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]
}
