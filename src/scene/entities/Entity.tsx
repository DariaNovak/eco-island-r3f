import { memo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import { RigidBody, useBeforePhysicsStep, type RapierRigidBody } from '@react-three/rapier'
import { Quaternion, Vector3, type Group } from 'three'
import { ANIMAL, ENTITY_TYPES, ENVIRONMENT, PHYSICS, SPAWN, WORLD } from '../../config'
import { hopImpulse, planHop } from '../../lib/animals'
import { clamp, damp, easeOutBack, easeOutCubic, isCleanClick } from '../../lib/math'
import { buoyancyForce } from '../../lib/physics'
import type { IslandEntity } from '../../lib/placement'
import { range } from '../../lib/random'
import { addRipple } from '../../lib/ripples'
import { useIslandStore } from '../../store/useIslandStore'
import { environment, ripples } from '../../store/runtime'
import { modelFor } from './registry'

const MAX_DELTA = 0.1
const Y_AXIS = new Vector3(0, 1, 0)
const rotation = new Quaternion()
const force = { x: 0, y: 0, z: 0 }

/** Змінний стан анімацій одного об'єкта (у ref, бо змінюється щокадру). */
interface AnimationState {
  appear: number
  remove: number
  removed: boolean
  landed: boolean
  squash: number
  growth: number
  inWater: boolean
  damping: number
  heading: number
  hopTimer: number
}

/**
 * Один об'єкт острова: динамічне тіло Rapier + процедурна модель.
 *
 * Фізика (до кроку симуляції): сила Архімеда і знос вітром у воді.
 * Кадр (useFrame): анімація появи (масштаб + оберт), «сплющення» при приземленні,
 * гойдання дерев на вітрі та ріст під дощем, стрибки тварин, бризки при падінні у воду,
 * анімація зникнення перед видаленням.
 */
export const Entity = memo(function Entity({ entity }: { entity: IslandEntity }) {
  const { Visual, Collider, rotations } = modelFor(entity.type)
  const spec = ENTITY_TYPES[entity.type]
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<Group>(null)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  const anim = useRef<AnimationState>({
    appear: 0,
    remove: 0,
    removed: false,
    landed: false,
    squash: 1,
    growth: 1,
    inWater: false,
    damping: PHYSICS.airDamping,
    heading: entity.rotationY,
    hopTimer: ANIMAL.hopIntervalMin + entity.phase / 2,
  })

  useBeforePhysicsStep(() => {
    const b = body.current
    if (!b) return
    b.resetForces(false)
    const depth = WORLD.waterLevel - b.translation().y
    const mass = b.mass()
    const lift = buoyancyForce(mass, depth, spec.height * entity.scale, spec.density, PHYSICS.gravity)

    const damping = depth > 0 ? PHYSICS.waterDamping : PHYSICS.airDamping
    if (damping !== anim.current.damping) {
      anim.current.damping = damping
      b.setLinearDamping(damping)
      b.setAngularDamping(damping)
    }
    if (lift === 0) return

    const drift = environment.wind * PHYSICS.windDrift * mass
    force.x = Math.cos(environment.windAngle) * drift
    force.y = lift
    force.z = Math.sin(environment.windAngle) * drift
    b.addForce(force, true)
  })

  useFrame((_, delta) => {
    const b = body.current
    const v = visual.current
    if (!b || !v) return
    const s = anim.current
    const dt = Math.min(delta, MAX_DELTA)
    const position = b.translation()

    // Поява: пружне збільшення з обертом навколо осі Y.
    s.appear = Math.min(1, s.appear + dt / SPAWN.appearDuration)
    let scale = easeOutBack(s.appear)
    let spin = (1 - easeOutCubic(s.appear)) * Math.PI * 1.5

    if (entity.removing) {
      s.remove = Math.min(1, s.remove + dt / SPAWN.removeDuration)
      scale *= 1 - easeOutCubic(s.remove)
      spin += s.remove * Math.PI
      if (s.remove >= 1) finish(s, entity.id)
    }
    if (position.y < WORLD.killY) finish(s, entity.id)

    // Бризки: перетин поверхні води згори вниз.
    if (!s.inWater && position.y < WORLD.waterLevel) {
      s.inWater = true
      const strength = clamp(Math.abs(b.linvel().y) / 6, 0.3, 1.5)
      addRipple(ripples, position.x, position.z, environment.elapsed, strength)
    } else if (s.inWater && position.y > WORLD.waterLevel + 0.3) {
      s.inWater = false
    }

    if (entity.type === 'tree' && !s.inWater) {
      s.growth = Math.min(
        ENVIRONMENT.maxTreeGrowth,
        s.growth + environment.rain * dt * ENVIRONMENT.treeGrowthPerRainSecond,
      )
    }
    if (entity.type === 'animal' && !entity.removing) hop(b, s, dt)

    s.squash = damp(s.squash, 1, 9, dt)
    const size = scale * entity.scale * s.growth * (hovered ? 1.06 : 1)
    const widen = 1 / Math.sqrt(s.squash)
    v.scale.set(size * widen, size * s.squash, size * widen)
    v.rotation.y = spin

    if (entity.type === 'tree') {
      const t = environment.elapsed * 1.6 + entity.phase
      const sway = environment.wind * 0.06 + environment.storm * 0.05
      v.rotation.x = Math.sin(t) * sway
      v.rotation.z = Math.cos(t * 0.8) * sway
    }
  })

  const handleCollision = () => {
    if (anim.current.landed) return
    anim.current.landed = true
    anim.current.squash = 0.7
  }

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!isCleanClick(event)) return
    event.stopPropagation()
    const { tool, markForRemoval } = useIslandStore.getState()
    if (tool === 'remove') {
      markForRemoval(entity.id)
      return
    }
    // Будь-який інший інструмент «підкидає» об'єкт — фізика в дії.
    const b = body.current
    if (!b) return
    const mass = b.mass()
    b.applyImpulse({ x: range(Math.random, -1, 1) * mass, y: PHYSICS.pokeImpulse * mass, z: range(Math.random, -1, 1) * mass }, true)
    b.applyTorqueImpulse({ x: 0, y: mass * 0.5, z: 0 }, true)
  }

  return (
    <RigidBody
      ref={body}
      position={entity.position}
      rotation={[0, entity.rotationY, 0]}
      colliders={false}
      enabledRotations={rotations}
      ccd={entity.type === 'rock'}
      friction={0.9}
      restitution={entity.type === 'rock' ? 0.25 : 0.05}
      onCollisionEnter={handleCollision}
    >
      <Collider variant={entity.variant} scale={entity.scale} density={spec.density} />
      <group
        ref={visual}
        scale={0}
        onClick={handleClick}
        onPointerOver={(event) => {
          event.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      >
        <Visual variant={entity.variant} />
      </group>
    </RigidBody>
  )
})

/** Видаляє об'єкт зі стору рівно один раз. */
function finish(state: AnimationState, id: number): void {
  if (state.removed) return
  state.removed = true
  useIslandStore.getState().removeEntity(id)
}

/**
 * Стрибки тварин. Вдень тварина час від часу стрибає в новому напрямку,
 * оминаючи воду; вночі спить. У воді «пливе» до берега меншими поштовхами.
 */
function hop(body: RapierRigidBody, state: AnimationState, dt: number): void {
  const { physicsPaused, heightAt } = useIslandStore.getState()
  if (physicsPaused || environment.daylight < 0.25) return
  state.hopTimer -= dt
  if (state.hopTimer > 0 || Math.abs(body.linvel().y) > 0.3) return

  const { x, z } = body.translation()
  state.heading = planHop(x, z, state.heading, Math.random, heightAt, WORLD.waterLevel)
  body.setRotation(rotation.setFromAxisAngle(Y_AXIS, state.heading), true)

  const impulse = hopImpulse(state.heading, body.mass())
  if (state.inWater) impulse.y *= 0.3
  body.applyImpulse(impulse, true)
  state.hopTimer = range(Math.random, ANIMAL.hopIntervalMin, ANIMAL.hopIntervalMax)
}
