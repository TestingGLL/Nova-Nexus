import { useState, useEffect, useCallback, useRef } from 'react'
import { Globe, ExternalLink, Monitor, CheckCircle, AlertCircle, Loader, Info, Bluetooth, Gamepad2, Keyboard, Mouse, Smartphone, Headphones, BatteryFull, BatteryMedium, BatteryLow, BatteryWarning, Eye, EyeOff, Trash2, FolderOpen, AlertTriangle, Wifi, Plus, X, Download, QrCode, GripVertical, MessageSquare, Send, ChevronDown, ChevronRight, Image as ImageIcon, Film, Music, File as FileIcon } from 'lucide-react'
import { useToast } from '../Toast'
import { useReorderableTabs } from '../../lib/useReorderableTabs'
import { copyToClipboard } from '../../lib/clipboard'
import TransfersIcon from '../TransfersIcon'
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

function deviceType(name: string, cls = ''): DevType {
  const n = name.toLowerCase()
  const c = cls.toLowerCase()
  if (/control|gamepad|joystick|dualsense|dualshock|xbox|8bitdo|gulikit|vstar|dehuka/.test(n)) return 'controller'
  if (/mouse|rat[oó]n|mx master|mx anywhere|m720|m590|bolt|logi/.test(n) || c === 'mouse') return 'mouse'
  if (/teclado|keyboard|keychron|rdkm-?9|magic keyboard/.test(n) || c === 'keyboard') return 'keyboard'
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
    const type = deviceType(d.name, d.class); const base = norm(d.name)
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

interface SharedFile { id: string; name: string; size: number; ts?: number; kind?: string }
interface ReceivedFile { id?: string; name?: string; size?: number; ts: number; type?: string; text?: string; kind?: string }
// Entrada del chat único: todo (texto/archivo, enviado desde la PC o recibido del
// celular) convive en la misma conversación. `scope` indica de qué colección sale el
// archivo (compartido desde la PC / recibido del celular) para armar la URL de preview.
type ChatEntry =
  | { id: string; dir: 'sent' | 'received'; ts: number; kind: 'text'; text: string }
  | { id: string; dir: 'sent' | 'received'; ts: number; kind: 'file'; scope: 'shared' | 'received'; file: { id?: string; name?: string; size?: number; kind?: string } }

function fmt(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

// Miniatura/preview de un archivo del chat: imagen o video se muestran de verdad
// (servidos inline por el server local); el resto cae en un ícono según su tipo.
function FilePreview({ kind, url }: { kind?: string; url: string }) {
  const [err, setErr] = useState(false)
  if (url && !err && kind === 'image') return <img src={url} className="transfer-thumb" alt="" loading="lazy" onError={() => setErr(true)} />
  if (url && !err && kind === 'video') return <video src={url} className="transfer-thumb" muted playsInline preload="metadata" onError={() => setErr(true)} />
  const Icon = kind === 'image' ? ImageIcon : kind === 'video' ? Film : kind === 'audio' ? Music : FileIcon
  return <span className="transfer-thumb transfer-thumb-icon"><Icon size={20} /></span>
}

function TransferenciasTab() {
  const toast = useToast()
  const [running, setRunning] = useState(false)
  const [starting, setStarting] = useState(false)
  const [url, setUrl] = useState('')
  const [ip, setIp] = useState('')
  const [port, setPort] = useState(0)
  const [dir, setDir] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [shared, setShared] = useState<SharedFile[]>([])
  const [received, setReceived] = useState<ReceivedFile[]>([])
  const [pcMessages, setPcMessages] = useState<{ id: string; text: string; ts: number }[]>([])
  const [pcText, setPcText] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [receivedOpen, setReceivedOpen] = useState(true)
  const [qrOpen, setQrOpen] = useState(false)               // modal del QR ampliado
  const [chatFilter, setChatFilter] = useState<'all' | 'received' | 'sent'>('all')  // filtro del chat único
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const sendText = async () => {
    if (!pcText.trim()) return
    const res = await window.electronAPI?.transferSendText(pcText.trim())
    if (res?.messages) setPcMessages(res.messages)
    setPcText('')
  }

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
    setRunning(false); setUrl(''); setQrDataUrl(''); setShared([]); setReceived([]); setPcMessages([])
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
  const clearHistory = async () => { setReceived([]); setPcMessages([]); await window.electronAPI?.transferClearReceived(); toast.info('Historial borrado') }
  // Received files are already saved to the downloads folder — "Descargar todos" reveals them.
  const downloadAll = () => { openFolder(); toast.success('Los archivos recibidos están en tu carpeta de descargas') }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    const paths = files.map(f => window.electronAPI?.getPathForFile(f) || '').filter(Boolean)
    if (paths.length) {
      const res = await window.electronAPI?.transferSharePaths(paths)
      if (res?.files) { setShared(res.files); toast.success(`${paths.length} archivo(s) compartido(s)`) }
    } else {
      // Fallback (no path available) → open the picker.
      const res = await window.electronAPI?.transferAddShared()
      if (res?.files) setShared(res.files)
    }
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
      const pm = await window.electronAPI?.transferPcMessages()
      if (pm) setPcMessages(pm)
    }
    poll()
    pollRef.current = setInterval(poll, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [running])

  const fileExt = (name: string) => { const dot = name.lastIndexOf('.'); return dot >= 0 ? name.slice(dot + 1).toUpperCase() : '' }
  const chatTime = (ts: number) => new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

  // Base + token del server local para construir las URLs de preview (miniaturas).
  const { previewBase, previewTok } = (() => { try { const u = new URL(url); return { previewBase: u.origin, previewTok: u.searchParams.get('t') || '' } } catch { return { previewBase: '', previewTok: '' } } })()
  const fileUrl = (scope: 'shared' | 'received', id?: string) => (previewBase && previewTok && id) ? `${previewBase}/file/${scope}/${id}?t=${previewTok}` : ''

  // Chat único: todo convive en una sola conversación ordenada por hora — texto y
  // archivos enviados desde la PC (compartidos) + texto y archivos recibidos del
  // celular. El filtro sólo cambia la vista (todos / recibidos / enviados).
  const chat: ChatEntry[] = [
    ...pcMessages.map(m => ({ id: 's-' + m.id, dir: 'sent' as const, ts: m.ts, kind: 'text' as const, text: m.text })),
    ...shared.map(f => ({ id: 'sf-' + f.id, dir: 'sent' as const, ts: f.ts || 0, kind: 'file' as const, scope: 'shared' as const, file: f })),
    ...received.map(f => f.type === 'text'
      ? ({ id: 'rt-' + (f.id || f.ts), dir: 'received' as const, ts: f.ts, kind: 'text' as const, text: f.text || '' })
      : ({ id: 'rf-' + (f.id || f.ts), dir: 'received' as const, ts: f.ts, kind: 'file' as const, scope: 'received' as const, file: f })),
  ].sort((a, b) => a.ts - b.ts)
  const visibleChat = chatFilter === 'all' ? chat : chat.filter(e => e.dir === chatFilter)

  if (!running && !starting) {
    return (
      <div className="transfer-start-panel">
        <div className="card transfer-hero">
          <TransfersIcon size={36} className="transfer-hero-icon" />
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
    <div className={`transfer-panel ${dragOver ? 'drag-over' : ''}`}
      onDragOver={e => { e.preventDefault(); if (!dragOver) setDragOver(true) }}
      onDragLeave={e => { if (e.currentTarget === e.target) setDragOver(false) }}
      onDrop={handleDrop}>
      {dragOver && (
        <div className="transfer-drop-overlay">
          <Download size={44} />
          <span>Soltá acá para compartir con el celular</span>
        </div>
      )}
      <div className="transfer-header">
        <div className="transfer-status"><span className="transfer-dot" /> Servidor activo</div>
        <button className="system-btn-sm danger" onClick={stop}>Detener</button>
      </div>

      <div className="transfer-grid">
        <div className="card transfer-qr-card">
          <div className="transfer-qr-head">
            <h4><QrCode size={14} /> Escaneá con tu celular</h4>
            {/* El QR permanece oculto: se muestra ampliado en un desplegable al tocar el botón. */}
            <button className="transfer-qr-icon-btn" onClick={() => setQrOpen(true)} title="Mostrar el código QR" disabled={!qrDataUrl}>
              <QrCode size={18} />
            </button>
          </div>
          <span className="transfer-url">{ip}:{port}</span>
          <p className="transfer-hint">Tocá el icono QR y escanealo con la cámara de tu Android.</p>
        </div>

        <div className="card transfer-shared-card">
          <div className="transfer-card-head">
            <h4>📤 Compartir desde la PC</h4>
            <button className="system-btn-sm" onClick={addFiles}><Plus size={12} /> Agregar</button>
          </div>
          {shared.length === 0 && <p className="transfer-empty">Arrastrá archivos o imágenes a cualquier parte, o hacé clic en Agregar.</p>}
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
          <div className="transfer-sendtext">
            <input value={pcText} onChange={e => setPcText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendText()} placeholder="Enviar texto al celular…" />
            <button className="system-btn-sm" onClick={sendText} disabled={!pcText.trim()}><Send size={12} /> Enviar</button>
          </div>
        </div>
      </div>

      <div className="card transfer-received-card">
        <div className="transfer-card-head">
          <button className="transfer-received-toggle" onClick={() => setReceivedOpen(o => !o)}>
            {receivedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <h4><MessageSquare size={14} /> Chat ({chat.length})</h4>
          </button>
          <div className="transfer-received-actions">
            {received.some(f => f.type !== 'text') && <button className="system-btn-sm" onClick={downloadAll}><Download size={12} /> Descargar todos</button>}
            {dir && <button className="system-btn-sm" onClick={openFolder}><FolderOpen size={12} /> Abrir carpeta</button>}
            <button className="system-btn-sm danger" onClick={clearHistory}><Trash2 size={12} /> Borrar historial</button>
          </div>
        </div>
        {receivedOpen && (
          <div className="transfer-chat-filter">
            <button className={chatFilter === 'all' ? 'active' : ''} onClick={() => setChatFilter('all')}>Todos</button>
            <button className={chatFilter === 'received' ? 'active' : ''} onClick={() => setChatFilter('received')}>Recibidos</button>
            <button className={chatFilter === 'sent' ? 'active' : ''} onClick={() => setChatFilter('sent')}>Enviados</button>
          </div>
        )}
        {receivedOpen && visibleChat.length === 0 && <p className="transfer-empty">{chat.length === 0 ? 'Todavía no hay mensajes. Los textos y archivos enviados y recibidos aparecen acá; se limpian a las 2 horas.' : 'Sin mensajes para este filtro.'}</p>}
        {receivedOpen && <div className="transfer-file-list transfer-chat-style">
          {visibleChat.map(entry => (
            <div key={entry.id} className={`transfer-msg ${entry.dir}`}>
              {entry.kind === 'text' ? (
                <div className="transfer-msg-bubble transfer-msg-text">
                  {entry.dir === 'received' && <MessageSquare size={13} className="transfer-received-icon" />}
                  <div className="transfer-msg-info">
                    <span className="transfer-text-content">{entry.text}</span>
                    <span className="transfer-msg-meta">
                      <button className="transfer-copy-btn" onClick={() => copyToClipboard(entry.text || '')}>Copiar</button>
                      {chatTime(entry.ts)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="transfer-msg-bubble transfer-msg-file">
                  <FilePreview kind={entry.file.kind} url={fileUrl(entry.scope, entry.file.id)} />
                  <div className="transfer-msg-info">
                    <span className="transfer-file-name">{entry.file.name}</span>
                    <span className="transfer-msg-meta">
                      {fileExt(entry.file.name || '') && <span className="transfer-file-ext-sm">{fileExt(entry.file.name || '')}</span>}
                      {fmt(entry.file.size || 0)} · {chatTime(entry.ts)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>}
        {receivedOpen && dir && <p className="transfer-dir">Guardado en: <code>{dir}</code></p>}
      </div>

      {qrOpen && qrDataUrl && (
        <div className="transfer-qr-modal" onClick={() => setQrOpen(false)}>
          <div className="transfer-qr-modal-box" onClick={e => e.stopPropagation()}>
            <button className="transfer-qr-modal-close" onClick={() => setQrOpen(false)} title="Cerrar"><X size={18} /></button>
            <img src={qrDataUrl} alt="QR" className="transfer-qr-modal-img" />
            <span className="transfer-qr-modal-url">{ip}:{port}</span>
            <p className="transfer-hint">Abrí la cámara de tu Android y escaneá el código.</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ============ MAIN ============

const SOFT_TABS: { id: string; label: string; icon: React.ReactNode }[] = [
  { id: 'browser', label: 'Navegador', icon: <Globe size={13} /> },
  { id: 'dispositivos', label: 'Dispositivos', icon: <Bluetooth size={13} /> },
  { id: 'transferencias', label: 'Transferencias', icon: <TransfersIcon size={13} /> },
  { id: 'papelera', label: 'Papelera', icon: <Trash2 size={13} /> },
  { id: 'appdata', label: 'AppData', icon: <FolderOpen size={13} /> },
]

export default function SoftwareSection() {
  const [tab, setTab] = useState<string>(() => {
    // Deep-link desde la barra superior: abre una tab puntual (ej. Transferencias).
    try { const t = localStorage.getItem('__nn_software_tab'); if (t) { localStorage.removeItem('__nn_software_tab'); return t } } catch {}
    return 'browser'
  })
  // Si la sección ya estaba montada, el acceso directo llega por evento.
  useEffect(() => {
    const onOpen = (e: Event) => { const d = (e as CustomEvent).detail; if (typeof d === 'string') setTab(d) }
    window.addEventListener('nn-open-software-tab', onOpen)
    return () => window.removeEventListener('nn-open-software-tab', onOpen)
  }, [])
  const { order, tabProps } = useReorderableTabs(SOFT_TABS.map(t => t.id), 'nn-software-tab-order')
  const tabMap = Object.fromEntries(SOFT_TABS.map(t => [t.id, t]))

  return (
    <div className={`software-section ${tab === 'transferencias' ? 'wide' : ''}`}>
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
