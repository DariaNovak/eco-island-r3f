import { Color } from 'three'
import { PALETTE, type PaletteFrame, type Vec3 } from '../config'
import { smoothstep } from './math'

/**
 * Астрономія іграшкового світу: сонце сходить о 6:00 на сході (+X),
 * у зеніті о 12:00, заходить о 18:00. Нахил по Z дає довші тіні.
 */
const TILT = 0.35

export function sunDirection(hour: number, out: Vec3 = [0, 0, 0]): Vec3 {
  const angle = ((hour - 6) / 24) * Math.PI * 2
  const x = Math.cos(angle)
  const y = Math.sin(angle)
  const length = Math.hypot(x, y, TILT)
  out[0] = x / length
  out[1] = y / length
  out[2] = TILT / length
  return out
}

/** Скільки «дня» в цю годину: 0 — глибока ніч, 1 — повний день. */
export function daylightAt(hour: number): number {
  return smoothstep(-0.12, 0.22, sunDirection(hour)[1])
}

/** Нормалізує годину в [0, 24). */
export const wrapHour = (hour: number): number => ((hour % 24) + 24) % 24

export function formatTime(hour: number): string {
  const total = Math.floor(wrapHour(hour) * 60)
  const h = String(Math.floor(total / 60)).padStart(2, '0')
  const m = String(total % 60).padStart(2, '0')
  return `${h}:${m}`
}

/** Кольори неба й світла для поточного часу доби й погоди. */
export interface SkyState {
  skyTop: Color
  skyHorizon: Color
  sun: Color
  hemiSky: Color
  hemiGround: Color
  sunIntensity: number
  ambient: number
}

const COLOR_KEYS = ['skyTop', 'skyHorizon', 'sun', 'hemiSky', 'hemiGround'] as const
const NUMBER_KEYS = ['sunIntensity', 'ambient'] as const

const toFrame = (frame: PaletteFrame): SkyState => ({
  skyTop: new Color(frame.skyTop),
  skyHorizon: new Color(frame.skyHorizon),
  sun: new Color(frame.sun),
  hemiSky: new Color(frame.hemiSky),
  hemiGround: new Color(frame.hemiGround),
  sunIntensity: frame.sunIntensity,
  ambient: frame.ambient,
})

const NIGHT = toFrame(PALETTE.night)
const TWILIGHT = toFrame(PALETTE.twilight)
const DAY = toFrame(PALETTE.day)
const OVERCAST = new Color(PALETTE.overcast)
const overcastScratch = new Color()

export function createSkyState(): SkyState {
  return {
    skyTop: new Color(),
    skyHorizon: new Color(),
    sun: new Color(),
    hemiSky: new Color(),
    hemiGround: new Color(),
    sunIntensity: 0,
    ambient: 0,
  }
}

function blendFrames(a: SkyState, b: SkyState, t: number, out: SkyState): void {
  for (const key of COLOR_KEYS) out[key].copy(a[key]).lerp(b[key], t)
  for (const key of NUMBER_KEYS) out[key] = a[key] + (b[key] - a[key]) * t
}

/**
 * Кольори неба й світла для висоти сонця sunHeight (sin кута над горизонтом)
 * з урахуванням хмарності 0..1: хмари «сірять» небо і приглушують сонце.
 * Пише в out, щоб у кожному кадрі не створювати нових Color.
 */
export function sampleSky(sunHeight: number, cloud: number, out: SkyState = createSkyState()): SkyState {
  if (sunHeight < -0.05) {
    blendFrames(NIGHT, TWILIGHT, smoothstep(-0.3, -0.05, sunHeight), out)
  } else {
    blendFrames(TWILIGHT, DAY, smoothstep(-0.05, 0.35, sunHeight), out)
  }

  // Сірі хмари вночі теж темні — множимо колір хмар на «денність».
  const day = smoothstep(-0.25, 0.3, sunHeight)
  overcastScratch.copy(OVERCAST).multiplyScalar(0.12 + 0.88 * day)
  out.skyTop.lerp(overcastScratch, cloud * 0.8)
  out.skyHorizon.lerp(overcastScratch, cloud * 0.7)

  out.sunIntensity *= 1 - cloud * 0.65
  out.ambient *= 1 - cloud * 0.15
  return out
}
