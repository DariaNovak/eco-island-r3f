import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ENTITY_TYPE_KEYS, SPAWN, TIME, TOOLS, TOOL_KEYS, WEATHER, WEATHER_KEYS, type EntityType, type ToolKind } from '../config'
import { formatTime } from '../lib/dayCycle'
import { useEnvironmentSnapshot } from '../hooks/useEnvironmentSnapshot'
import { useIslandStore } from '../store/useIslandStore'

const TOAST_DURATION_MS = 2200
/** Підпис клавіші для підказки: 'Digit1' → '1'. */
const keyLabel = (code: string) => code.replace('Digit', '').replace('Key', '')

/** HTML-інтерфейс поверх canvas: інструменти, погода, час, фізика, статистика. */
export function Hud() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <>
      <aside className={`panel ${collapsed ? 'panel--collapsed' : ''}`} aria-label="Керування островом">
        <header className="panel__header">
          <div>
            <h1>🏝️ Еко-Острів</h1>
            <p className="panel__subtitle">Тераформінг і симулятор погоди · R3F</p>
          </div>
          <button
            className="icon-button"
            onClick={() => setCollapsed((v) => !v)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Розгорнути панель' : 'Згорнути панель'}
          >
            {collapsed ? '▸' : '▾'}
          </button>
        </header>

        {!collapsed && (
          <>
            <ToolPicker />
            <WeatherPicker />
            <TimeControls />
            <WorldControls />
            <Stats />
            <Help />
          </>
        )}
      </aside>
      <Toast />
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function ToolPicker() {
  const { tool, setTool, dropHeight, setDropHeight } = useIslandStore(
    useShallow((s) => ({ tool: s.tool, setTool: s.setTool, dropHeight: s.dropHeight, setDropHeight: s.setDropHeight })),
  )

  return (
    <Section title="Інструмент">
      <div className="grid grid--tools" role="radiogroup" aria-label="Інструмент">
        {TOOL_KEYS.map((key) => (
          <button
            key={key}
            role="radio"
            aria-checked={tool === key}
            className="tile"
            onClick={() => setTool(key)}
            title={`${TOOLS[key].label} (${keyLabel(TOOLS[key].key)})`}
          >
            <span className="tile__icon" aria-hidden>{TOOLS[key].icon}</span>
            <span className="tile__label">{TOOLS[key].label}</span>
          </button>
        ))}
      </div>
      {TOOLS[tool].kind === 'spawn' && (
        <label className="slider">
          <span>Висота скидання <output>{dropHeight.toFixed(1)} м</output></span>
          <input
            type="range"
            min={SPAWN.minDropHeight}
            max={SPAWN.maxDropHeight}
            step={0.5}
            value={dropHeight}
            onChange={(e) => setDropHeight(Number(e.target.value))}
          />
        </label>
      )}
      <p className="hint">{TOOL_HINTS[TOOLS[tool].kind]}</p>
    </Section>
  )
}

const TOOL_HINTS: Record<ToolKind, string> = {
  spawn: 'Клік по суші — об\'єкт впаде з висоти і приземлиться. Клік по об\'єкту — підкинути.',
  sculpt: 'Затисніть ліву кнопку і ведіть по острову. Камера на цей час зупиняється.',
  remove: 'Клік по об\'єкту — прибрати його з острова.',
}

function WeatherPicker() {
  const { weather, setWeather } = useIslandStore(useShallow((s) => ({ weather: s.weather, setWeather: s.setWeather })))

  return (
    <Section title="Погода">
      <div className="grid grid--weather" role="radiogroup" aria-label="Погода">
        {WEATHER_KEYS.map((key) => (
          <button
            key={key}
            role="radio"
            aria-checked={weather === key}
            className="tile"
            onClick={() => setWeather(key)}
            title={WEATHER[key].label}
          >
            <span className="tile__icon" aria-hidden>{WEATHER[key].icon}</span>
            <span className="tile__label">{WEATHER[key].label}</span>
          </button>
        ))}
      </div>
    </Section>
  )
}

function TimeControls() {
  const { autoTime, toggleAutoTime, timeSpeed, setTimeSpeed, setHour } = useIslandStore(
    useShallow((s) => ({
      autoTime: s.autoTime,
      toggleAutoTime: s.toggleAutoTime,
      timeSpeed: s.timeSpeed,
      setTimeSpeed: s.setTimeSpeed,
      setHour: s.setHour,
    })),
  )
  const [env, refresh] = useEnvironmentSnapshot()
  const isNight = env.daylight < 0.4

  return (
    <Section title={`Час доби · ${formatTime(env.hour)} ${isNight ? '🌙' : '☀️'}`}>
      <label className="slider">
        <span className="visually-hidden">Година</span>
        <input
          type="range"
          min={0}
          max={24}
          step={0.05}
          value={env.hour}
          onChange={(e) => {
            setHour(Number(e.target.value))
            refresh()
          }}
        />
      </label>
      <div className="row">
        <button onClick={toggleAutoTime} aria-pressed={autoTime}>
          {autoTime ? '⏸ Зупинити час' : '▶ Хід часу'} <kbd>T</kbd>
        </button>
        <div className="segmented" role="radiogroup" aria-label="Швидкість часу">
          {TIME.speeds.map((speed) => (
            <button key={speed} role="radio" aria-checked={timeSpeed === speed} onClick={() => setTimeSpeed(speed)}>
              ×{speed}
            </button>
          ))}
        </div>
      </div>
    </Section>
  )
}

function WorldControls() {
  const s = useIslandStore(
    useShallow((state) => ({
      physicsPaused: state.physicsPaused,
      showColliders: state.showColliders,
      togglePhysics: state.togglePhysics,
      toggleColliders: state.toggleColliders,
      rockfall: state.rockfall,
      clearEntities: state.clearEntities,
      regenerateIsland: state.regenerateIsland,
      resetCamera: state.resetCamera,
    })),
  )

  return (
    <Section title="Світ і фізика">
      <div className="buttons">
        <button onClick={s.togglePhysics} aria-pressed={s.physicsPaused}>
          {s.physicsPaused ? '▶ Фізика' : '⏸ Фізика'} <kbd>P</kbd>
        </button>
        <button onClick={s.toggleColliders} aria-pressed={s.showColliders}>
          🧊 Колайдери <kbd>G</kbd>
        </button>
        <button onClick={s.rockfall}>☄️ Камінепад <kbd>R</kbd></button>
        <button onClick={s.resetCamera}>🎥 Камера <kbd>C</kbd></button>
        <button onClick={s.clearEntities}>🧹 Очистити</button>
        <button onClick={s.regenerateIsland}>🎲 Новий острів</button>
      </div>
    </Section>
  )
}

const STAT_ICONS: Record<EntityType, string> = { tree: '🌲', rock: '🪨', animal: '🐑', house: '🏠' }
const STAT_LABELS: Record<EntityType, string> = { tree: 'Дерева', rock: 'Каміння', animal: 'Тварини', house: 'Будинки' }

function Stats() {
  const entities = useIslandStore((s) => s.entities)
  const counts = useMemo(() => {
    const result = Object.fromEntries(ENTITY_TYPE_KEYS.map((type) => [type, 0])) as Record<EntityType, number>
    for (const e of entities) if (!e.removing) result[e.type]++
    return result
  }, [entities])
  const [env] = useEnvironmentSnapshot(500)

  return (
    <Section title="Стан острова">
      <dl className="stats">
        {ENTITY_TYPE_KEYS.map((type) => (
          <div key={type} title={STAT_LABELS[type]}>
            <dt>{STAT_ICONS[type]} {STAT_LABELS[type]}</dt>
            <dd>{counts[type]}</dd>
          </div>
        ))}
      </dl>
      <Meter label="❄️ Сніговий покрив" value={env.snowCover} />
      <Meter label="💧 Вологість ґрунту" value={env.wetness} />
    </Section>
  )
}

function Meter({ label, value }: { label: string; value: number }) {
  const percent = Math.round(value * 100)
  return (
    <div className="meter">
      <span>{label}</span>
      <span className="meter__value">{percent}%</span>
      <div className="meter__track" role="progressbar" aria-label={label} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="meter__fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function Help() {
  return (
    <details className="help">
      <summary>Як взаємодіяти</summary>
      <ul>
        <li><b>Перетягування</b> — обертання камери, <b>колесо</b> — масштаб, <b>ПКМ</b> — зсув</li>
        <li><b>Клік по суші</b> — висадити об'єкт (з анімацією появи та падінням)</li>
        <li><b>Клік по воді</b> — брижі; камінь можна кинути в море</li>
        <li><b>Затиснута ЛКМ</b> з ⛰️/🕳️ — змінювати рельєф</li>
        <li><b>Клік по об'єкту</b> — підкинути (або видалити інструментом 🧹)</li>
        <li><kbd>1</kbd>–<kbd>7</kbd> — інструменти, <kbd>W</kbd> — наступна погода</li>
      </ul>
    </details>
  )
}

function Toast() {
  const toast = useIslandStore((s) => s.toast)
  const dismissToast = useIslandStore((s) => s.dismissToast)

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => dismissToast(toast.id), TOAST_DURATION_MS)
    return () => clearTimeout(id)
  }, [toast, dismissToast])

  if (!toast) return null
  return (
    <div className="toast" role="status" aria-live="polite" key={toast.id}>
      {toast.text}
    </div>
  )
}
