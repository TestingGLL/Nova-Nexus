import { UserCircle } from 'lucide-react'
import { APP_VERSION } from '../App'
import './Login.css'

interface LoginProps {
  onLogin: () => void
}

export default function Login({ onLogin }: LoginProps) {
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <span className="nova">NOVA</span>
          <span className="nexus">NEXUS</span>
        </div>
        <p className="login-subtitle">Tu plataforma todo-en-uno</p>
        <button className="login-btn" onClick={onLogin}>
          <UserCircle size={20} />
          Ingresar como Invitado
        </button>
      </div>
      <span className="login-version">v{APP_VERSION}</span>
    </div>
  )
}
