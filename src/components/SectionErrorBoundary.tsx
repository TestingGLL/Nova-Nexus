import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props { name: string; children: ReactNode }
interface State { hasError: boolean; message: string }

// Isolates a section so a runtime error in one never blanks the whole app.
export default class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || 'Error desconocido' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.name}] error:`, error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
          <AlertTriangle size={32} style={{ color: '#ef4444' }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Algo salió mal en {this.props.name}</p>
          <p style={{ fontSize: 12, opacity: 0.7 }}>{this.state.message}</p>
          <button
            style={{ marginTop: 8, padding: '8px 16px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
            onClick={() => this.setState({ hasError: false, message: '' })}
          >
            Reintentar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
