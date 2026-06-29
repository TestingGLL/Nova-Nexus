// Global UI scale (typography + spacing). Applied via CSS `zoom` on the root,
// so it affects the whole app uniformly, including the login screen.
export const UI_SCALE_KEY = 'nn-ui-scale'

export const UI_SCALES: { value: string; label: string }[] = [
  { value: '0.9', label: 'Pequeña' },
  { value: '1', label: 'Casi mediana (actual)' },
  { value: '1.1', label: 'Mediana' },
  { value: '1.22', label: 'Grande' },
]

export const DEFAULT_UI_SCALE = '1'

export function getUiScale(): string {
  try { return localStorage.getItem(UI_SCALE_KEY) || DEFAULT_UI_SCALE } catch { return DEFAULT_UI_SCALE }
}

export function applyUiScale(value?: string) {
  const v = value || getUiScale()
  const root = document.documentElement
  // `zoom` (Chromium/Electron) scales the px-based UI cleanly. It does NOT shrink
  // viewport units, so the `--ui-zoom` var lets the full-screen layout divide its
  // `100vh/100vw` by the same factor (see index.css) and avoid being clipped.
  root.style.setProperty('--ui-zoom', v)
  ;(root.style as unknown as { zoom: string }).zoom = v
}

export function setUiScale(value: string) {
  try { localStorage.setItem(UI_SCALE_KEY, value) } catch {}
  applyUiScale(value)
}
