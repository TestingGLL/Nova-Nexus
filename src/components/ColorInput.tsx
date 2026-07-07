import { useState } from 'react'
import './ColorInput.css'

// Reusable color picker: native color wheel + editable HEX text field.
// Used everywhere a color is set so the user can always type a HEX (#C21807).
export default function ColorInput({ value, onChange, className, title, swatchOnly }: {
  value: string
  onChange: (c: string) => void
  className?: string
  title?: string
  swatchOnly?: boolean // only the wheel (no HEX field) — for very tight spots
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const isHex = (h: string) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(h)
  const safe = isHex(value) ? value : '#888888'
  const onHex = (v: string) => {
    setDraft(v)
    let h = v.trim(); if (h && !h.startsWith('#')) h = '#' + h
    if (isHex(h)) onChange(h)
  }
  return (
    <span className={`color-picker ${className || ''}`} title={title}>
      <input type="color" className="color-picker-wheel" value={safe} onChange={e => { setDraft(null); onChange(e.target.value) }} />
      {!swatchOnly && (
        <input
          type="text"
          className="color-picker-hex"
          value={draft !== null ? draft : value.toUpperCase()}
          onChange={e => onHex(e.target.value)}
          onBlur={() => setDraft(null)}
          placeholder="#C21807"
          spellCheck={false}
          maxLength={7}
        />
      )}
    </span>
  )
}
