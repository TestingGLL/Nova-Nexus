import { useState, useEffect } from 'react'
import { Mail, Lock, Eye, EyeOff, KeyRound, Loader } from 'lucide-react'
import { APP_VERSION } from '../App'
import { getSupabase, supabaseEnabled } from '../lib/supabase'
import { startCloudSync } from '../lib/cloudSync'
import { migrateImagesToStorage } from '../lib/imageStore'
import './Login.css'

const VALID_EMAIL = 'GallardoTesting@outlook.com'
const VALID_PASS = 'Stranger//..550'
const LS_REMEMBER = 'nn-remember-login'

interface LoginProps {
  onLogin: () => void
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [recovery, setRecovery] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [expectedCode, setExpectedCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [newPass, setNewPass] = useState('')
  const [recoveryDone, setRecoveryDone] = useState(false)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_REMEMBER)
      if (saved) {
        const data = JSON.parse(saved)
        if (data.email && data.password) {
          setEmail(data.email)
          setPassword(data.password)
          setRemember(true)
        }
      }
    } catch {}
  }, [])

  const handleLogin = async () => {
    if (email.toLowerCase() !== VALID_EMAIL.toLowerCase() || password !== VALID_PASS) {
      setError('Correo o contraseña incorrectos')
      return
    }
    if (remember) localStorage.setItem(LS_REMEMBER, JSON.stringify({ email, password }))
    else localStorage.removeItem(LS_REMEMBER)
    setError('')

    // Cloud sync (optional): authenticate with Supabase and pull/push data.
    // If Supabase isn't configured or auth fails, continue in local-only mode.
    if (supabaseEnabled) {
      setConnecting(true)
      try {
        // El SDK se descarga recién acá (ver lib/supabase.ts): la pantalla de login
        // no lo necesita para dibujarse.
        const supabase = await getSupabase()
        if (supabase) {
          let res = await supabase.auth.signInWithPassword({ email: VALID_EMAIL, password: VALID_PASS })
          if (res.error) {
            // First run: create the single user, then sign in.
            await supabase.auth.signUp({ email: VALID_EMAIL, password: VALID_PASS })
            res = await supabase.auth.signInWithPassword({ email: VALID_EMAIL, password: VALID_PASS })
          }
          if (!res.error) { await startCloudSync(); void migrateImagesToStorage() }
        }
      } catch {}
      setConnecting(false)
    }
    onLogin()
  }

  const sendRecoveryCode = () => {
    if (recoveryEmail.toLowerCase() !== VALID_EMAIL.toLowerCase()) {
      setError('Correo no registrado')
      return
    }
    const code = generateCode()
    setExpectedCode(code)
    setCodeSent(true)
    setError('')
    window.electronAPI?.showNotification(
      'Nova Nexus — Código de recuperación',
      `Tu código es: ${code}`
    )
  }

  const verifyCode = () => {
    if (recoveryCode.toUpperCase() !== expectedCode) {
      setError('Código incorrecto')
      return
    }
    if (newPass !== VALID_PASS) {
      setError('La nueva contraseña debe coincidir con la registrada')
      return
    }
    setRecoveryDone(true)
    setError('')
    setTimeout(() => {
      setRecovery(false)
      setRecoveryDone(false)
      setCodeSent(false)
      setRecoveryCode('')
      setRecoveryEmail('')
      setNewPass('')
    }, 2000)
  }

  if (recovery) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-logo">
            <span className="nova">NOVA</span>
            <span className="nexus">NEXUS</span>
          </div>
          <p className="login-subtitle">Recuperar contraseña</p>
          {recoveryDone ? (
            <p className="login-success">Contraseña verificada correctamente</p>
          ) : !codeSent ? (
            <div className="login-form">
              <div className="login-field">
                <Mail size={16} />
                <input type="email" placeholder="Correo registrado" value={recoveryEmail} onChange={e => { setRecoveryEmail(e.target.value); setError('') }} onKeyDown={e => e.key === 'Enter' && sendRecoveryCode()} />
              </div>
              {error && <span className="login-error">{error}</span>}
              <button className="login-btn primary" onClick={sendRecoveryCode} disabled={!recoveryEmail.trim()}>
                <KeyRound size={16} /> Enviar código
              </button>
              <button className="login-link" onClick={() => { setRecovery(false); setError('') }}>Volver al inicio de sesión</button>
            </div>
          ) : (
            <div className="login-form">
              <p className="login-hint">Ingresá el código enviado a tu correo</p>
              <div className="login-field">
                <KeyRound size={16} />
                <input placeholder="Código de 6 caracteres" value={recoveryCode} onChange={e => { setRecoveryCode(e.target.value.toUpperCase()); setError('') }} maxLength={6} style={{ letterSpacing: '3px', fontWeight: 600 }} />
              </div>
              <div className="login-field">
                <Lock size={16} />
                <input type="password" placeholder="Confirmar contraseña" value={newPass} onChange={e => { setNewPass(e.target.value); setError('') }} />
              </div>
              {error && <span className="login-error">{error}</span>}
              <button className="login-btn primary" onClick={verifyCode} disabled={recoveryCode.length < 6 || !newPass}>
                Verificar
              </button>
              <button className="login-link" onClick={() => { setCodeSent(false); setError('') }}>Reenviar código</button>
            </div>
          )}
        </div>
        <span className="login-version">v{APP_VERSION}</span>
      </div>
    )
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <span className="nova">NOVA</span>
          <span className="nexus">NEXUS</span>
        </div>
        <p className="login-subtitle">Tu plataforma todo-en-uno</p>
        <div className="login-form">
          <div className="login-field">
            <Mail size={16} />
            <input type="email" placeholder="Correo electrónico" value={email} onChange={e => { setEmail(e.target.value); setError('') }} onKeyDown={e => e.key === 'Enter' && document.querySelector<HTMLInputElement>('.login-pass-input')?.focus()} />
          </div>
          <div className="login-field">
            <Lock size={16} />
            <input className="login-pass-input" type={showPass ? 'text' : 'password'} placeholder="Contraseña" value={password} onChange={e => { setPassword(e.target.value); setError('') }} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            <button className="login-eye" onClick={() => setShowPass(!showPass)} tabIndex={-1}>
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <label className="login-remember">
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
            <span>Recordar este dispositivo</span>
          </label>
          {error && <span className="login-error">{error}</span>}
          <button className="login-btn primary" onClick={handleLogin} disabled={!email.trim() || !password || connecting}>
            {connecting ? <><Loader size={16} className="spin" /> Conectando…</> : 'Iniciar sesión'}
          </button>
          <button className="login-link" onClick={() => { setRecovery(true); setError('') }}>¿Olvidaste tu contraseña?</button>
        </div>
      </div>
      <span className="login-version">v{APP_VERSION}</span>
    </div>
  )
}
