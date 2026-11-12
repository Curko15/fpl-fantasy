import { useSyncExternalStore } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

const KEY = 'theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'
const CHANGE = 'themechange'
const THEME_COLOR = { light: '#f4f3ef', dark: '#0a0b0d' }

export function getThemePreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch {
    return 'system'
  }
}

function resolveDark(pref: ThemePreference): boolean {
  return pref === 'dark' || (pref === 'system' && window.matchMedia(DARK_QUERY).matches)
}

/** Keeps the browser's status bar colour in step with the page. */
function syncThemeColor(): void {
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', resolveDark(getThemePreference()) ? THEME_COLOR.dark : THEME_COLOR.light)
}

export function setThemePreference(pref: ThemePreference): void {
  try {
    if (pref === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, pref)
  } catch {
    // ignore: the choice just won't survive a reload
  }
  if (pref === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = pref
  syncThemeColor()
  window.dispatchEvent(new Event(CHANGE))
}

function subscribe(cb: () => void): () => void {
  const mq = window.matchMedia(DARK_QUERY)
  const onSystem = () => {
    syncThemeColor()
    cb()
  }
  mq.addEventListener('change', onSystem)
  window.addEventListener(CHANGE, cb)
  return () => {
    mq.removeEventListener('change', onSystem)
    window.removeEventListener(CHANGE, cb)
  }
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, getThemePreference)
}

/** True when the page is currently showing the dark theme (chosen or from the system). */
export function useIsDark(): boolean {
  return useSyncExternalStore(subscribe, () => resolveDark(getThemePreference()))
}

export function initTheme(): void {
  syncThemeColor()
}
