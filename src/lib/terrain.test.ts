import { describe, expect, it } from 'vitest'
import { TERRAIN, WORLD } from '../config'
import RAPIER from '@dimforge/rapier3d-compat'
import { applyBrush, createHeightField, expandRect, gridNormal, sampleHeight, sampleNormal, terrainColor, toRapierHeights, unionRect, type HeightField } from './terrain'

const field = () => createHeightField(TERRAIN, WORLD.seed)

describe('createHeightField', () => {
  it('детермінований для однакового сіду', () => {
    expect(field().heights).toEqual(field().heights)
    expect(createHeightField(TERRAIN, 1).heights).not.toEqual(field().heights)
  })

  it('утворює острів: суша в центрі, море на краях', () => {
    const f = field()
    expect(sampleHeight(f, 0, 0)).toBeGreaterThan(WORLD.waterLevel)
    const edge = TERRAIN.size / 2
    for (const [x, z] of [[edge, 0], [-edge, 0], [0, edge], [0, -edge]]) {
      expect(sampleHeight(f, x, z)).toBeLessThan(WORLD.waterLevel)
    }
  })

  it('усі висоти в межах [minHeight, maxHeight]', () => {
    const { heights } = field()
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(TERRAIN.minHeight)
    expect(Math.max(...heights)).toBeLessThanOrEqual(TERRAIN.maxHeight)
  })
})

describe('sampleHeight', () => {
  it('у вузлах сітки повертає точну висоту вершини', () => {
    const f = field()
    const col = 40
    const row = 70
    const x = -f.size / 2 + col * f.step
    const z = -f.size / 2 + row * f.step
    expect(sampleHeight(f, x, z)).toBeCloseTo(f.heights[row * f.resolution + col], 5)
  })

  it('між вузлами інтерполює лінійно', () => {
    const f = field()
    const x = -f.size / 2 + 10.5 * f.step
    const z = -f.size / 2 + 20 * f.step
    const a = f.heights[20 * f.resolution + 10]
    const b = f.heights[20 * f.resolution + 11]
    expect(sampleHeight(f, x, z)).toBeCloseTo((a + b) / 2, 5)
  })

  it('за межами карти не падає, а бере значення краю', () => {
    expect(Number.isFinite(sampleHeight(field(), 1000, -1000))).toBe(true)
  })
})

describe('sampleNormal', () => {
  it('повертає одиничний вектор, що дивиться вгору', () => {
    const [x, y, z] = sampleNormal(field(), 3, -2)
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6)
    expect(y).toBeGreaterThan(0)
  })
})

describe('applyBrush', () => {
  it('піднімає центр сильніше, ніж край пензля, і не чіпає точки поза радіусом', () => {
    const f = field()
    const before = Float32Array.from(f.heights)
    const rect = applyBrush(f, 0, 0, 4, 1)
    expect(rect).not.toBeNull()

    const n = f.resolution
    const center = (f.segments / 2) * n + f.segments / 2
    const nearEdge = center + Math.round(3 / f.step)
    const outside = center + Math.round(6 / f.step)
    const delta = (i: number) => f.heights[i] - before[i]
    expect(delta(center)).toBeCloseTo(1, 5)
    expect(delta(nearEdge)).toBeGreaterThan(0)
    expect(delta(nearEdge)).toBeLessThan(delta(center))
    expect(delta(outside)).toBe(0)
  })

  it('опускає рельєф при від\'ємній силі і поважає межі висот', () => {
    const f = field()
    applyBrush(f, 0, 0, 3, -100)
    expect(sampleHeight(f, 0, 0)).toBe(TERRAIN.minHeight)
    applyBrush(f, 0, 0, 3, 1000)
    expect(sampleHeight(f, 0, 0)).toBe(TERRAIN.maxHeight)
  })

  it('повертає null, якщо нічого не змінилось', () => {
    const f = field()
    expect(applyBrush(f, 0, 0, 3, 0)).toBeNull()
    applyBrush(f, 0, 0, 3, 1000)
    expect(applyBrush(f, 0, 0, 0.1, 1)).toBeNull()
  })
})

describe('terrainColor', () => {
  it('пісок біля води, трава вище, камінь на крутих схилах', () => {
    const sand = terrainColor(0.1, 1, 0, TERRAIN)
    const grass = terrainColor(2, 1, 0, TERRAIN)
    const cliff = terrainColor(2, 0.4, 0, TERRAIN)
    // Трава зелена: G домінує; пісок жовтий: R > B; скеля сіра: канали близькі.
    expect(grass[1]).toBeGreaterThan(grass[0])
    expect(sand[0]).toBeGreaterThan(sand[2])
    expect(Math.abs(cliff[0] - cliff[1])).toBeLessThan(0.05)
  })
})

describe('gridNormal', () => {
  it('на рівній поверхні дивиться прямо вгору', () => {
    const f = field()
    f.heights.fill(1)
    expect(gridNormal(f, 10, 10)).toEqual([-0, 1, -0])
  })

  it('нахиляється проти зростання висоти й близька до sampleNormal у вузлах', () => {
    const f = field()
    // Площина h = 0.5·x: нормаль має дивитись у −X.
    for (let row = 0; row < f.resolution; row++) {
      for (let col = 0; col < f.resolution; col++) {
        f.heights[row * f.resolution + col] = 0.5 * (-f.size / 2 + col * f.step)
      }
    }
    const [nx, ny, nz] = gridNormal(f, 20, 30)
    expect(nx).toBeLessThan(0)
    expect(nz).toBeCloseTo(0, 6)
    expect(Math.hypot(nx, ny, nz)).toBeCloseTo(1, 6)
    expect(ny).toBeCloseTo(1 / Math.hypot(0.5, 1), 5)
    // На краю сітки одностороння різниця дає той самий нахил.
    expect(gridNormal(f, 0, 0)[1]).toBeCloseTo(ny, 5)
  })
})

describe('unionRect і expandRect', () => {
  it('об\'єднують ділянки змін і не виходять за межі сітки', () => {
    const f = field()
    const a = { colMin: 2, colMax: 5, rowMin: 10, rowMax: 12 }
    const b = { colMin: 4, colMax: 9, rowMin: 1, rowMax: 3 }
    expect(unionRect(null, a)).toBe(a)
    expect(unionRect(a, null)).toBe(a)
    expect(unionRect(a, b)).toEqual({ colMin: 2, colMax: 9, rowMin: 1, rowMax: 12 })
    expect(expandRect(f, { colMin: 0, colMax: f.segments, rowMin: 5, rowMax: 6 }, 1)).toEqual({
      colMin: 0,
      colMax: f.segments,
      rowMin: 4,
      rowMax: 7,
    })
  })
})

/** Висота на трикутниках меша (діагональ від (x+1, z) до (x, z+1), як у buildTerrainGeometry). */
function meshHeight(f: HeightField, x: number, z: number) {
  const gx = (x + f.size / 2) / f.step
  const gz = (z + f.size / 2) / f.step
  const col = Math.floor(gx)
  const row = Math.floor(gz)
  const u = gx - col
  const v = gz - row
  const n = f.resolution
  const h00 = f.heights[row * n + col]
  const h10 = f.heights[row * n + col + 1]
  const h01 = f.heights[(row + 1) * n + col]
  const h11 = f.heights[(row + 1) * n + col + 1]
  return u + v <= 1
    ? h00 + u * (h10 - h00) + v * (h01 - h00)
    : h11 + (1 - u) * (h01 - h11) + (1 - v) * (h10 - h11)
}

describe('toRapierHeights', () => {
  it('транспонує сітку в column-major порядок', () => {
    const f = field()
    const n = f.resolution
    const out = toRapierHeights(f)
    expect(out).toHaveLength(n * n)
    expect(out[7 * n + 3]).toBe(f.heights[3 * n + 7])
  })

  it('HeightfieldCollider Rapier збігається з поверхнею рельєфу', async () => {
    await RAPIER.init()
    const f = field()
    applyBrush(f, 5, -3, 4, 2) // несиметричний горб, щоб помилка орієнтації була помітна
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    world.createCollider(
      RAPIER.ColliderDesc.heightfield(f.segments, f.segments, new Float32Array(toRapierHeights(f)), { x: f.size, y: 1, z: f.size }),
    )
    world.step()
    const top = 50
    for (const [x, z] of [[5, -3], [3.3, -1.7], [-8.2, 6.1], [0.13, 0.37], [12, 4]]) {
      const hit = world.castRay(new RAPIER.Ray({ x, y: top, z }, { x: 0, y: -1, z: 0 }), 100, true)
      expect(hit).not.toBeNull()
      expect(top - (hit?.timeOfImpact ?? 0)).toBeCloseTo(meshHeight(f, x, z), 4)
    }
    world.free()
  })
})
