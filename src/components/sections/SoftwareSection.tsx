import { useState, useEffect, useCallback } from 'react'
import { Globe, ExternalLink, Monitor, CheckCircle, AlertCircle, Loader, Info, Bluetooth, Gamepad2, Keyboard, Mouse, Smartphone, Headphones, BatteryFull, BatteryMedium, BatteryLow, BatteryWarning, Eye, EyeOff } from 'lucide-react'
import './SoftwareSection.css'

const isDesktop = !!window.electronAPI?.isDesktop

// ============ BROWSER TAB ============

function BrowserTab() {
  const [browser, setBrowser] = useState<'chrome' | 'edge'>('chrome')
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const applyBrowser = async (selected: 'chrome' | 'edge') => {
    setBrowser(selected); setResult(null)
    if (!isDesktop) return
    setApplying(true)
    try {
      const res = await window.electronAPI!.setFileAssociations(selected)
      const fileOk = res.results.filter(r => r.status === 'ok' && !r.ext?.includes('://')).length
      const linkOk = res.results.filter(r => r.status === 'ok' && r.ext?.includes('://')).length
      const name = selected === 'chrome' ? 'Google Chrome' : 'Microsoft Edge'
      let msg = `${fileOk} tipos de archivo asociados a ${name}.`
      if (linkOk > 0) msg += ` Links configurados.`
      setResult({ success: true, message: msg })
    } catch { setResult({ success: false, message: 'Error al cambiar las asociaciones.' }) }
    setApplying(false)
  }

  const openSettings = async (b: 'chrome' | 'edge') => {
    if (isDesktop) await window.electronAPI!.openBrowserSettings(b)
  }

  return (
    <div className="card browser-card">
      <div className="card-title"><Globe size={16} /> Navegador predeterminado</div>
      {isDesktop && <div className="desktop-badge"><Monitor size={13} /> Modo escritorio</div>}
      <p className="browser-desc">{isDesktop ? 'Toggle para asociar archivos web.' : 'Usá la versión de escritorio para cambiar asociaciones.'}</p>
      <div className="browser-toggle">
        <span className={`browser-label ${browser === 'chrome' ? 'active' : ''}`}>Chrome</span>
        <button className={`toggle-switch ${browser === 'edge' ? 'toggled' : ''}`} onClick={() => applyBrowser(browser === 'chrome' ? 'edge' : 'chrome')} disabled={applying}>
          <div className="toggle-thumb" />
        </button>
        <span className={`browser-label ${browser === 'edge' ? 'active' : ''}`}>Edge</span>
      </div>
      {applying && <div className="browser-status applying"><Loader size={14} className="spin" /> Aplicando...</div>}
      {result && !applying && <div className={`browser-status ${result.success ? 'success' : 'error'}`}>{result.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}{result.message}</div>}
      <div className="browser-current">Preferencia: <strong>{browser === 'chrome' ? 'Google Chrome' : 'Microsoft Edge'}</strong></div>
      {isDesktop && (
        <>
          <div className="browser-divider" />
          <div className="links-section">
            <p className="browser-note-title">Navegador para links</p>
            <p className="links-info"><Info size={12} />Windows protege esta config.</p>
            <div className="links-buttons">
              <button className={`links-btn ${browser === 'chrome' ? 'recommended' : ''}`} onClick={() => openSettings('chrome')}><ExternalLink size={13} />Chrome</button>
              <button className={`links-btn ${browser === 'edge' ? 'recommended' : ''}`} onClick={() => openSettings('edge')}><ExternalLink size={13} />Edge</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ============ DISPOSITIVOS TAB ============

interface BtDevice { id: string; name: string; battery: number | null; class?: string }
type DevType = 'controller' | 'keyboard' | 'mouse' | 'phone' | 'audio' | 'generic'

function deviceType(name: string): DevType {
  const n = name.toLowerCase()
  if (/control|gamepad|joystick|dualsense|dualshock|xbox|8bitdo|gulikit|vstar|dehuka/.test(n)) return 'controller'
  if (/teclado|keyboard|keychron|rdkm-?9|magic keyboard/.test(n)) return 'keyboard'
  if (/mouse|rat[oó]n/.test(n)) return 'mouse'
  if (/phone|m[oó]vil|celular|galaxy|iphone|redmi|xiaomi|samsung|android|pixel|motorola|moto |huawei|oppo/.test(n)) return 'phone'
  if (/auricular|headphone|headset|speaker|buds|airpods|jbl|bose|parlante|cascos|wh-|freebuds|earbuds/.test(n)) return 'audio'
  return 'generic'
}

const typeLabels: Record<DevType, string> = { controller: 'Control', keyboard: 'Teclado', mouse: 'Mouse', phone: 'Teléfono', audio: 'Audio', generic: 'Dispositivo' }

function DeviceIcon({ type, size = 18 }: { type: DevType; size?: number }) {
  switch (type) {
    case 'controller': return <Gamepad2 size={size} />
    case 'keyboard': return <Keyboard size={size} />
    case 'mouse': return <Mouse size={size} />
    case 'phone': return <Smartphone size={size} />
    case 'audio': return <Headphones size={size} />
    default: return <Bluetooth size={size} />
  }
}

function BatteryDisplay({ level }: { level: number }) {
  const Icon = level <= 15 ? BatteryWarning : level <= 35 ? BatteryLow : level <= 70 ? BatteryMedium : BatteryFull
  const color = level <= 15 ? '#ef4444' : level <= 35 ? '#f59e0b' : level <= 70 ? 'var(--text-secondary)' : '#22c55e'
  return <span className="dev-battery" style={{ color }}><Icon size={16} /> {level}%</span>
}

function DispositivosTab() {
  const [devices, setDevices] = useState<BtDevice[]>([])
  const [gamepads, setGamepads] = useState<{ id: string; index: number }[]>([])
  const [hidden, setHidden] = useState<string[]>(() => { try { const s = localStorage.getItem('nn-hidden-devices'); return s ? JSON.parse(s) : [] } catch { return [] } })
  const [showHidden, setShowHidden] = useState(false)
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const hide = (key: string) => { const next = [...hidden, key]; setHidden(next); localStorage.setItem('nn-hidden-devices', JSON.stringify(next)) }
  const unhide = (key: string) => { const next = hidden.filter(h => h !== key); setHidden(next); localStorage.setItem('nn-hidden-devices', JSON.stringify(next)) }

  const poll = useCallback(async () => {
    const api = (window as any).electronAPI
    if (!api?.getBluetoothDevices) return
    try {
      const list: BtDevice[] = await api.getBluetoothDevices()
      setDevices(Array.isArray(list) ? list.filter(d => d && d.name) : [])
    } catch {}
  }, [])

  useEffect(() => { poll(); const id = setInterval(poll, 10_000); return () => clearInterval(id) }, [poll])

  useEffect(() => {
    const read = () => { const gps = navigator.getGamepads ? Array.from(navigator.getGamepads()) : []; setGamepads(gps.filter((g): g is Gamepad => !!g).map(g => ({ id: g.id, index: g.index }))) }
    read(); const onConn = () => read()
    window.addEventListener('gamepadconnected', onConn); window.addEventListener('gamepaddisconnected', onConn)
    const id = setInterval(read, 2000)
    return () => { window.removeEventListener('gamepadconnected', onConn); window.removeEventListener('gamepaddisconnected', onConn); clearInterval(id) }
  }, [])

  const nameCounts: Record<string, number> = {}
  const items = devices.map(d => {
    const type = deviceType(d.name); const base = norm(d.name)
    nameCounts[base] = (nameCounts[base] || 0) + 1
    return { key: d.id, name: d.name, type, battery: d.battery, dupIndex: nameCounts[base] }
  })
  const totalByName: Record<string, number> = {}
  for (const it of items) totalByName[norm(it.name)] = (totalByName[norm(it.name)] || 0) + 1
  const display = items.map(it => ({ ...it, label: totalByName[norm(it.name)] > 1 ? `${it.name} (${it.dupIndex})` : it.name }))

  for (const g of gamepads) {
    const gn = norm(g.id)
    const already = devices.some(d => { const dn = norm(d.name); return dn.includes(gn) || gn.includes(dn) })
    if (!already) {
      const label = g.id.replace(/\(.*\)/, '').trim() || `Control ${g.index + 1}`
      display.push({ key: 'gp-' + g.index, name: label, label, type: 'controller', battery: null, dupIndex: 1 })
    }
  }

  const visible = display.filter(d => !hidden.includes(norm(d.name)))
  const hiddenVisible = display.filter(d => hidden.includes(norm(d.name)))

  return (
    <div className="dispositivos-content">
      <div className="dispositivos-header">
        <Bluetooth size={16} />
        <span>{visible.length} dispositivo{visible.length !== 1 ? 's' : ''} conectado{visible.length !== 1 ? 's' : ''}</span>
        {hidden.length > 0 && <button className="dispositivos-toggle-hidden" onClick={() => setShowHidden(!showHidden)}>{showHidden ? 'Ocultar' : 'Ver'} ocultos ({hidden.length})</button>}
      </div>
      {visible.length === 0 && !showHidden && (
        <div className="dispositivos-empty">
          <Bluetooth size={32} />
          <p>No hay dispositivos Bluetooth conectados</p>
          <p className="dispositivos-hint">Los dispositivos se detectan automáticamente cada 10 segundos</p>
        </div>
      )}
      <div className="dispositivos-grid">
        {visible.map(d => (
          <div key={d.key} className="card dispositivo-card">
            <div className={`dispositivo-icon type-${d.type}`}>
              <DeviceIcon type={d.type} size={24} />
            </div>
            <div className="dispositivo-info">
              <span className="dispositivo-name">{d.label}</span>
              <span className="dispositivo-type">{typeLabels[d.type]} · <span className="dev-state-on">Encendido</span></span>
            </div>
            <div className="dispositivo-status">
              {d.battery != null ? <BatteryDisplay level={d.battery} /> : <span className="dispositivo-connected"><span className="dev-dot" /> Conectado</span>}
            </div>
            <button className="dispositivo-hide" onClick={() => hide(norm(d.name))} title="Ocultar dispositivo"><EyeOff size={14} /></button>
          </div>
        ))}
      </div>
      {showHidden && hiddenVisible.length > 0 && (
        <div className="dispositivos-hidden-section">
          <span className="dispositivos-hidden-label">Dispositivos ocultos</span>
          {hiddenVisible.map(d => (
            <div key={d.key} className="dispositivo-hidden-row">
              <DeviceIcon type={d.type} size={16} />
              <span>{d.label}</span>
              <button onClick={() => unhide(norm(d.name))}><Eye size={13} /> Mostrar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============ MAIN ============

export default function SoftwareSection() {
  const [tab, setTab] = useState<'browser' | 'dispositivos'>('browser')

  return (
    <div className="software-section">
      <div className="software-tabs">
        <button className={`software-tab ${tab === 'browser' ? 'active' : ''}`} onClick={() => setTab('browser')}>
          <Globe size={13} /> Navegador
        </button>
        <button className={`software-tab ${tab === 'dispositivos' ? 'active' : ''}`} onClick={() => setTab('dispositivos')}>
          <Bluetooth size={13} /> Dispositivos
        </button>
      </div>
      {tab === 'browser' ? <BrowserTab /> : <DispositivosTab />}
    </div>
  )
}
