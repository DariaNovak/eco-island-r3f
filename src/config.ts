/**
 * Єдине місце для всіх «магічних чисел» світу.
 * Компоненти та чиста логіка імпортують константи звідси, тож баланс
 * симуляції налаштовується без пошуку значень по всьому коду.
 *
 * Тут же оголошено типи, що випливають із конфігурації (ключі погоди,
 * інструментів, типів об'єктів), — додавання нового пресету автоматично
 * розширює відповідний тип.
 */

export type Vec3 = [number, number, number]

export const WORLD = {
  /** Сід генератора — однаковий острів при кожному запуску. */
  seed: 20261025,
  /** Рівень моря. Все, що нижче, — вода. */
  waterLevel: 0,
  /** Нижче цієї висоти тіло вважається загубленим і видаляється. */
  killY: -12,
  /** Межа кількості об'єктів (захист продуктивності фізики). */
  maxEntities: 160,
}

export interface TerrainConfig {
  /** Сторона квадратної ділянки суші, м. */
  size: number
  /** Кількість сегментів сітки на сторону (вершин = segments + 1). */
  segments: number
  /** Радіус острова відносно половини size (0..1). */
  islandRadius: number
  seabed: number
  plateau: number
  hillHeight: number
  noiseScale: number
  noiseOctaves: number
  noiseAmplitude: number
  minHeight: number
  maxHeight: number
  /** Межі кольорових зон (висота над водою). */
  sandLevel: number
  rockLevel: number
  /** Нормаль з y нижче цього — крутий схил, фарбується в камінь. */
  steepSlope: number
}

export const TERRAIN: TerrainConfig = {
  size: 64,
  segments: 128,
  islandRadius: 0.78,
  seabed: -3.2,
  plateau: 1.4,
  hillHeight: 4.6,
  noiseScale: 0.055,
  noiseOctaves: 5,
  noiseAmplitude: 2.2,
  minHeight: -4,
  maxHeight: 10,
  sandLevel: 0.55,
  rockLevel: 4.8,
  steepSlope: 0.78,
}

export const BRUSH = {
  radius: 4.5,
  /** Швидкість підняття/опускання, м/с у центрі пензля. */
  strength: 3.2,
}

export const WATER = {
  size: 320,
  segments: 320,
  baseWaveHeight: 0.08,
  windWaveHeight: 0.32,
  stormWaveHeight: 0.35,
  maxRipples: 8,
  rippleLifetime: 4,
  /** Камера, що рухається швидше за це (м/с), «тривожить» воду. */
  cameraRippleSpeed: 6,
  cameraRippleInterval: 0.35,
  colors: {
    deep: '#0b3d63',
    shallow: '#2fb7b0',
    foam: '#f4fbff',
  },
}

export const CAMERA = {
  position: [34, 22, 34] as Vec3,
  target: [0, 1, 0] as Vec3,
  fov: 45,
  minDistance: 10,
  maxDistance: 95,
  /** Не даємо камері опуститись під воду. */
  maxPolarAngle: Math.PI * 0.46,
}

export const TIME = {
  /** Година на старті. */
  start: 10,
  /** Скільки реальних секунд триває одна доба при швидкості ×1. */
  dayLengthSeconds: 240,
  speeds: [0.5, 1, 2, 4, 8],
}

/** Канали погоди, які плавно змішуються між пресетами. */
export const WEATHER_CHANNELS = ['rain', 'snow', 'fog', 'cloud', 'wind', 'storm'] as const
export type WeatherChannel = (typeof WEATHER_CHANNELS)[number]

export type WeatherPreset = { label: string; icon: string } & Record<WeatherChannel, number>

/**
 * Пресети погоди. Значення 0..1 — цілі, до яких середовище плавно наближається.
 * rain/snow — інтенсивність опадів, fog — туман, cloud — хмарність,
 * wind — сила вітру, storm — гроза (блискавки, високі хвилі).
 */
export const WEATHER = {
  clear: { label: 'Ясно', icon: '☀️', rain: 0, snow: 0, fog: 0.05, cloud: 0.15, wind: 0.2, storm: 0 },
  rain: { label: 'Дощ', icon: '🌧️', rain: 1, snow: 0, fog: 0.3, cloud: 0.8, wind: 0.45, storm: 0 },
  storm: { label: 'Гроза', icon: '⛈️', rain: 1, snow: 0, fog: 0.4, cloud: 1, wind: 1, storm: 1 },
  snow: { label: 'Сніг', icon: '❄️', rain: 0, snow: 1, fog: 0.35, cloud: 0.7, wind: 0.3, storm: 0 },
  fog: { label: 'Туман', icon: '🌫️', rain: 0, snow: 0, fog: 1, cloud: 0.5, wind: 0.05, storm: 0 },
} satisfies Record<string, WeatherPreset>

export type WeatherKey = keyof typeof WEATHER
export const WEATHER_KEYS = Object.keys(WEATHER) as WeatherKey[]
export const isWeatherKey = (key: string): key is WeatherKey => key in WEATHER

export const ENVIRONMENT = {
  /** Швидкість переходу між станами погоди (для MathUtils.damp). */
  blendSpeed: 0.8,
  /** Скільки секунд сильного снігопаду, щоб острів повністю побілів. */
  snowAccumulateSeconds: 25,
  snowMeltSeconds: 18,
  wetSeconds: 6,
  drySeconds: 20,
  /** Середній інтервал між блискавками під час грози, с. */
  lightningInterval: 4,
  /** Скільки секунд дощу потрібно, щоб дерево виросло на 1 (у множнику масштабу). */
  treeGrowthPerRainSecond: 0.004,
  maxTreeGrowth: 1.35,
}

export const PARTICLES = {
  rainCount: 9000,
  snowCount: 5000,
  /** Об'єм навколо острова, в якому падають опади. */
  volume: [90, 36, 90] as Vec3,
  fireflies: 140,
}

export interface PaletteFrame {
  skyTop: string
  skyHorizon: string
  sun: string
  sunIntensity: number
  ambient: number
  hemiSky: string
  hemiGround: string
}

/** Кольори атмосфери в ключових точках доби (за висотою сонця). */
export const PALETTE = {
  night: { skyTop: '#050b1f', skyHorizon: '#14223f', sun: '#8aa6ff', sunIntensity: 0.35, ambient: 0.34, hemiSky: '#3a5088', hemiGround: '#1a2233' },
  twilight: { skyTop: '#28305f', skyHorizon: '#ff9a62', sun: '#ffb27a', sunIntensity: 1.2, ambient: 0.35, hemiSky: '#ffc49c', hemiGround: '#3b2f4a' },
  day: { skyTop: '#2f7fd8', skyHorizon: '#bfe6ff', sun: '#fff4dc', sunIntensity: 2.6, ambient: 0.55, hemiSky: '#cdeaff', hemiGround: '#6f8f4e' },
  /** Колір, до якого «сіріє» небо при хмарності/грозі. */
  overcast: '#7d8794',
} satisfies Record<'night' | 'twilight' | 'day', PaletteFrame> & { overcast: string }

export interface EntityTypeSpec {
  scale: readonly [number, number]
  variants: readonly string[]
  /** Мінімальна y-компонента нормалі поверхні (1 = ідеально рівно). */
  minNormalY: number
  /** Густина відносно води: < 1 — тіло плаває, > 1 — тоне. */
  density: number
  /** Приблизна висота, м (для розрахунку занурення). */
  height: number
  /** Чи можна кидати об'єкт у воду. */
  allowUnderwater?: boolean
}

/** Параметри типів об'єктів: межі масштабу, варіанти, вимоги до місця, фізика. */
export const ENTITY_TYPES = {
  tree: { scale: [0.8, 1.35], variants: ['pine', 'round', 'birch'], minNormalY: 0.7, density: 0.6, height: 3 },
  rock: { scale: [0.5, 1.4], variants: ['grey', 'mossy', 'sandstone'], minNormalY: 0, density: 2.6, height: 1, allowUnderwater: true },
  animal: { scale: [0.8, 1.1], variants: ['sheep', 'fox', 'pig'], minNormalY: 0.6, density: 0.8, height: 1 },
  house: { scale: [0.9, 1.15], variants: ['red', 'blue', 'yellow'], minNormalY: 0.88, density: 0.5, height: 2.4 },
} as const satisfies Record<string, EntityTypeSpec>

export type EntityType = keyof typeof ENTITY_TYPES
export type EntityVariant<T extends EntityType = EntityType> = (typeof ENTITY_TYPES)[T]['variants'][number]
export const ENTITY_TYPE_KEYS = Object.keys(ENTITY_TYPES) as EntityType[]
export const isEntityType = (key: string): key is EntityType => key in ENTITY_TYPES
/** Специфікація типу як EntityTypeSpec (з необов'язковими полями на кшталт allowUnderwater). */
export const entitySpec = (type: EntityType): EntityTypeSpec => ENTITY_TYPES[type]

export type ToolKind = 'spawn' | 'sculpt' | 'remove'

export interface ToolSpec {
  label: string
  icon: string
  kind: ToolKind
  /** KeyboardEvent.code гарячої клавіші. */
  key: string
}

export const TOOLS = {
  tree: { label: 'Дерево', icon: '🌲', kind: 'spawn', key: 'Digit1' },
  rock: { label: 'Камінь', icon: '🪨', kind: 'spawn', key: 'Digit2' },
  animal: { label: 'Тварина', icon: '🐑', kind: 'spawn', key: 'Digit3' },
  house: { label: 'Будинок', icon: '🏠', kind: 'spawn', key: 'Digit4' },
  raise: { label: 'Підняти', icon: '⛰️', kind: 'sculpt', key: 'Digit5' },
  lower: { label: 'Опустити', icon: '🕳️', kind: 'sculpt', key: 'Digit6' },
  remove: { label: 'Видалити', icon: '🧹', kind: 'remove', key: 'Digit7' },
} satisfies Record<EntityType | 'raise' | 'lower' | 'remove', ToolSpec>

export type ToolKey = keyof typeof TOOLS
export const TOOL_KEYS = Object.keys(TOOLS) as ToolKey[]
export const isToolKey = (key: string): key is ToolKey => key in TOOLS

export const PHYSICS = {
  gravity: 9.81,
  /** Опір руху у воді та в повітрі (лінійне згасання Rapier). */
  waterDamping: 1.6,
  airDamping: 0.05,
  /** Сила, з якою течія від вітру зносить плаваючі об'єкти (на кг маси). */
  windDrift: 0.6,
  /** Вертикальний імпульс «підкидання» при кліку по об'єкту (на кг маси). */
  pokeImpulse: 5,
}

export const SPAWN = {
  defaultDropHeight: 6,
  minDropHeight: 0.5,
  maxDropHeight: 20,
  appearDuration: 0.7,
  removeDuration: 0.35,
  /** Кількість об'єктів на острові при старті. */
  initial: { tree: 26, rock: 10, animal: 6, house: 3 } satisfies Partial<Record<EntityType, number>>,
  rockfallCount: 10,
  rockfallHeight: 28,
}

export interface AnimalConfig {
  hopIntervalMin: number
  hopIntervalMax: number
  hopImpulseUp: number
  hopImpulseForward: number
  /** Тварина «бачить» воду на такій відстані попереду й розвертається. */
  lookAhead: number
  maxTurn: number
}

export const ANIMAL: AnimalConfig = {
  hopIntervalMin: 1.2,
  hopIntervalMax: 3.5,
  hopImpulseUp: 2.6,
  hopImpulseForward: 1.6,
  lookAhead: 2.5,
  maxTurn: Math.PI * 0.6,
}
