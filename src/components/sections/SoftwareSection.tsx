import { useState, useEffect, useCallback, useRef } from 'react'
import { Globe, ExternalLink, Monitor, CheckCircle, AlertCircle, Loader, Info, Bluetooth, Gamepad2, Keyboard, Mouse, Smartphone, Headphones, BatteryFull, BatteryMedium, BatteryLow, BatteryWarning, Eye, EyeOff, Trash2, FolderOpen, AlertTriangle, Wifi, Plus, X, Download, QrCode, GripVertical, MessageSquare } from 'lucide-react'
import { useToast } from '../Toast'
import { useReorderableTabs } from '../../lib/useReorderableTabs'
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

// ============ PAPELERA TAB ============

function PapeleraTab() {
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const [working, setWorking] = useState(false)

  const empty = async () => {
    setConfirming(false); setWorking(true)
    try {
      const res = await window.electronAPI?.emptyRecycleBin()
      if (res?.success) toast.success('Papelera de reciclaje vaciada')
      else toast.error(res?.message || 'No se pudo vaciar la papelera')
    } catch { toast.error('No se pudo vaciar la papelera') }
    setWorking(false)
  }

  return (
    <div className="card system-card">
      <div className="card-title"><Trash2 size={16} /> Papelera de reciclaje</div>
      <p className="system-desc">Eliminá de forma permanente todo el contenido de la papelera de reciclaje de Windows. Esta acción no se puede deshacer.</p>
      <div className="system-warning"><AlertTriangle size={14} /> Los archivos se borran definitivamente.</div>
      {!confirming ? (
        <button className="system-btn danger" onClick={() => setConfirming(true)} disabled={working}>
          {working ? <><Loader size={14} className="spin" /> Vaciando…</> : <><Trash2 size={14} /> Vaciar papelera</>}
        </button>
      ) : (
        <div className="system-confirm">
          <span>¿Seguro que querés vaciar la papelera?</span>
          <div className="system-confirm-actions">
            <button className="system-btn-sm" onClick={() => setConfirming(false)}>Cancelar</button>
            <button className="system-btn-sm danger" onClick={empty}>Sí, vaciar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============ APPDATA TAB ============

function AppDataTab() {
  const toast = useToast()
  const open = async () => {
    try {
      const res = await window.electronAPI?.openAppData()
      if (res?.success) toast.success('Abriendo carpeta AppData')
      else toast.error(res?.message || 'No se pudo abrir la carpeta')
    } catch { toast.error('No se pudo abrir la carpeta') }
  }
  return (
    <div className="card system-card">
      <div className="card-title"><FolderOpen size={16} /> Carpeta AppData</div>
      <p className="system-desc">Abrí directamente la carpeta <code>%appdata%</code> (Roaming) en el Explorador de Windows, donde las aplicaciones guardan su configuración.</p>
      <button className="system-btn" onClick={open}><FolderOpen size={14} /> Abrir %appdata%</button>
    </div>
  )
}

// ============ TRANSFERENCIAS TAB ============

interface SharedFile { id: string; name: string; size: number }
interface ReceivedFile { name?: string; size?: number; ts: number; type?: string; text?: string }

function fmt(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

function TransferenciasTab() {
  const toast = useToast()
  const [running, setRunning] = useState(false)
  const [starting, setStarting] = useState(false)
  const [_url, setUrl] = useState('')
  const [ip, setIp] = useState('')
  const [port, setPort] = useState(0)
  const [dir, setDir] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [shared, setShared] = useState<SharedFile[]>([])
  const [received, setReceived] = useState<ReceivedFile[]>([])
  const [dragOver, setDragOver] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = async () => {
    setStarting(true)
    try {
      const res = await window.electronAPI?.transferStart()
      if (res?.success && res.url) {
        setRunning(true); setUrl(res.url); setIp(res.ip || ''); setPort(res.port || 0); setDir(res.dir || '')
        const qr = await import('qrcode')
        const dataUrl = await qr.toDataURL(res.url, { width: 220, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
        setQrDataUrl(dataUrl)
        const list = await window.electronAPI?.transferGetShared()
        if (list) setShared(list)
        toast.success('Servidor de transferencia iniciado')
      } else {
        toast.error(res?.message || 'No se pudo iniciar')
      }
    } catch { toast.error('Error al iniciar la transferencia') }
    setStarting(false)
  }

  const stop = async () => {
    await window.electronAPI?.transferStop()
    setRunning(false); setUrl(''); setQrDataUrl(''); setShared([]); setReceived([])
    if (pollRef.current) clearInterval(pollRef.current)
    toast.info('Servidor de transferencia detenido')
  }

  const addFiles = async () => {
    const res = await window.electronAPI?.transferAddShared()
    if (res?.files) setShared(res.files)
  }

  const removeFile = async (id: string) => {
    const res = await window.electronAPI?.transferRemoveShared(id)
    if (res?.files) setShared(res.files)
  }

  const openFolder = () => window.electronAPI?.transferOpenFolder()
  const clearHistory = async () => { await window.electronAPI?.transferClearReceived(); setReceived([]) }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const res = await window.electronAPI?.transferAddShared()
    if (res?.files) setShared(res.files)
  }

  // The server auto-starts with the app (fixed port + stable token). On mount we
  // just reflect that running state and render the QR.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const st = await window.electronAPI?.transferStatus()
      if (cancelled || !st?.running || !st.url) return
      setRunning(true); setUrl(st.url); setIp(st.ip || ''); setPort(st.port || 0); setDir(st.dir || '')
      try { const qr = await import('qrcode'); setQrDataUrl(await qr.toDataURL(st.url, { width: 220, margin: 2, color: { dark: '#000000', light: '#ffffff' } })) } catch {}
      const list = await window.electronAPI?.transferGetShared(); if (list) setShared(list)
    })()
    return () => { cancelled = true }
  }, [])

  // Auto-cleanup received after 2 hours
  useEffect(() => {
    if (!running) return
    const cleanup = setInterval(() => {
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
      setReceived(prev => prev.filter(f => f.ts > twoHoursAgo))
    }, 60000)
    return () => clearInterval(cleanup)
  }, [running])

  useEffect(() => {
    if (!running) return
    const poll = async () => {
      const list = await window.electronAPI?.transferReceived()
      if (list) setReceived(list)
    }
    poll()
    pollRef.current = setInterval(poll, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [running])

  const fileExt = (name: string) => { const dot = name.lastIndexOf('.'); return dot >= 0 ? name.slice(dot + 1).toUpperCase() : '' }

  if (!running && !starting) {
    return (
      <div className="transfer-start-panel">
        <div className="card transfer-hero">
          <Wifi size={36} className="transfer-hero-icon" />
          <h3>Transferencia por WiFi</h3>
          <p>Compartí archivos entre tu PC y tu celular. Ambos dispositivos deben estar en la misma red WiFi.</p>
          <button className="system-btn" onClick={start} disabled={starting}>
            <Wifi size={14} /> Iniciar servidor
          </button>
        </div>
      </div>
    )
  }

  if (starting) {
    return (
      <div className="transfer-start-panel">
        <div className="card transfer-hero">
          <Loader size={36} className="spin transfer-hero-icon" />
          <h3>Iniciando servidor...</h3>
        </div>
      </div>
    )
  }

  return (
    <div className="transfer-panel">
      <div className="transfer-header">
        <div className="transfer-status"><span className="transfer-dot" /> Servidor activo</div>
        <button className="system-btn-sm danger" onClick={stop}>Detener</button>
      </div>

      <div className="transfer-grid">
        <div className="card transfer-qr-card">
          <h4><QrCode size={14} /> Escaneá con tu celular</h4>
          {qrDataUrl && <img src={qrDataUrl} alt="QR" className="transfer-qr-img" />}
          <span className="transfer-url">{ip}:{port}</span>
          <p className="transfer-hint">Abrí la cámara de tu Android y escaneá el código.</p>
        </div>

        <div className={`card transfer-shared-card ${dragOver ? 'drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}>
          <div className="transfer-card-head">
            <h4>📤 Compartir desde la PC</h4>
            <button className="system-btn-sm" onClick={addFiles}><Plus size={12} /> Agregar</button>
          </div>
          {shared.length === 0 && <p className="transfer-empty">Arrastrá archivos acá o hacé clic en Agregar.</p>}
          <div className="transfer-file-list">
            {shared.map(f => (
              <div key={f.id} className="transfer-file">
                {fileExt(f.name) && <span className="transfer-file-ext">{fileExt(f.name)}</span>}
                <span className="transfer-file-name">{f.name}</span>
                <span className="transfer-file-size">{fmt(f.size)}</span>
                <button className="queue-remove" onClick={() => removeFile(f.id)}><X size={12} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card transfer-received-card">
        <div className="transfer-card-head">
          <h4>📥 Recibidos ({received.length})</h4>
          <div className="transfer-received-actions">
            {received.length > 0 && <button className="system-btn-sm" onClick={clearHistory}><Trash2 size={12} /> Limpiar</button>}
            {dir && <button className="system-btn-sm" onClick={openFolder}><FolderOpen size={12} /> Abrir carpeta</button>}
          </div>
        </div>
        {received.length === 0 && <p className="transfer-empty">Los archivos del celular aparecen acá. Se limpian automáticamente a las 2 horas.</p>}
        <div className="transfer-file-list transfer-chat-style">
          {received.map((f, i) => (
            <div key={i} className="transfer-msg received">
              {f.type === 'text' ? (
                <div className="transfer-msg-bubble transfer-msg-text">
                  <MessageSquare size={13} className="transfer-received-icon" />
                  <div className="transfer-msg-info">
                    <span className="transfer-text-content">{f.text}</span>
                    <span className="transfer-msg-meta">
                      <button className="transfer-copy-btn" onClick={() => navigator.clipboard.writeText(f.text || '')}>Copiar</button>
                      {new Date(f.ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="transfer-msg-bubble">
                  <Download size={13} className="transfer-received-icon" />
                  <div className="transfer-msg-info">
                    <span className="transfer-file-name">{f.name}</span>
                    <span className="transfer-msg-meta">
                      {fileExt(f.name || '') && <span className="transfer-file-ext-sm">{fileExt(f.name || '')}</span>}
                      {fmt(f.size || 0)} · {new Date(f.ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        {dir && <p className="transfer-dir">Guardado en: <code>{dir}</code></p>}
      </div>
    </div>
  )
}

// ============ MAIN ============

const SOFT_TABS: { id: string; label: string; icon: React.ReactNode }[] = [
  { id: 'browser', label: 'Navegador', icon: <Globe size={13} /> },
  { id: 'dispositivos', label: 'Dispositivos', icon: <Bluetooth size={13} /> },
  { id: 'transferencias', label: 'Transferencias', icon: <Wifi size={13} /> },
  { id: 'papelera', label: 'Papelera', icon: <Trash2 size={13} /> },
  { id: 'appdata', label: 'AppData', icon: <FolderOpen size={13} /> },
]

export default function SoftwareSection() {
  const [tab, setTab] = useState<string>('browser')
  const { order, tabProps } = useReorderableTabs(SOFT_TABS.map(t => t.id), 'nn-software-tab-order')
  const tabMap = Object.fromEntries(SOFT_TABS.map(t => [t.id, t]))

  return (
    <div className="software-section">
      <div className="software-tabs">
        {order.map((id, i) => { const t = tabMap[id]; if (!t) return null; const dp = tabProps(i); return (
          <button key={id} className={`software-tab ${tab === id ? 'active' : ''} ${dp.className}`} onClick={() => setTab(id)} draggable={dp.draggable} onDragStart={dp.onDragStart} onDragOver={dp.onDragOver} onDrop={dp.onDrop} onDragEnd={dp.onDragEnd}>
            <GripVertical size={10} className="tab-grip" />{t.icon} {t.label}
          </button>
        ) })}
      </div>
      {tab === 'browser' && <BrowserTab />}
      {tab === 'dispositivos' && <DispositivosTab />}
      {tab === 'transferencias' && <TransferenciasTab />}
      {tab === 'papelera' && <PapeleraTab />}
      {tab === 'appdata' && <AppDataTab />}
    </div>
  )
}
