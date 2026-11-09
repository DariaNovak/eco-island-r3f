import { clamp } from './math'

/**
 * Спрощена сила Архімеда: F = ρ_води · g · V_зануреного.
 * Об'єм тіла виражаємо через масу та відносну густину (V = m / ρ),
 * а частку зануреного об'єму — через глибину нижньої точки відносно висоти тіла.
 *
 * @param mass — маса тіла, кг
 * @param depth — наскільки нижня точка тіла під водою, м (≤ 0 — над водою)
 * @param height — висота тіла, м
 * @param density — густина відносно води (вода = 1)
 * @returns вертикальна сила, Н
 */
export function buoyancyForce(mass: number, depth: number, height: number, density: number, gravity: number): number {
  if (depth <= 0) return 0
  const submerged = clamp(depth / height, 0, 1)
  return (mass * gravity * submerged) / density
}

/**
 * Глибина, на якій тіло врівноважене (сила Архімеда = вага).
 * Для тіл, густіших за воду, рівноваги немає — повертає Infinity (тоне).
 */
export function equilibriumDepth(height: number, density: number): number {
  return density >= 1 ? Infinity : height * density
}
