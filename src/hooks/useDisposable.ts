import { useEffect, useState } from 'react'

/**
 * Створює ресурс Three.js (геометрію, матеріал) один раз за життя компонента
 * і звільняє пам'ять GPU при демонтуванні.
 *
 * Змінювати ресурс у кадрі слід через ref на меш (mesh.current.material),
 * а не через повернуте значення — так вимагають правила React Compiler.
 */
export function useDisposable<T extends { dispose?: () => void }>(factory: () => T): T {
  const [resource] = useState(factory)
  useEffect(() => () => resource.dispose?.(), [resource])
  return resource
}
