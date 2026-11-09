export const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max)

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/** Плавний крок Ерміта: 0 до edge0, 1 після edge1. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/**
 * Експоненційне наближення до цілі, незалежне від частоти кадрів
 * (те саме, що MathUtils.damp з three).
 */
export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  lerp(current, target, 1 - Math.exp(-lambda * dt))

/** Пружне «перестрибування» в кінці анімації — для появи об'єктів. */
export function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3

/**
 * Чи був клік «справжнім», а не завершенням перетягування камери.
 * R3F передає в подію `delta` — відстань у пікселях між pointerdown і pointerup.
 */
export const CLICK_DRAG_TOLERANCE = 5
export const isCleanClick = (event: { delta: number }): boolean => event.delta <= CLICK_DRAG_TOLERANCE
