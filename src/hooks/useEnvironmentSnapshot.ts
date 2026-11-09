import { useCallback, useEffect, useState } from 'react'
import { environment } from '../store/runtime'

export interface EnvironmentSnapshot {
  hour: number
  snowCover: number
  wetness: number
  daylight: number
}

const takeSnapshot = (): EnvironmentSnapshot => ({
  hour: environment.hour,
  snowCover: environment.snowCover,
  wetness: environment.wetness,
  daylight: environment.daylight,
})

/**
 * Знімок transient-стану довкілля для HTML-інтерфейсу.
 * Сцена оновлює environment 60 разів на секунду, а UI достатньо
 * перечитувати кілька разів на секунду — так HUD не ре-рендериться щокадру.
 * Повертає [snapshot, refresh]; refresh() оновлює знімок негайно (напр., після руху повзунка).
 */
export function useEnvironmentSnapshot(intervalMs = 250): [EnvironmentSnapshot, () => void] {
  const [snapshot, setSnapshot] = useState(takeSnapshot)
  const refresh = useCallback(() => setSnapshot(takeSnapshot()), [])

  useEffect(() => {
    const id = setInterval(refresh, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, refresh])

  return [snapshot, refresh]
}
