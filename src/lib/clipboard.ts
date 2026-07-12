import { notify } from '../components/Toast'

// Copia texto al portapapeles y muestra una notificación «Copiado» (toast global).
// Usar en TODO botón/acción de copiar para dar feedback consistente.
export async function copyToClipboard(text: string, message = 'Copiado'): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    notify()?.success(message)
    return true
  } catch {
    notify()?.error('No se pudo copiar')
    return false
  }
}
