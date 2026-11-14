import { Monitor, Moon, Sun } from 'lucide-react'
import { setThemePreference, useThemePreference, type ThemePreference } from '../theme'

const NEXT: Record<ThemePreference, ThemePreference> = { system: 'light', light: 'dark', dark: 'system' }
const LABEL: Record<ThemePreference, string> = { system: 'System', light: 'Light', dark: 'Dark' }
const ICON = { system: Monitor, light: Sun, dark: Moon }

/** One button that cycles System → Light → Dark. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const pref = useThemePreference()
  const Icon = ICON[pref]
  return (
    <button
      type="button"
      onClick={() => setThemePreference(NEXT[pref])}
      aria-label={`Theme: ${LABEL[pref]}. Switch to ${LABEL[NEXT[pref]]}`}
      title={`Theme: ${LABEL[pref]}`}
      className={`grid size-11 shrink-0 place-items-center rounded-full border border-line bg-card text-ink active:bg-raised ${className}`}
    >
      <Icon size={18} aria-hidden />
    </button>
  )
}
