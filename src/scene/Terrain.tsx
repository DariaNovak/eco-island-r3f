import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { HeightfieldCollider, RigidBody, useRapier } from '@react-three/rapier'
import { MeshStandardMaterial, type Mesh } from 'three'
import { BRUSH, TOOLS } from '../config'
import { useDisposable } from '../hooks/useDisposable'
import { isCleanClick } from '../lib/math'
import { applyBrush, toRapierHeights, unionRect, type HeightField } from '../lib/terrain'
import { withWeather } from '../shaders/weatherPatch'
import { pendingTerrainEdit } from '../store/runtime'
import { useIslandStore } from '../store/useIslandStore'
import { BrushCursor, type SurfaceHover } from './BrushCursor'
import { buildTerrainGeometry, updateTerrainGeometry } from './terrainGeometry'

const MAX_SCULPT_DELTA = 1 / 30

const createTerrainMaterial = () =>
  withWeather(new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }))

/**
 * Рельєф острова: low-poly меш з карти висот, статичний колайдер Rapier
 * і вся взаємодія з поверхнею через raycasting:
 *  - клік інструментом об'єкта → висадити об'єкт у точку перетину променя;
 *  - затиснута кнопка з пензлем → підняти/опустити рельєф під курсором.
 */
export function Terrain() {
  const field = useIslandStore((s) => s.field)
  const terrainVersion = useIslandStore((s) => s.terrainVersion)
  const sculpting = useIslandStore((s) => s.sculpting)
  const { world } = useRapier()

  const geometry = useMemo(() => buildTerrainGeometry(field), [field])
  useEffect(() => () => geometry.dispose(), [geometry])
  const material = useDisposable(createTerrainMaterial)

  const mesh = useRef<Mesh>(null)
  /** Остання точка перетину курсора з рельєфом (оновлюється в onPointerMove). */
  const hover = useRef<SurfaceHover>({ active: false, x: 0, y: 0, z: 0, normalY: 1 })
  /** Напрямок поточного мазка: +1 підняти, -1 опустити, 0 — пензель не активний. */
  const stroke = useRef(0)

  // Мазок закінчується, де б не відпустили кнопку — навіть за межами острова.
  useEffect(() => {
    if (!sculpting) return
    const stop = () => {
      stroke.current = 0
      useIslandStore.getState().endSculpt()
    }
    window.addEventListener('pointerup', stop)
    return () => window.removeEventListener('pointerup', stop)
  }, [sculpting])

  // Після зміни рельєфу «будимо» сплячі тіла, щоб вони впали в нові ями.
  useEffect(() => {
    world.forEachRigidBody((body) => body.wakeUp())
  }, [terrainVersion, world])

  useFrame((_, delta) => {
    const m = mesh.current
    if (stroke.current === 0 || !hover.current.active || !m) return
    const amount = stroke.current * BRUSH.strength * Math.min(delta, MAX_SCULPT_DELTA)
    const rect = applyBrush(field, hover.current.x, hover.current.z, BRUSH.radius, amount)
    if (!rect) return
    updateTerrainGeometry(m.geometry, field, rect)
    // Вода оновить текстуру глибин лише в цій ділянці (див. Water).
    pendingTerrainEdit.rect = unionRect(pendingTerrainEdit.rect, rect)
  })

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    const h = hover.current
    h.active = true
    h.x = event.point.x
    h.y = event.point.y
    h.z = event.point.z
    h.normalY = event.face?.normal.y ?? 1
  }

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return
    const { tool, beginSculpt } = useIslandStore.getState()
    if (TOOLS[tool].kind !== 'sculpt') return
    event.stopPropagation()
    handlePointerMove(event)
    stroke.current = tool === 'raise' ? 1 : -1
    beginSculpt()
  }

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!isCleanClick(event)) return
    event.stopPropagation()
    useIslandStore.getState().spawnAt(event.point, event.face?.normal.y ?? 1)
  }

  return (
    <>
      <RigidBody type="fixed" colliders={false} friction={1}>
        {/* Новий колайдер після кожного мазка — під час мазка фізика бачить старий рельєф. */}
        <TerrainCollider key={terrainVersion} field={field} />
      </RigidBody>
      <mesh
        ref={mesh}
        geometry={geometry}
        material={material}
        receiveShadow
        castShadow
        onPointerMove={handlePointerMove}
        onPointerOut={() => {
          hover.current.active = false
        }}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      />
      <BrushCursor hover={hover} />
    </>
  )
}

/**
 * Колайдер-карта висот Rapier. На відміну від TrimeshCollider, йому не потрібно
 * будувати дерево пошуку по десятках тисяч трикутників: клітинка під тілом
 * знаходиться прямо за координатами, тож і перебудова після мазка, і зіткнення дешевші.
 */
function TerrainCollider({ field }: { field: HeightField }) {
  const heights = useMemo(() => toRapierHeights(field), [field])
  return (
    <HeightfieldCollider
      args={[field.segments, field.segments, heights, { x: field.size, y: 1, z: field.size }]}
    />
  )
}
