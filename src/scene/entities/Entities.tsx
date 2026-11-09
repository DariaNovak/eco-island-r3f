import { useIslandStore } from '../../store/useIslandStore'
import { Entity } from './Entity'

/** Усі об'єкти острова. Entity обгорнутий у memo — додавання одного не перерендерює решту. */
export function Entities() {
  const entities = useIslandStore((s) => s.entities)
  return entities.map((entity) => <Entity key={entity.id} entity={entity} />)
}
