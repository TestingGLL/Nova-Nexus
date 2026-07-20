import { useState, useRef } from 'react'
import { ImageIcon, Download, Upload, FolderOpen, Trash2, Check, Loader, X, BookOpen, RefreshCw } from 'lucide-react'
import { useToast } from '../Toast'
import GuiaAppsPage from './GuiaAppsPage'
import { useSubTab } from '../../lib/tabRoute'
import './EdicionSection.css'

// Convierte una URL de blob a base64 (data URL) para guardarla vía Electron.
async function blobUrlToBase64(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob()
  return await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(blob) })
}

// ============ CONVERTER ============
const FORMATS = ['JPG', 'PNG', 'WEBP', 'ICO'] as const
type Format = typeof FORMATS[number]
const mimeMap: Record<Format, string> = { JPG: 'image/jpeg', PNG: 'image/png', WEBP: 'image/webp', ICO: 'image/png' }

interface QueueItem {
  id: string
  file: File
  name: string
  preview: string
  status: 'pending' | 'converting' | 'done' | 'error'
  resultUrl?: string
  resultName?: string
}

// Recursively read a dropped directory entry into a flat list of File objects.
function readEntry(entry: any): Promise<File[]> {
  return new Promise(resolve => {
    if (entry.isFile) {
      entry.file((f: File) => resolve([f]), () => resolve([]))
    } else if (entry.isDirectory) {
      const reader = entry.createReader()
      const all: File[] = []
      const readBatch = () => {
        reader.readEntries(async (entries: any[]) => {
          if (entries.length === 0) { resolve(all); return }
          for (const e of entries) { const files = await readEntry(e); all.push(...files) }
          readBatch()
        }, () => resolve(all))
      }
      readBatch()
    } else resolve([])
  })
}

function ImageConverter() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [targetFormat, setTargetFormat] = useState<Format>('PNG')
  const [converting, setConverting] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  // En la app de escritorio los convertidos se guardan en Documentos/Nova Nexus/Conversiones.
  const isDesktop = !!window.electronAPI?.saveConversion

  const saveToConversions = async (name: string, url: string): Promise<boolean> => {
    if (!window.electronAPI?.saveConversion) return false
    try { const b64 = await blobUrlToBase64(url); const r = await window.electronAPI.saveConversion(name, b64); return !!r?.success } catch { return false }
  }

  const addFiles = (files: File[]) => {
    const imgs = files.filter(f => f.type.startsWith('image/'))
    if (imgs.length === 0) return
    const newItems: QueueItem[] = imgs.map(f => ({
      id: 'q-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      file: f,
      name: f.name,
      preview: URL.createObjectURL(f),
      status: 'pending',
    }))
    setItems(prev => [...prev, ...newItems])
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setDragActive(false)
    const dt = e.dataTransfer
    // Try directory-aware traversal first (supports dropping whole folders).
    const entries: any[] = []
    if (dt.items && dt.items.length) {
      for (let i = 0; i < dt.items.length; i++) {
        const entry = (dt.items[i] as any).webkitGetAsEntry?.()
        if (entry) entries.push(entry)
      }
    }
    if (entries.length) {
      const collected: File[] = []
      for (const entry of entries) { const files = await readEntry(entry); collected.push(...files) }
      addFiles(collected)
    } else {
      addFiles(Array.from(dt.files))
    }
  }

  const removeItem = (id: string) => {
    setItems(prev => {
      const it = prev.find(x => x.id === id)
      if (it) { URL.revokeObjectURL(it.preview); if (it.resultUrl) URL.revokeObjectURL(it.resultUrl) }
      return prev.filter(x => x.id !== id)
    })
  }

  const clearAll = () => {
    items.forEach(it => { URL.revokeObjectURL(it.preview); if (it.resultUrl) URL.revokeObjectURL(it.resultUrl) })
    setItems([])
  }

  const convertItem = async (item: QueueItem): Promise<{ url: string; name: string } | null> => {
    try {
      const img = new Image(); const url = URL.createObjectURL(item.file)
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = url })
      const size = targetFormat === 'ICO' ? 64 : undefined
      const canvas = document.createElement('canvas')
      canvas.width = size || img.width; canvas.height = size || img.height
      const ctx = canvas.getContext('2d')!
      if (targetFormat === 'JPG') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height) }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url)
      const blob = await new Promise<Blob>((res, rej) => { canvas.toBlob(b => b ? res(b) : rej(), mimeMap[targetFormat], 0.92) })
      const base = item.name.replace(/\.[^.]+$/, '')
      return { url: URL.createObjectURL(blob), name: `${base}.${targetFormat.toLowerCase()}` }
    } catch { return null }
  }

  const convertAll = async () => {
    setConverting(true)
    let saved = 0
    for (const item of items) {
      if (item.status === 'done') continue
      setItems(prev => prev.map(x => x.id === item.id ? { ...x, status: 'converting' } : x))
      const result = await convertItem(item)
      setItems(prev => prev.map(x => x.id === item.id ? (result ? { ...x, status: 'done', resultUrl: result.url, resultName: result.name } : { ...x, status: 'error' }) : x))
      // Guardado automático en Documentos/Nova Nexus/Conversiones (escritorio).
      if (result && isDesktop && await saveToConversions(result.name, result.url)) saved++
    }
    setConverting(false)
    if (saved > 0) toast.success(`${saved} archivo(s) guardado(s) en Documentos › Nova Nexus › Conversiones`)
  }

  const downloadOne = async (item: QueueItem) => {
    if (!item.resultUrl || !item.resultName) return
    // En escritorio: reguardar en la carpeta Conversiones. En navegador: descarga clásica.
    if (isDesktop) { if (await saveToConversions(item.resultName, item.resultUrl)) toast.success(`Guardado en Conversiones: ${item.resultName}`); return }
    const a = document.createElement('a'); a.href = item.resultUrl; a.download = item.resultName; a.click()
  }

  const downloadAll = () => {
    const done = items.filter(i => i.status === 'done' && i.resultUrl)
    done.forEach((item, i) => { setTimeout(() => downloadOne(item), i * 250) })
  }
  const openFolder = () => { window.electronAPI?.openConversionsFolder?.() }

  const pendingCount = items.filter(i => i.status !== 'done').length
  const doneCount = items.filter(i => i.status === 'done').length

  return (
    <div className="card converter-card converter-wide">
      <div className="card-title"><ImageIcon size={16} /> Convertidor de Imágenes</div>

      <div className={`drop-zone ${dragActive ? 'drag-active' : ''}`} onDrop={handleDrop} onDragOver={e => { e.preventDefault(); setDragActive(true) }} onDragLeave={() => setDragActive(false)}>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = '' }} />
        {/* webkitdirectory lets the picker select an entire folder. */}
        <input ref={folderRef} type="file" {...({ webkitdirectory: '', directory: '' } as any)} multiple style={{ display: 'none' }} onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = '' }} />
        <div className="drop-placeholder">
          <Upload size={28} />
          <span>Arrastrá imágenes o carpetas aquí</span>
          <div className="drop-actions">
            <button className="drop-btn" onClick={() => fileRef.current?.click()}><ImageIcon size={14} /> Elegir archivos</button>
            <button className="drop-btn" onClick={() => folderRef.current?.click()}><FolderOpen size={14} /> Elegir carpeta</button>
          </div>
          <span className="drop-formats">JPG, PNG, WEBP, ICO · múltiples archivos</span>
        </div>
      </div>

      {items.length > 0 && (
        <>
          <div className="converter-toolbar">
            <div className="format-flow">
              <span className="format-to-label">Convertir a:</span>
              <div className="format-selector">{FORMATS.map(f => (<button key={f} className={`format-opt ${targetFormat === f ? 'active' : ''}`} onClick={() => setTargetFormat(f)}>{f}</button>))}</div>
            </div>
            <div className="converter-toolbar-right">
              <span className="converter-count">{items.length} {items.length === 1 ? 'imagen' : 'imágenes'}</span>
              <button className="converter-clear" onClick={clearAll}><Trash2 size={13} /> Limpiar</button>
            </div>
          </div>

          <div className="converter-queue">
            {items.map(item => (
              <div key={item.id} className={`queue-item status-${item.status}`}>
                <img src={item.preview} alt="" className="queue-thumb" />
                <div className="queue-info">
                  <span className="queue-name" title={item.name}>{item.name}</span>
                  <span className="queue-status">
                    {item.status === 'pending' && 'En espera'}
                    {item.status === 'converting' && <><Loader size={11} className="spin" /> Convirtiendo…</>}
                    {item.status === 'done' && <><Check size={11} /> {item.resultName}</>}
                    {item.status === 'error' && 'Error'}
                  </span>
                </div>
                {item.status === 'done' && <button className="queue-download" onClick={() => downloadOne(item)} title={isDesktop ? 'Guardar en Conversiones' : 'Descargar'}><Download size={14} /></button>}
                <button className="queue-remove" onClick={() => removeItem(item.id)}><X size={13} /></button>
              </div>
            ))}
          </div>

          <div className="converter-footer">
            <button className="convert-btn" onClick={convertAll} disabled={converting || pendingCount === 0}>
              {converting ? 'Convirtiendo…' : `Convertir ${pendingCount > 0 ? pendingCount : ''} a ${targetFormat}`}
            </button>
            {doneCount > 0 && <button className="download-all-btn" onClick={downloadAll}><Download size={15} /> {isDesktop ? `Guardar todo (${doneCount})` : `Descargar todo (${doneCount})`}</button>}
            {isDesktop && doneCount > 0 && <button className="download-all-btn" onClick={openFolder}><FolderOpen size={15} /> Abrir carpeta</button>}
          </div>
        </>
      )}
    </div>
  )
}

// ============ MAIN ============
// Dos páginas: el Conversor de imágenes y la Guía de Apps. El tab activo se persiste.
type EdTab = 'conversor' | 'guia'
export default function EdicionSection() {
  // El tab activo vive en la ruta de la pestaña; el último elegido queda como preferencia
  // para cuando la sección se abre sin ruta.
  const [saved] = useState<EdTab>(() => {
    try { return (localStorage.getItem('nn-edicion-tab') as EdTab) || 'conversor' } catch { return 'conversor' }
  })
  const { tab, setTab, tabProps } = useSubTab(0, saved, [{ id: 'conversor', label: 'Conversor' }, { id: 'guia', label: 'Guía de Apps' }])
  const go = (t: EdTab, label: string) => { setTab(t, label); try { localStorage.setItem('nn-edicion-tab', t) } catch {} }
  return (
    <div className="edicion-section">
      <div className="edicion-tabs">
        <button className={`edicion-tab ${tab === 'conversor' ? 'active' : ''}`} onClick={() => go('conversor', 'Conversor')} {...tabProps('conversor', 'Conversor')}><RefreshCw size={13} /> Conversor</button>
        <button className={`edicion-tab ${tab === 'guia' ? 'active' : ''}`} onClick={() => go('guia', 'Guía de Apps')} {...tabProps('guia', 'Guía de Apps')}><BookOpen size={13} /> Guía de Apps</button>
      </div>
      {tab === 'conversor' && <ImageConverter />}
      {tab === 'guia' && <GuiaAppsPage />}
    </div>
  )
}
