import { useMemo } from 'react'
import type { ThreeElements } from '@react-three/fiber'
import { BallCollider, ConvexHullCollider, CuboidCollider, CylinderCollider } from '@react-three/rapier'
import type { Material } from 'three'
import type { EntityVariant, Vec3 } from '../../config'
import { geometries, materials } from '../assets'

/**
 * Процедурні low-poly моделі. Кожен тип описано парою компонентів:
 *  - Visual — що бачимо (геометрії й матеріали зі спільного assets);
 *  - Collider — явна проста форма для Rapier.
 * Явні колайдери не залежать від анімації масштабу візуальної частини,
 * тому об'єкт фізично «повнорозмірний» з першого кадру падіння.
 */

export interface VisualProps<V extends string> {
  variant: V
}

export interface ColliderProps<V extends string> {
  variant: V
  scale: number
  density: number
}

type PartProps = Omit<ThreeElements['mesh'], 'material'> & { material: Material }

const Part = ({ geometry = geometries.box, material, ...props }: PartProps) => (
  <mesh geometry={geometry} material={material} castShadow receiveShadow {...props} />
)

/* ---------- Дерево ---------- */

export function TreeVisual({ variant }: VisualProps<EntityVariant<'tree'>>) {
  if (variant === 'pine') {
    return (
      <>
        <Part geometry={geometries.trunk} material={materials.bark} />
        <Part geometry={geometries.cone} material={materials.pine} position-y={1.75} scale={[1.15, 1.5, 1.15]} />
        <Part geometry={geometries.cone} material={materials.pine} position-y={2.55} scale={[0.9, 1.3, 0.9]} />
        <Part geometry={geometries.cone} material={materials.pine} position-y={3.25} scale={[0.6, 1.1, 0.6]} />
      </>
    )
  }
  if (variant === 'birch') {
    return (
      <>
        <Part geometry={geometries.birchTrunk} material={materials.birchBark} />
        <Part geometry={geometries.blob} material={materials.birchLeaves} position-y={2.7} scale={[0.85, 1.25, 0.85]} />
      </>
    )
  }
  return (
    <>
      <Part geometry={geometries.trunk} material={materials.bark} />
      <Part geometry={geometries.blob} material={materials.leaves} position-y={2.1} scale={1.05} />
      <Part geometry={geometries.blob} material={materials.leaves} position={[0.55, 2.55, 0.2]} scale={0.6} />
    </>
  )
}

export function TreeCollider({ scale, density }: ColliderProps<EntityVariant<'tree'>>) {
  return (
    <>
      <CylinderCollider args={[0.7 * scale, 0.22 * scale]} position={[0, 0.7 * scale, 0]} density={density} />
      <BallCollider args={[0.9 * scale]} position={[0, 2.3 * scale, 0]} density={density} />
    </>
  )
}

/* ---------- Камінь ---------- */

const ROCK_SHAPES: Record<EntityVariant<'rock'>, Vec3> = {
  grey: [1, 0.75, 0.9],
  mossy: [1.2, 0.6, 1],
  sandstone: [0.9, 0.95, 0.8],
}

export function RockVisual({ variant }: VisualProps<EntityVariant<'rock'>>) {
  return <Part geometry={geometries.rock} material={materials.rock[variant]} scale={ROCK_SHAPES[variant]} />
}

/** Опукла оболонка з вершин того самого додекаедра — камінь котиться, як виглядає. */
export function RockCollider({ variant, scale, density }: ColliderProps<EntityVariant<'rock'>>) {
  const points = useMemo(() => {
    const source = geometries.rock.attributes.position.array
    const [sx, sy, sz] = ROCK_SHAPES[variant]
    const result = new Float32Array(source.length)
    for (let i = 0; i < source.length; i += 3) {
      result[i] = source[i] * sx * scale
      result[i + 1] = source[i + 1] * sy * scale
      result[i + 2] = source[i + 2] * sz * scale
    }
    return result
  }, [variant, scale])
  return <ConvexHullCollider args={[points]} density={density} />
}

/* ---------- Тварина ---------- */

const ANIMAL_LOOK: Record<EntityVariant<'animal'>, { body: Material; head: Material; bodyScale: Vec3 }> = {
  sheep: { body: materials.wool, head: materials.hoof, bodyScale: [0.8, 0.6, 1.05] },
  fox: { body: materials.fox, head: materials.fox, bodyScale: [0.55, 0.5, 1.0] },
  pig: { body: materials.pig, head: materials.pig, bodyScale: [0.75, 0.6, 1.0] },
}

const LEGS: [number, number][] = [
  [-0.22, 0.32],
  [0.22, 0.32],
  [-0.22, -0.32],
  [0.22, -0.32],
]

export function AnimalVisual({ variant }: VisualProps<EntityVariant<'animal'>>) {
  const look = ANIMAL_LOOK[variant]
  const isSheep = variant === 'sheep'
  return (
    <>
      <Part geometry={isSheep ? geometries.blob : geometries.box} material={look.body}
        position-y={0.62} scale={isSheep ? (look.bodyScale.map((v) => v * 0.6) as Vec3) : look.bodyScale} />
      <Part material={look.head} position={[0, 0.85, 0.55]} scale={[0.34, 0.32, 0.38]} />
      {variant === 'fox' && (
        <>
          <Part geometry={geometries.cone} material={materials.fox} position={[-0.1, 1.08, 0.55]} scale={[0.07, 0.16, 0.07]} />
          <Part geometry={geometries.cone} material={materials.fox} position={[0.1, 1.08, 0.55]} scale={[0.07, 0.16, 0.07]} />
          <Part geometry={geometries.cone} material={materials.wool} position={[0, 0.6, -0.65]} scale={[0.12, 0.45, 0.12]} rotation-x={-1.9} />
        </>
      )}
      {variant === 'pig' && <Part material={materials.pig} position={[0, 0.8, 0.77]} scale={[0.16, 0.12, 0.08]} />}
      {LEGS.map(([x, z]) => (
        <Part key={`${x}${z}`} material={materials.hoof} position={[x, 0.17, z]} scale={[0.12, 0.34, 0.12]} />
      ))}
    </>
  )
}

export function AnimalCollider({ scale, density }: ColliderProps<EntityVariant<'animal'>>) {
  return (
    <CuboidCollider
      args={[0.32 * scale, 0.42 * scale, 0.55 * scale]}
      position={[0, 0.42 * scale, 0]}
      density={density}
    />
  )
}

/* ---------- Будинок ---------- */

export function HouseVisual({ variant }: VisualProps<EntityVariant<'house'>>) {
  return (
    <>
      <Part material={materials.walls[variant]} position-y={0.8} scale={[2, 1.6, 2]} />
      <Part geometry={geometries.roof} material={materials.roof} position-y={2.15} scale={[1.75, 1.1, 1.75]} />
      <Part material={materials.door} position={[0, 0.45, 1.01]} scale={[0.45, 0.9, 0.04]} />
      <Part material={materials.window} position={[-0.6, 1.0, 1.01]} scale={[0.4, 0.4, 0.04]} castShadow={false} />
      <Part material={materials.window} position={[0.6, 1.0, 1.01]} scale={[0.4, 0.4, 0.04]} castShadow={false} />
      <Part material={materials.window} position={[1.01, 1.0, 0]} scale={[0.04, 0.4, 0.5]} castShadow={false} />
      <Part material={materials.roof} position={[0.55, 2.35, -0.4]} scale={[0.25, 0.6, 0.25]} />
    </>
  )
}

export function HouseCollider({ scale, density }: ColliderProps<EntityVariant<'house'>>) {
  return <CuboidCollider args={[scale, 1.2 * scale, scale]} position={[0, 1.2 * scale, 0]} density={density} />
}
