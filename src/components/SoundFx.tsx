import { useEffect } from 'react'
import { sfx, initSounds } from '../lib/sounds'

// Plays a subtle click sound when interactive elements are pressed.
// Uses pointerdown (capture) so it fires even when handlers stopPropagation.
export default function SoundFx() {
  useEffect(() => {
    // Start the audio session early so the app shows in the Windows volume mixer.
    initSounds()
    const resume = () => initSounds()
    window.addEventListener('pointerdown', resume, { once: true })
    const handler = (e: PointerEvent) => {
      const t = e.target as HTMLElement
      if (!t || !t.closest) return
      const el = t.closest('button, [role="button"], a[href], .nav-item, .personal-tab, .palette-swatch, .color-swatch, .preset-btn, .cal-day')
      if (!el) return
      if ((el as HTMLButtonElement).disabled) return
      // Toggles get a distinct up/down chirp.
      const cls = (el.className && typeof el.className === 'string') ? el.className : ''
      if (/toggle|switch/.test(cls)) {
        const on = el.classList.contains('active') || el.classList.contains('toggled') || el.classList.contains('on')
        on ? sfx.toggleOff() : sfx.toggleOn()
      } else {
        sfx.click()
      }
    }
    document.addEventListener('pointerdown', handler, true)
    return () => { document.removeEventListener('pointerdown', handler, true); window.removeEventListener('pointerdown', resume) }
  }, [])
  return null
}
