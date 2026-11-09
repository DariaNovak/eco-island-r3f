import { createNoise2D, type NoiseFunction2D } from 'simplex-noise'
import type { TerrainConfig, Vec3 } from '../config'
import { clamp, lerp, smoothstep } from './math'
import { createRng } from './random'

/**
 * Карта висот острова — квадратна сітка (segments + 1)² висот.
 * Індекс вершини: row * resolution + col, де col іде вздовж X, row — вздовж Z.
 * Цю саму структуру використовують геометрія, колайдер фізики, шейдер води
 * (піна біля берега) і логіка розміщення об'єктів.
 */
export interface HeightField {
  seed: number
  size: number
  segments: number
  resolution: number
  step: number
  heights: Float32Array
  minHeight: number
  maxHeight: number
}

/** Прямокутник вершин сітки (межі включно). */
export interface GridRect {
  colMin: number
  colMax: number
  rowMin: number
  rowMax: number
}

/** Фрактальний шум (fBm): сума октав simplex-шуму, результат у [-1, 1]. */
function fbm(noise: NoiseFunction2D, x: number, z: number, octaves: number): number {
  let amplitude = 0.5
  let frequency = 1
  let sum = 0
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += noise(x * frequency, z * frequency) * amplitude
    norm += amplitude
    amplitude *= 0.5
    frequency *= 2.03
  }
  return sum / norm
}

/** Висота «природного» острова в точці (x, z) до будь-якого тераформінгу. */
function islandHeight(x: number, z: number, noise: NoiseFunction2D, config: TerrainConfig): number {
  const radius = (config.size / 2) * config.islandRadius
  // Шум спотворює відстань — берегова лінія стає неправильною.
  const warp = noise(x * 0.035 + 100, z * 0.035 - 50) * 0.22
  const r = Math.hypot(x, z) / radius + warp
  const mask = 1 - smoothstep(0.55, 1.05, r)

  const detail = fbm(noise, x * config.noiseScale, z * config.noiseScale, config.noiseOctaves)
  const hillDistance = Math.hypot(x + 6, z + 4) / (radius * 0.55)
  const hill = (1 - smoothstep(0, 1, hillDistance)) ** 1.5 * config.hillHeight

  return lerp(config.seabed, config.plateau, mask) + mask * (detail * config.noiseAmplitude + hill)
}

export function createHeightField(config: TerrainConfig, seed: number): HeightField {
  const { size, segments } = config
  const resolution = segments + 1
  const step = size / segments
  const heights = new Float32Array(resolution * resolution)
  const noise = createNoise2D(createRng(seed))

  for (let row = 0; row < resolution; row++) {
    const z = -size / 2 + row * step
    for (let col = 0; col < resolution; col++) {
      const x = -size / 2 + col * step
      heights[row * resolution + col] = clamp(
        islandHeight(x, z, noise, config),
        config.minHeight,
        config.maxHeight,
      )
    }
  }

  return {
    seed,
    size,
    segments,
    resolution,
    step,
    heights,
    minHeight: config.minHeight,
    maxHeight: config.maxHeight,
  }
}

/** Світові координати → дробові індекси сітки (обмежені краями). */
function toGrid(field: HeightField, x: number, z: number): [number, number] {
  const half = field.size / 2
  return [
    clamp((x + half) / field.step, 0, field.segments),
    clamp((z + half) / field.step, 0, field.segments),
  ]
}

/** Білінійна інтерполяція висоти в довільній точці. */
export function sampleHeight(field: HeightField, x: number, z: number): number {
  const [gx, gz] = toGrid(field, x, z)
  const c0 = Math.min(Math.floor(gx), field.segments - 1)
  const r0 = Math.min(Math.floor(gz), field.segments - 1)
  const tx = gx - c0
  const tz = gz - r0
  const { heights, resolution: n } = field

  const h00 = heights[r0 * n + c0]
  const h10 = heights[r0 * n + c0 + 1]
  const h01 = heights[(r0 + 1) * n + c0]
  const h11 = heights[(r0 + 1) * n + c0 + 1]
  return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz)
}

/** Нормаль поверхні центральними різницями; повертає одиничний вектор [x, y, z]. */
export function sampleNormal(field: HeightField, x: number, z: number): Vec3 {
  const e = field.step
  const dx = sampleHeight(field, x + e, z) - sampleHeight(field, x - e, z)
  const dz = sampleHeight(field, x, z + e) - sampleHeight(field, x, z - e)
  const length = Math.hypot(dx, 2 * e, dz)
  return [-dx / length, (2 * e) / length, -dz / length]
}

/**
 * Нормаль у вершині сітки (col, row) центральними різницями сусідніх висот
 * (на краях — односторонніми). Залежить лише від 4 сусідів, тому після мазка
 * пензля нормалі достатньо перерахувати в прямокутнику змін + 1 вершина.
 */
export function gridNormal(field: HeightField, col: number, row: number, out: Vec3 = [0, 0, 0]): Vec3 {
  const { heights, resolution: n, segments, step } = field
  const left = Math.max(col - 1, 0)
  const right = Math.min(col + 1, segments)
  const up = Math.max(row - 1, 0)
  const down = Math.min(row + 1, segments)
  const dhdx = (heights[row * n + right] - heights[row * n + left]) / ((right - left) * step)
  const dhdz = (heights[down * n + col] - heights[up * n + col]) / ((down - up) * step)
  const length = Math.hypot(dhdx, 1, dhdz)
  out[0] = -dhdx / length
  out[1] = 1 / length
  out[2] = -dhdz / length
  return out
}

/**
 * Пензель тераформінгу: піднімає (amount > 0) або опускає (amount < 0) рельєф
 * з плавним спадом до країв. Мутує field.heights на місці.
 * Повертає прямокутник змінених вершин або null.
 */
export function applyBrush(field: HeightField, x: number, z: number, radius: number, amount: number): GridRect | null {
  if (amount === 0 || radius <= 0) return null
  const [gx, gz] = toGrid(field, x, z)
  const r = radius / field.step
  const colMin = Math.max(0, Math.floor(gx - r))
  const colMax = Math.min(field.segments, Math.ceil(gx + r))
  const rowMin = Math.max(0, Math.floor(gz - r))
  const rowMax = Math.min(field.segments, Math.ceil(gz + r))
  const { heights, resolution: n } = field
  let changed = false

  for (let row = rowMin; row <= rowMax; row++) {
    for (let col = colMin; col <= colMax; col++) {
      const d = Math.hypot(col - gx, row - gz) / r
      if (d >= 1) continue
      const falloff = (1 - d * d) ** 2
      const index = row * n + col
      const next = clamp(heights[index] + amount * falloff, field.minHeight, field.maxHeight)
      if (next !== heights[index]) {
        heights[index] = next
        changed = true
      }
    }
  }

  return changed ? { colMin, colMax, rowMin, rowMax } : null
}

/** Об'єднання двох прямокутників (null — порожній). */
export function unionRect(a: GridRect | null, b: GridRect | null): GridRect | null {
  if (!a) return b
  if (!b) return a
  return {
    colMin: Math.min(a.colMin, b.colMin),
    colMax: Math.max(a.colMax, b.colMax),
    rowMin: Math.min(a.rowMin, b.rowMin),
    rowMax: Math.max(a.rowMax, b.rowMax),
  }
}

/** Розширює прямокутник на margin вершин в усі боки, не виходячи за межі сітки. */
export function expandRect(field: HeightField, rect: GridRect, margin: number): GridRect {
  return {
    colMin: Math.max(0, rect.colMin - margin),
    colMax: Math.min(field.segments, rect.colMax + margin),
    rowMin: Math.max(0, rect.rowMin - margin),
    rowMax: Math.min(field.segments, rect.rowMax + margin),
  }
}

/** Прямокутник усієї сітки. */
export const fullRect = (field: HeightField): GridRect => ({
  colMin: 0,
  colMax: field.segments,
  rowMin: 0,
  rowMax: field.segments,
})

/**
 * Висоти у форматі HeightfieldCollider Rapier: матриця column-major,
 * де рядки йдуть уздовж Z, а стовпці — уздовж X. Наша сітка row-major,
 * тож це транспонування. Rapier розбиває клітинку тією ж діагоналлю,
 * що й наш меш (з (x+1, z) до (x, z+1)), тому колайдер точно збігається з видимим рельєфом.
 */
export function toRapierHeights(field: HeightField): number[] {
  const { heights, resolution: n } = field
  const result = new Array<number>(n * n)
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      result[col * n + row] = heights[row * n + col]
    }
  }
  return result
}

type Rgb = [number, number, number]

const SAND_WET: Rgb = [0.62, 0.53, 0.36]
const SAND: Rgb = [0.91, 0.82, 0.58]
const GRASS: Rgb = [0.4, 0.64, 0.25]
const GRASS_DARK: Rgb = [0.24, 0.47, 0.18]
const ROCK: Rgb = [0.52, 0.5, 0.46]
const PEAK: Rgb = [0.78, 0.76, 0.72]

function mix(a: Rgb, b: Rgb, t: number, out: Rgb): Rgb {
  out[0] = lerp(a[0], b[0], t)
  out[1] = lerp(a[1], b[1], t)
  out[2] = lerp(a[2], b[2], t)
  return out
}

const grassScratch: Rgb = [0, 0, 0]

/**
 * Колір рельєфу (sRGB, 0..1) за висотою над водою, крутизною схилу (y нормалі)
 * і шумовою варіацією 0..1. Пише в out, щоб не створювати масиви для кожної вершини.
 */
export function terrainColor(height: number, normalY: number, variation: number, config: TerrainConfig, out: Rgb = [0, 0, 0]): Rgb {
  const grass = mix(GRASS, GRASS_DARK, variation, grassScratch)
  mix(SAND_WET, SAND, smoothstep(-1.2, 0.1, height), out)
  mix(out, grass, smoothstep(config.sandLevel - 0.15, config.sandLevel + 0.25, height), out)
  mix(out, ROCK, smoothstep(config.rockLevel - 0.8, config.rockLevel + 0.4, height), out)
  mix(out, PEAK, smoothstep(config.rockLevel + 1.5, config.rockLevel + 3, height), out)
  // Круті схили — оголена порода незалежно від висоти (крім пляжу).
  if (height > config.sandLevel) {
    const steep = 1 - smoothstep(config.steepSlope - 0.08, config.steepSlope + 0.05, normalY)
    mix(out, ROCK, steep, out)
  }
  return out
}
