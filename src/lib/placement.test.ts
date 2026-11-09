import { describe, expect, it } from 'vitest'
import { ENTITY_TYPES, SPAWN, TERRAIN, WORLD } from '../config'
import { createEntity, populateIsland, validatePlacement } from './placement'
import { createRng } from './random'
import { createHeightField, sampleHeight } from './terrain'

describe('validatePlacement', () => {
  it('забороняє садити під водою, але дозволяє кидати каміння в море', () => {
    expect(validatePlacement('tree', -1, 1).ok).toBe(false)
    expect(validatePlacement('house', WORLD.waterLevel + 0.05, 1).ok).toBe(false)
    expect(validatePlacement('rock', -1, 1).ok).toBe(true)
  })

  it('будинок потребує рівного місця, дерево — помірного схилу', () => {
    expect(validatePlacement('house', 2, 0.8)).toEqual({ ok: false, reason: 'Схил занадто крутий' })
    expect(validatePlacement('tree', 2, 0.8).ok).toBe(true)
    expect(validatePlacement('tree', 2, 0.5).ok).toBe(false)
  })

  it('невідомий тип відхиляється', () => {
    expect(validatePlacement('dragon', 2, 1).ok).toBe(false)
  })
})

describe('createEntity', () => {
  it('генерує параметри в межах конфігурації і детерміновано для сіду', () => {
    const a = createEntity(1, 'tree', [0, 5, 0], createRng(7))
    const b = createEntity(1, 'tree', [0, 5, 0], createRng(7))
    expect(a).toEqual(b)
    const [min, max] = ENTITY_TYPES.tree.scale
    expect(a.scale).toBeGreaterThanOrEqual(min)
    expect(a.scale).toBeLessThan(max)
    expect(ENTITY_TYPES.tree.variants).toContain(a.variant)
  })
})

describe('populateIsland', () => {
  it('розміщує стартові об\'єкти на суші з унікальними id', () => {
    const field = createHeightField(TERRAIN, WORLD.seed)
    let id = 0
    const entities = populateIsland(field, SPAWN.initial, createRng(1), () => ++id)
    const expected = Object.values(SPAWN.initial).reduce((a, b) => a + b, 0)

    expect(entities.length).toBeGreaterThan(expected * 0.8)
    expect(new Set(entities.map((e) => e.id)).size).toBe(entities.length)
    for (const e of entities) {
      const [x, y, z] = e.position
      expect(sampleHeight(field, x, z)).toBeGreaterThan(WORLD.waterLevel)
      expect(y).toBeGreaterThan(sampleHeight(field, x, z))
    }
  })
})
