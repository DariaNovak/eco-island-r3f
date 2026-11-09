import { ENTITY_TYPES, WORLD, entitySpec, isEntityType, type EntityType, type EntityVariant, type Vec3 } from '../config'
import { range, pick, type Rng } from './random'
import { sampleHeight, sampleNormal, type HeightField } from './terrain'

/** Мінімальна висота над водою, щоб об'єкт вважався «на суші». */
const SHORE_MARGIN = 0.15

/**
 * Опис об'єкта острова. Усі випадкові параметри визначаються один раз
 * при створенні — компоненти лише відображають їх.
 * Позиція — лише стартова: далі тілом керує фізичний рушій.
 */
export type IslandEntity = {
  [T in EntityType]: {
    id: number
    type: T
    variant: EntityVariant<T>
    position: Vec3
    rotationY: number
    scale: number
    /** Фаза для анімацій (гойдання, стрибки), щоб об'єкти не рухались синхронно. */
    phase: number
    /** Об'єкт програє анімацію зникнення і буде видалений. */
    removing?: boolean
  }
}[EntityType]

export type PlacementCheck = { ok: true } | { ok: false; reason: string }

/**
 * Перевірка, чи можна поставити об'єкт типу type у точку з висотою y
 * і y-компонентою нормалі normalY.
 */
export function validatePlacement(type: string, y: number, normalY: number, waterLevel: number = WORLD.waterLevel): PlacementCheck {
  if (!isEntityType(type)) return { ok: false, reason: 'Невідомий тип об\'єкта' }
  const spec = entitySpec(type)
  if (!spec.allowUnderwater && y < waterLevel + SHORE_MARGIN) {
    return { ok: false, reason: 'Тут вода — оберіть сушу' }
  }
  if (normalY < spec.minNormalY) {
    return { ok: false, reason: 'Схил занадто крутий' }
  }
  return { ok: true }
}

/** Опис нового об'єкта з випадковими варіантом, масштабом і поворотом. */
export function createEntity(id: number, type: EntityType, position: Vec3, rng: Rng): IslandEntity {
  const spec = ENTITY_TYPES[type]
  // TS не пов'язує type і variant через індексований доступ, тож збираємо об'єкт явно.
  return {
    id,
    type,
    variant: pick<string>(rng, spec.variants),
    position,
    rotationY: range(rng, 0, Math.PI * 2),
    scale: range(rng, spec.scale[0], spec.scale[1]),
    phase: range(rng, 0, Math.PI * 2),
  } as IslandEntity
}

/** Випадкова точка [x, z] на острові, придатна для типу type, або null. */
export function randomPlacement(field: HeightField, type: EntityType, rng: Rng, tries = 40): [number, number] | null {
  const half = (field.size / 2) * 0.9
  for (let i = 0; i < tries; i++) {
    const x = range(rng, -half, half)
    const z = range(rng, -half, half)
    const y = sampleHeight(field, x, z)
    if (validatePlacement(type, y, sampleNormal(field, x, z)[1]).ok && y > WORLD.waterLevel + 0.3) {
      return [x, z]
    }
  }
  return null
}

/**
 * Стартове наповнення острова. counts — { tree: 20, rock: 8, ... }.
 * Об'єкти з'являються трохи над поверхнею і «осідають» під дією фізики.
 */
export function populateIsland(
  field: HeightField,
  counts: Partial<Record<EntityType, number>>,
  rng: Rng,
  nextId: () => number,
): IslandEntity[] {
  const entities: IslandEntity[] = []
  for (const [type, count = 0] of Object.entries(counts) as [EntityType, number | undefined][]) {
    for (let i = 0; i < count; i++) {
      const spot = randomPlacement(field, type, rng)
      if (!spot) continue
      const [x, z] = spot
      entities.push(createEntity(nextId(), type, [x, sampleHeight(field, x, z) + 0.6, z], rng))
    }
  }
  return entities
}
