import { describe, expect, it } from 'vitest'
import { daylightAt, formatTime, sampleSky, sunDirection, wrapHour } from './dayCycle'

describe('sunDirection', () => {
  it('опівдні сонце високо, опівночі під горизонтом, на світанку — біля горизонту', () => {
    expect(sunDirection(12)[1]).toBeGreaterThan(0.9)
    expect(sunDirection(0)[1]).toBeLessThan(-0.9)
    expect(sunDirection(6)[1]).toBeCloseTo(0, 6)
  })

  it('завжди одиничний вектор', () => {
    for (const hour of [0, 3.3, 7, 12, 17.5, 23.9]) {
      expect(Math.hypot(...sunDirection(hour))).toBeCloseTo(1, 6)
    }
  })
})

describe('daylightAt', () => {
  it('1 удень, 0 уночі, між ними — на світанку', () => {
    expect(daylightAt(12)).toBe(1)
    expect(daylightAt(0)).toBe(0)
    expect(daylightAt(6)).toBeGreaterThan(0)
    expect(daylightAt(6)).toBeLessThan(1)
  })
})

describe('formatTime і wrapHour', () => {
  it('форматує години як HH:MM і загортає за межі доби', () => {
    expect(formatTime(0)).toBe('00:00')
    expect(formatTime(9.5)).toBe('09:30')
    expect(formatTime(25.25)).toBe('01:15')
    expect(formatTime(-1)).toBe('23:00')
    expect(wrapHour(48)).toBe(0)
  })
})

describe('sampleSky', () => {
  it('удень небо й світло яскравіші, ніж уночі', () => {
    const day = sampleSky(1, 0)
    const night = sampleSky(-1, 0)
    expect(day.sunIntensity).toBeGreaterThan(night.sunIntensity)
    expect(day.ambient).toBeGreaterThan(night.ambient)
    expect(day.skyTop.getHSL({ h: 0, s: 0, l: 0 }).l).toBeGreaterThan(night.skyTop.getHSL({ h: 0, s: 0, l: 0 }).l)
  })

  it('хмарність приглушує сонце і знебарвлює небо', () => {
    const clear = sampleSky(1, 0)
    const overcast = sampleSky(1, 1)
    expect(overcast.sunIntensity).toBeLessThan(clear.sunIntensity)
    expect(overcast.skyTop.getHSL({ h: 0, s: 0, l: 0 }).s).toBeLessThan(clear.skyTop.getHSL({ h: 0, s: 0, l: 0 }).s)
  })
})
