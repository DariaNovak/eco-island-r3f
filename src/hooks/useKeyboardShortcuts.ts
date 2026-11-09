import { useEffect } from 'react'
import { TOOLS, TOOL_KEYS } from '../config'
import { useIslandStore, type IslandState } from '../store/useIslandStore'

type Shortcut = (state: IslandState) => void

/** Гарячі клавіші: код клавіші → дія над стором. */
const SHORTCUTS: Record<string, Shortcut> = {
  ...Object.fromEntries(TOOL_KEYS.map((tool): [string, Shortcut] => [TOOLS[tool].key, (s) => s.setTool(tool)])),
  KeyW: (s) => s.cycleWeather(),
  KeyT: (s) => s.toggleAutoTime(),
  KeyP: (s) => s.togglePhysics(),
  KeyG: (s) => s.toggleColliders(),
  KeyR: (s) => s.rockfall(),
  KeyC: (s) => s.resetCamera(),
}

const isTypingTarget = (el: EventTarget | null) => el instanceof HTMLElement && el.matches('input, textarea, select')

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      if (isTypingTarget(event.target)) return

      const action = SHORTCUTS[event.code]
      if (!action) return
      event.preventDefault()
      action(useIslandStore.getState())
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
