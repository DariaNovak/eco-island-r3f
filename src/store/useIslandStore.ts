import { create } from 'zustand'
import { SPAWN, TERRAIN, TIME, TOOLS, WORLD, isEntityType, isToolKey, isWeatherKey, WEATHER_KEYS, type ToolKey, type WeatherKey } from '../config'
import { clamp } from '../lib/math'
import { createRng, range } from '../lib/random'
import { createHeightField, sampleHeight, type HeightField } from '../lib/terrain'
import { wrapHour } from '../lib/dayCycle'
import { createEntity, populateIsland, randomPlacement, validatePlacement, type IslandEntity } from '../lib/placement'
import { environment } from './runtime'

let lastId = 0
const nextId = () => ++lastId
let lastToastId = 0

function buildIsland(seed: number) {
  const field = createHeightField(TERRAIN, seed)
  const entities = populateIsland(field, SPAWN.initial, createRng(seed + 1), nextId)
  return { field, entities }
}

const initial = buildIsland(WORLD.seed)

export interface Toast {
  id: number
  text: string
}

export interface IslandState {
  field: HeightField
  /** Збільшується після кожного мазка пензля — колайдер і шейдер води оновлюються. */
  terrainVersion: number
  entities: IslandEntity[]

  tool: ToolKey
  dropHeight: number
  weather: WeatherKey
  autoTime: boolean
  timeSpeed: number
  physicsPaused: boolean
  showColliders: boolean
  /** Користувач тримає кнопку миші з пензлем — камера в цей час заблокована. */
  sculpting: boolean
  cameraResetToken: number
  toast: Toast | null

  setTool: (tool: string) => void
  setDropHeight: (value: number) => void
  setWeather: (weather: string) => void
  cycleWeather: () => void
  toggleAutoTime: () => void
  setTimeSpeed: (timeSpeed: number) => void
  /** Час доби — частина transient-стану, тому пишемо прямо в environment. */
  setHour: (hour: number) => void
  togglePhysics: () => void
  toggleColliders: () => void
  resetCamera: () => void
  notify: (text: string) => void
  dismissToast: (id: number) => void
  /**
   * Висаджує об'єкт поточного інструмента над точкою кліку (результат raycast).
   * Об'єкт з'являється на висоті dropHeight і падає під дією фізики.
   */
  spawnAt: (point: { x: number; y: number; z: number }, normalY: number) => void
  /** Позначає об'єкт на видалення — спершу програється анімація зникнення. */
  markForRemoval: (id: number) => void
  removeEntity: (id: number) => void
  clearEntities: () => void
  /** «Камінепад»: кілька каменів падають з великої висоти у випадкові точки. */
  rockfall: () => void
  /** Новий острів з випадковим сідом. */
  regenerateIsland: () => void
  beginSculpt: () => void
  /** Кінець мазка: фіксуємо нову версію рельєфу (перебудова колайдера тощо). */
  endSculpt: () => void
  heightAt: (x: number, z: number) => number
}

/**
 * Глобальний стан застосунку.
 *
 * Реактивні значення (інструмент, погода, список об'єктів) спричиняють ре-рендер
 * лише підписаних компонентів. Карта висот field — великий Float32Array, який
 * мутується пензлем на місці; про зміну рельєфу сигналізує лічильник terrainVersion.
 * Позиції об'єктів живуть у фізичному рушії, а в сторі — лише стартові параметри.
 */
export const useIslandStore = create<IslandState>()((set, get) => ({
  field: initial.field,
  terrainVersion: 0,
  entities: initial.entities,

  tool: 'tree',
  dropHeight: SPAWN.defaultDropHeight,
  weather: 'clear',
  autoTime: true,
  timeSpeed: 1,
  physicsPaused: false,
  showColliders: false,
  sculpting: false,
  cameraResetToken: 0,
  toast: null,

  setTool: (tool) => {
    if (isToolKey(tool)) set({ tool })
  },
  setDropHeight: (value) =>
    set({ dropHeight: clamp(value, SPAWN.minDropHeight, SPAWN.maxDropHeight) }),

  setWeather: (weather) => {
    if (isWeatherKey(weather)) set({ weather })
  },
  cycleWeather: () =>
    set((s) => ({ weather: WEATHER_KEYS[(WEATHER_KEYS.indexOf(s.weather) + 1) % WEATHER_KEYS.length] })),

  toggleAutoTime: () => set((s) => ({ autoTime: !s.autoTime })),
  setTimeSpeed: (timeSpeed) => {
    if (TIME.speeds.includes(timeSpeed)) set({ timeSpeed })
  },
  setHour: (hour) => {
    environment.hour = wrapHour(hour)
  },

  togglePhysics: () => set((s) => ({ physicsPaused: !s.physicsPaused })),
  toggleColliders: () => set((s) => ({ showColliders: !s.showColliders })),
  resetCamera: () => set((s) => ({ cameraResetToken: s.cameraResetToken + 1 })),

  notify: (text) => set({ toast: { id: ++lastToastId, text } }),
  dismissToast: (id) => set((s) => (s.toast?.id === id ? { toast: null } : s)),

  spawnAt: (point, normalY) => {
    const { tool, entities, dropHeight, notify } = get()
    if (TOOLS[tool].kind !== 'spawn' || !isEntityType(tool)) return
    if (entities.length >= WORLD.maxEntities) {
      notify(`Досягнуто ліміту ${WORLD.maxEntities} об'єктів`)
      return
    }
    const check = validatePlacement(tool, point.y, normalY)
    if (!check.ok) {
      notify(check.reason)
      return
    }
    const entity = createEntity(nextId(), tool, [point.x, point.y + dropHeight, point.z], Math.random)
    set({ entities: [...entities, entity] })
  },

  markForRemoval: (id) =>
    set((s) => ({
      entities: s.entities.map((e) => (e.id === id && !e.removing ? { ...e, removing: true } : e)),
    })),
  removeEntity: (id) => set((s) => ({ entities: s.entities.filter((e) => e.id !== id) })),
  clearEntities: () => set((s) => ({ entities: s.entities.map((e) => ({ ...e, removing: true })) })),

  rockfall: () => {
    const { field, entities } = get()
    const free = WORLD.maxEntities - entities.length
    const count = Math.min(SPAWN.rockfallCount, free)
    const rocks: IslandEntity[] = []
    for (let i = 0; i < count; i++) {
      const spot = randomPlacement(field, 'rock', Math.random)
      if (!spot) continue
      const [x, z] = spot
      const y = SPAWN.rockfallHeight + range(Math.random, 0, 10)
      rocks.push(createEntity(nextId(), 'rock', [x, y, z], Math.random))
    }
    set({ entities: [...entities, ...rocks] })
  },

  regenerateIsland: () => {
    const { field, entities } = buildIsland(Math.floor(Math.random() * 1e9))
    set((s) => ({ field, entities, terrainVersion: s.terrainVersion + 1 }))
  },

  beginSculpt: () => set({ sculpting: true }),
  endSculpt: () => set((s) => ({ sculpting: false, terrainVersion: s.terrainVersion + 1 })),

  heightAt: (x, z) => sampleHeight(get().field, x, z),
}))
