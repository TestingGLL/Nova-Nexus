import { useState, useEffect } from 'react'
import { Lock } from 'lucide-react'
import './security.css'

// Password protection for sections / the whole app / Diario / Objetivos.
// Everything is OFF by default; the default password is M1-E6-G96.
export const DEFAULT_SECURITY_PASSWORD = 'M1-E6-G96'

export interface SecurityConfig {
  password: string
  lockApp: boolean
  lockDiary: boolean
  lockGoals: boolean
  lockedSections: string[]
}

const DEFAULT_SECURITY: SecurityConfig = {
  password: DEFAULT_SECURITY_PASSWORD,
  lockApp: false,
  lockDiary: false,
  lockGoals: false,
  lockedSections: [],
}

export function loadSecurity(): SecurityConfig {
  try { const s = localStorage.getItem('nn-security'); if (s) return { ...DEFAULT_SECURITY, ...JSON.parse(s) } } catch {}
  return { ...DEFAULT_SECURITY }
}
export function saveSecurity(c: SecurityConfig) {
  localStorage.setItem('nn-security', JSON.stringify(c))
  try { window.dispatchEvent(new CustomEvent('nn-security-updated')) } catch {}
}

// Subscribe to security config changes (same-window custom event + cross-tab storage).
export function useSecurity(): SecurityConfig {
  const [cfg, setCfg] = useState<SecurityConfig>(loadSecurity)
  useEffect(() => {
    const refresh = () => setCfg(loadSecurity())
    window.addEventListener('nn-security-updated', refresh)
    window.addEventListener('storage', refresh)
    return () => { window.removeEventListener('nn-security-updated', refresh); window.removeEventListener('storage', refresh) }
  }, [])
  return cfg
}

// Reusable password gate: renders children only after the correct password.
export function SecurityGate({ title, children, fullscreen }: { title: string; children: React.ReactNode; fullscreen?: boolean }) {
  const [unlocked, setUnlocked] = useState(false)
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(false)
  if (unlocked) return <>{children}</>
  const tryUnlock = () => { if (pw === loadSecurity().password) { setUnlocked(true); setErr(false) } else setErr(true) }
  return (
    <div className={`security-gate ${fullscreen ? 'fullscreen' : ''}`}>
      <div className="security-gate-icon"><Lock size={30} /></div>
      <p className="security-gate-title">«{title}» está protegido</p>
      <span className="security-gate-sub">Ingresá la contraseña para acceder.</span>
      <div className="security-gate-form">
        <input type="password" value={pw} onChange={e => { setPw(e.target.value); setErr(false) }} onKeyDown={e => e.key === 'Enter' && tryUnlock()} placeholder="Contraseña" autoFocus />
        <button onClick={tryUnlock}>Ingresar</button>
      </div>
      {err && <span className="security-gate-error">Contraseña incorrecta</span>}
    </div>
  )
}
