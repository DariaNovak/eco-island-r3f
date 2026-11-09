import { type Box3, BufferAttribute, BufferGeometry, Color, Sphere, SRGBColorSpace } from 'three'
import { TERRAIN, type Vec3 } from '../config'
import { expandRect, fullRect, gridNormal, terrainColor, type GridRect, type HeightField } from '../lib/terrain'

/** Детермінована «варіація» кольору для вершини — плямистість трави без текстур. */
function variationAt(col: number, row: number): number {
  const s = Math.sin(col * 12.9898 + row * 78.233) * 43758.5453
  return s - Math.floor(s)
}

const normalScratch: Vec3 = [0, 0, 0]
const colorScratch: Vec3 = [0, 0, 0]
/** terrainColor повертає sRGB, а атрибут color у three — у лінійному просторі. */
const linear = new Color()

/**
 * Перераховує нормалі й кольори вершин у прямокутнику сітки.
 * Нормалі беруться з сусідніх висот (gridNormal), а не через computeVertexNormals,
 * тож вартість пропорційна розміру rect, а не всієї сітки.
 * Матеріал рельєфу має flatShading, тому ці нормалі впливають не на освітлення,
 * а на «крутизну» в кольорі та на сніговий покрив у weatherPatch.
 */
function writeNormalsAndColors(geometry: BufferGeometry, field: HeightField, rect: GridRect): void {
  const n = field.resolution
  const normals = geometry.attributes.normal.array as Float32Array
  const colors = geometry.attributes.color.array as Float32Array
  for (let row = rect.rowMin; row <= rect.rowMax; row++) {
    for (let col = rect.colMin; col <= rect.colMax; col++) {
      const i = row * n + col
      gridNormal(field, col, row, normalScratch)
      normals[i * 3] = normalScratch[0]
      normals[i * 3 + 1] = normalScratch[1]
      normals[i * 3 + 2] = normalScratch[2]

      terrainColor(field.heights[i], normalScratch[1], variationAt(col, row), TERRAIN, colorScratch)
      linear.setRGB(colorScratch[0], colorScratch[1], colorScratch[2], SRGBColorSpace)
      colors[i * 3] = linear.r
      colors[i * 3 + 1] = linear.g
      colors[i * 3 + 2] = linear.b
    }
  }
}

/**
 * Позначає для завантаження на GPU лише неперервний відрізок буфера,
 * що покриває rect (від першої до останньої зміненої вершини), а не весь атрибут.
 */
function markRange(attribute: BufferAttribute, n: number, rect: GridRect): void {
  const first = rect.rowMin * n + rect.colMin
  const last = rect.rowMax * n + rect.colMax
  attribute.addUpdateRange(first * attribute.itemSize, (last - first + 1) * attribute.itemSize)
  attribute.needsUpdate = true
}

/**
 * Будує геометрію рельєфу безпосередньо у світових координатах (без повороту меша),
 * тож нормалі з raycast і вершини для колайдера Rapier збігаються з тим, що бачить користувач.
 */
export function buildTerrainGeometry(field: HeightField): BufferGeometry {
  const { resolution: n, step, size, heights } = field
  const positions = new Float32Array(n * n * 3)
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const i = row * n + col
      positions[i * 3] = -size / 2 + col * step
      positions[i * 3 + 1] = heights[i]
      positions[i * 3 + 2] = -size / 2 + row * step
    }
  }

  const segments = n - 1
  const indices = new Uint32Array(segments * segments * 6)
  let k = 0
  for (let row = 0; row < segments; row++) {
    for (let col = 0; col < segments; col++) {
      const a = row * n + col
      const b = a + 1
      const c = a + n
      const d = c + 1
      // Проти годинникової стрілки, якщо дивитись згори (+Y) — грані дивляться вгору.
      // Діагональ b–c збігається з тріангуляцією HeightfieldCollider у Rapier.
      indices.set([a, c, b, b, c, d], k)
      k += 6
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(n * n * 3), 3))
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(n * n * 3), 3))
  geometry.setIndex(new BufferAttribute(indices, 1))
  writeNormalsAndColors(geometry, field, fullRect(field))
  geometry.computeBoundingBox()
  geometry.boundingSphere = (geometry.boundingBox as Box3).getBoundingSphere(new Sphere())
  return geometry
}

/**
 * Переносить змінені пензлем висоти в геометрію. Уся робота — і на CPU,
 * і завантаження на GPU — обмежена прямокутником rect (+1 вершина для нормалей).
 */
export function updateTerrainGeometry(geometry: BufferGeometry, field: HeightField, rect: GridRect): void {
  const n = field.resolution
  const position = geometry.attributes.position as BufferAttribute
  const positions = position.array as Float32Array
  let low = Infinity
  let high = -Infinity
  for (let row = rect.rowMin; row <= rect.rowMax; row++) {
    for (let col = rect.colMin; col <= rect.colMax; col++) {
      const i = row * n + col
      const h = field.heights[i]
      positions[i * 3 + 1] = h
      if (h < low) low = h
      if (h > high) high = h
    }
  }
  markRange(position, n, rect)

  // Нормаль вершини залежить від сусідів, тож на межі rect вони теж змінились.
  const shaded = expandRect(field, rect, 1)
  writeNormalsAndColors(geometry, field, shaded)
  markRange(geometry.attributes.normal as BufferAttribute, n, shaded)
  markRange(geometry.attributes.color as BufferAttribute, n, shaded)

  // Межі лише розширюємо (без повного проходу по вершинах): консервативна
  // рамка коректна і для відсікання, і для raycast; точна — після нового острова.
  const box = geometry.boundingBox as Box3
  box.min.y = Math.min(box.min.y, low)
  box.max.y = Math.max(box.max.y, high)
  box.getBoundingSphere(geometry.boundingSphere as Sphere)
}
