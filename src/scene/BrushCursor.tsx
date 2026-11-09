import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh, MeshBasicMaterial } from 'three'
import { BRUSH, TOOLS } from '../config'
import { validatePlacement } from '../lib/placement'
import { useIslandStore } from '../store/useIslandStore'

/** Остання точка перетину курсора з рельєфом. */
export interface SurfaceHover {
  active: boolean
  x: number
  y: number
  z: number
  normalY: number
}

const COLORS = {
  valid: '#7dffa1',
  invalid: '#ff6b6b',
  raise: '#ffd166',
  lower: '#6ec3ff',
}
const SPAWN_RADIUS = 0.7
const noRaycast = () => null

/**
 * Приціл під курсором: кільце на поверхні (зелене/червоне — чи можна висадити об'єкт,
 * жовте/блакитне — радіус пензля) і вертикальна лінія до висоти, з якої впаде об'єкт.
 * Позиція береться з hover-ref, який заповнює Terrain, тому ре-рендерів немає.
 */
export function BrushCursor({ hover }: { hover: RefObject<SurfaceHover> }) {
  const ring = useRef<Mesh>(null)
  const ringMaterial = useRef<MeshBasicMaterial>(null)
  const line = useRef<Mesh>(null)
  const lineMaterial = useRef<MeshBasicMaterial>(null)

  useFrame(() => {
    const h = hover.current
    const r = ring.current
    const l = line.current
    const rm = ringMaterial.current
    const lm = lineMaterial.current
    if (!r || !l || !rm || !lm) return
    const { tool, dropHeight } = useIslandStore.getState()
    const kind = TOOLS[tool].kind
    const visible = h.active && kind !== 'remove'
    r.visible = visible
    l.visible = visible && kind === 'spawn'
    if (!visible) return

    r.position.set(h.x, h.y + 0.08, h.z)
    if (tool === 'raise' || tool === 'lower') {
      r.scale.setScalar(BRUSH.radius)
      rm.color.set(COLORS[tool])
      return
    }

    const ok = validatePlacement(tool, h.y, h.normalY).ok
    r.scale.setScalar(SPAWN_RADIUS)
    rm.color.set(ok ? COLORS.valid : COLORS.invalid)
    l.position.set(h.x, h.y + dropHeight / 2, h.z)
    l.scale.set(1, dropHeight, 1)
    lm.color.set(ok ? COLORS.valid : COLORS.invalid)
  })

  return (
    <>
      <mesh ref={ring} rotation-x={-Math.PI / 2} raycast={noRaycast} renderOrder={10} visible={false}>
        <ringGeometry args={[0.85, 1, 48]} />
        <meshBasicMaterial ref={ringMaterial} transparent opacity={0.85} depthTest={false} toneMapped={false} />
      </mesh>
      <mesh ref={line} raycast={noRaycast} renderOrder={10} visible={false}>
        <cylinderGeometry args={[0.025, 0.025, 1, 6]} />
        <meshBasicMaterial ref={lineMaterial} transparent opacity={0.5} depthTest={false} toneMapped={false} />
      </mesh>
    </>
  )
}
