import { Vector3 } from 'three'
import { TIME, WATER } from '../config'
import { createEnvironment } from '../lib/environment'
import { createSkyState } from '../lib/dayCycle'
import { createRippleBuffer } from '../lib/ripples'
import type { GridRect } from '../lib/terrain'

/**
 * Дані, що змінюються щокадру, тримаємо поза React-станом (патерн «transient updates»).
 * EnvironmentDriver оновлює їх першим у кожному кадрі, а освітлення, шейдери
 * та частинки читають значення у своїх useFrame — без жодного ре-рендера.
 */
export const environment = createEnvironment('clear', TIME.start)

/** Кольори неба та світла для поточного часу доби й погоди. */
export const sky = createSkyState()

/** Одиничний вектор на сонце (вночі y < 0). */
export const sunDirection = new Vector3(0, 1, 0)

/** Брижі на воді від кліків, падінь об'єктів і руху камери. */
export const ripples = createRippleBuffer(WATER.maxRipples)

/**
 * Ділянка рельєфу, змінена пензлем, але ще не перенесена в текстуру глибин води.
 * Terrain розширює її після кожного кроку пензля, Water забирає й обнуляє.
 */
export const pendingTerrainEdit: { rect: GridRect | null } = { rect: null }
