import type { ComponentType } from 'react'
import type { EntityType, EntityVariant } from '../../config'
import {
  AnimalCollider,
  AnimalVisual,
  HouseCollider,
  HouseVisual,
  RockCollider,
  RockVisual,
  TreeCollider,
  TreeVisual,
  type ColliderProps,
  type VisualProps,
} from './models'

type Rotations = [x: boolean, y: boolean, z: boolean]

export interface ModelDefinition<V extends string> {
  Visual: ComponentType<VisualProps<V>>
  Collider: ComponentType<ColliderProps<V>>
  rotations: Rotations
}

/**
 * Реєстр типів: візуал, колайдер і які осі обертання дозволені фізиці.
 * Дерева, тварини та будинки не перекидаються (лише обертання навколо Y),
 * а каміння котиться вільно.
 */
export const MODELS: { [T in EntityType]: ModelDefinition<EntityVariant<T>> } = {
  tree: { Visual: TreeVisual, Collider: TreeCollider, rotations: [false, true, false] },
  rock: { Visual: RockVisual, Collider: RockCollider, rotations: [true, true, true] },
  animal: { Visual: AnimalVisual, Collider: AnimalCollider, rotations: [false, true, false] },
  house: { Visual: HouseVisual, Collider: HouseCollider, rotations: [false, true, false] },
}

/**
 * Модель для типу T. TS не може довести, що entity.type і entity.variant
 * узгоджені після індексації MODELS[entity.type], тож звужуємо тип тут, в одному місці:
 * IslandEntity гарантує, що variant належить саме цьому type.
 */
export const modelFor = <T extends EntityType>(type: T) =>
  MODELS[type] as unknown as ModelDefinition<EntityVariant>
