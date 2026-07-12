import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, Search, Copy, FolderPlus, Folder, ChevronRight, ChevronDown, Tag, X, Check, Clock } from 'lucide-react'
import { useConfirm } from '../ConfirmDialog'
import RichTextEditor from '../RichTextEditor'
import './NotasSection.css'

interface Note {
  id: string
  title: string
  content: string
  createdAt: string
  tags: string[]
  folderId: string | null
  ephemeral?: boolean
  createdTs?: number
  expiresInDays?: number
}

interface NoteFolder {
  id: string
  name: string
}
const DEFAULT_TAGS = ['recordar', 'curioso', 'revisar']

const TAG_COLORS: Record<string, string> = { recordar: '#3b82f6', curioso: '#f59e0b', revisar: '#ef4444' }
const TAG_PALETTE = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#10b981']
function tagColor(tag: string): string {
  if (!TAG_COLORS[tag]) TAG_COLORS[tag] = TAG_PALETTE[Object.keys(TAG_COLORS).length % TAG_PALETTE.length]
  return TAG_COLORS[tag]
}

function defaultAutoDeleteDays(): number { try { const s = localStorage.getItem('nn-notes-autodelete-days'); return s ? Number(s) : 7 } catch { return 7 } }

function loadNotes(): Note[] {
  try {
    const s = localStorage.getItem('nn-notas')
    if (s) {
      const parsed = JSON.parse(s) as Note[]
      const now = Date.now()
      // Purge expired ephemeral notes on load.
      const kept = parsed.filter(n => {
        if (!n.ephemeral || !n.createdTs || !n.expiresInDays) return true
        return now - n.createdTs < n.expiresInDays * 86400000
      })
      return kept.map(n => ({ ...n, tags: n.tags || [], folderId: n.folderId ?? null }))
    }
  } catch {}
  return []
}
function saveNotes(n: Note[]) { localStorage.setItem('nn-notas', JSON.stringify(n)) }

function loadFolders(): NoteFolder[] {
  try { const s = localStorage.getItem('nn-notas-folders'); return s ? JSON.parse(s) : [] } catch { return [] }
}
function saveFolders(f: NoteFolder[]) { localStorage.setItem('nn-notas-folders', JSON.stringify(f)) }

export default function NotasSection() {
  const [notes, setNotes] = useState<Note[]>(loadNotes)
  const [folders, setFolders] = useState<NoteFolder[]>(loadFolders)
  const [activeNote, setActiveNote] = useState<string | null>(null)
  const [seedVersion, setSeedVersion] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFolder, setActiveFolder] = useState<string | null>('__all')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['__all']))
  const [tagInput, setTagInput] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const confirm = useConfirm()
  const [filterTag, setFilterTag] = useState<string | null>(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [dragNoteId, setDragNoteId] = useState<string | null>(null)
  const [dropFolder, setDropFolder] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const tagInputRef = useRef<HTMLInputElement>(null)
  const newFolderRef = useRef<HTMLInputElement>(null)
  // Snapshot of the note when it was opened, so "Cancelar" can revert unsaved edits.
  const snapshot = useRef<{ title: string; content: string } | null>(null)

  useEffect(() => { saveNotes(notes) }, [notes])
  useEffect(() => { saveFolders(folders) }, [folders])
  useEffect(() => { if (showTagInput) tagInputRef.current?.focus() }, [showTagInput])
  useEffect(() => { if (showNewFolder) newFolderRef.current?.focus() }, [showNewFolder])

  // Set editor HTML only when the active note CHANGES (not on every keystroke).
  // This is the key fix: binding dangerouslySetInnerHTML to live content reset the
  // caret and discarded color/formatting on each render.
  // Al cambiar de nota, guardar un snapshot para poder cancelar los cambios.
  useEffect(() => {
    const note = notes.find(n => n.id === activeNote)
    snapshot.current = note ? { title: note.title, content: note.content } : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNote])

  const flashSaved = () => { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1200) }
  const saveCurrent = () => { if (activeNote) { const cur = notes.find(n => n.id === activeNote); snapshot.current = { title: cur?.title || '', content: cur?.content || '' }; flashSaved() } }
  const cancelEdits = () => {
    if (!activeNote || !snapshot.current) return
    const snap = snapshot.current
    setNotes(prev => prev.map(n => n.id === activeNote ? { ...n, title: snap.title, content: snap.content } : n))
    setSeedVersion(v => v + 1) // fuerza al editor a re-sembrar el contenido revertido
  }
  const toggleEphemeral = (id: string) => {
    setNotes(prev => prev.map(n => n.id === id ? (n.ephemeral ? { ...n, ephemeral: false } : { ...n, ephemeral: true, createdTs: n.createdTs || Date.now(), expiresInDays: n.expiresInDays || defaultAutoDeleteDays() }) : n))
  }
  function daysLeft(n: Note): number | null {
    if (!n.ephemeral || !n.createdTs || !n.expiresInDays) return null
    return Math.max(0, Math.ceil((n.createdTs + n.expiresInDays * 86400000 - Date.now()) / 86400000))
  }

  const addNote = () => {
    const note: Note = {
      id: crypto.randomUUID(),
      title: 'Nueva nota',
      content: '',
      createdAt: new Date().toLocaleDateString('es-AR'),
      createdTs: Date.now(),
      tags: [],
      folderId: activeFolder === '__all' ? null : activeFolder,
    }
    setNotes(prev => [note, ...prev])
    setActiveNote(note.id)
  }

  const duplicateNote = (id: string) => {
    const original = notes.find(n => n.id === id)
    if (!original) return
    const dup: Note = { ...original, id: crypto.randomUUID(), title: original.title + ' (copia)', createdAt: new Date().toLocaleDateString('es-AR') }
    setNotes(prev => [dup, ...prev])
    setActiveNote(dup.id)
  }

  const deleteNote = async (id: string) => {
    const n = notes.find(x => x.id === id)
    if (!await confirm({ title: 'Eliminar nota', message: `¿Eliminar la nota «${n?.title?.trim() || 'sin título'}»?` })) return
    setNotes(prev => prev.filter(n => n.id !== id))
    if (activeNote === id) setActiveNote(null)
  }

  const updateTitle = (id: string, title: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, title } : n))
  }

  // Persiste el contenido del Editor de Textos en la nota activa.
  const setContent = (html: string) => {
    if (!activeNote) return
    setNotes(prev => prev.map(n => n.id === activeNote ? { ...n, content: html } : n))
  }

  const addTag = (noteId: string, tag: string) => {
    const t = tag.trim().toLowerCase()
    if (!t) return
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, tags: n.tags.includes(t) ? n.tags : [...n.tags, t] } : n))
    setTagInput('')
  }

  const removeTag = (noteId: string, tag: string) => {
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, tags: n.tags.filter(tt => tt !== tag) } : n))
  }

  const confirmNewFolder = () => {
    const name = newFolderName.trim()
    if (!name) { setShowNewFolder(false); return }
    const f: NoteFolder = { id: crypto.randomUUID(), name }
    setFolders(prev => [...prev, f])
    setExpandedFolders(prev => new Set([...prev, f.id]))
    setNewFolderName(''); setShowNewFolder(false)
  }

  const deleteFolder = async (id: string) => {
    const f = folders.find(x => x.id === id)
    if (!await confirm({ title: 'Eliminar carpeta', message: `¿Eliminar la carpeta «${f?.name || ''}»? Las notas no se borran: pasan a «Todas».`, confirmLabel: 'Eliminar carpeta' })) return
    setFolders(prev => prev.filter(f => f.id !== id))
    setNotes(prev => prev.map(n => n.folderId === id ? { ...n, folderId: null } : n))
    if (activeFolder === id) setActiveFolder('__all')
  }

  const moveToFolder = (noteId: string, folderId: string | null) => {
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, folderId } : n))
    flashSaved()
  }

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  const allTags = Array.from(new Set([...DEFAULT_TAGS, ...notes.flatMap(n => n.tags)]))

  const filtered = notes.filter(n => {
    if (filterTag && !n.tags.includes(filterTag)) return false
    if (activeFolder && activeFolder !== '__all' && n.folderId !== activeFolder) return false
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.tags.some(t => t.includes(q))
  })

  const current = notes.find(n => n.id === activeNote)

  // Al entrar sin ninguna nota, mostrar solo un botón grande de «Añadir nota».
  if (notes.length === 0) {
    return (
      <div className="notas-section notas-empty-state">
        <button className="notas-empty-add" onClick={addNote}>
          <Plus size={30} /> Añadir nota
        </button>
      </div>
    )
  }

  return (
    <div className="notas-section">
      <div className="notas-sidebar">
        <div className="notas-sidebar-header">
          <div className="notas-search-wrap">
            <Search size={13} className="notas-search-icon" />
            <input className="notas-search" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar notas..." />
          </div>
          <button className="notas-add" onClick={addNote} title="Nueva nota"><Plus size={18} /></button>
        </div>

        <div className="notas-folders">
          <button
            className={`notas-folder-item ${activeFolder === '__all' ? 'active' : ''} ${dropFolder === '__all' ? 'drop-target' : ''}`}
            onClick={() => { setActiveFolder('__all'); setFilterTag(null) }}
            onDragOver={e => { if (dragNoteId) { e.preventDefault(); setDropFolder('__all') } }}
            onDragLeave={() => setDropFolder(d => d === '__all' ? null : d)}
            onDrop={() => { if (dragNoteId) moveToFolder(dragNoteId, null); setDragNoteId(null); setDropFolder(null) }}
          >
            <Folder size={13} /> <span>Todas</span>
            <span className="notas-folder-count">{notes.length}</span>
          </button>
          {folders.map(f => (
            <div key={f.id} className="notas-folder-group">
              <button
                className={`notas-folder-item ${activeFolder === f.id ? 'active' : ''} ${dropFolder === f.id ? 'drop-target' : ''}`}
                onClick={() => { setActiveFolder(f.id); setFilterTag(null) }}
                onDragOver={e => { if (dragNoteId) { e.preventDefault(); setDropFolder(f.id) } }}
                onDragLeave={() => setDropFolder(d => d === f.id ? null : d)}
                onDrop={() => { if (dragNoteId) moveToFolder(dragNoteId, f.id); setDragNoteId(null); setDropFolder(null) }}
              >
                <span className="notas-folder-chevron" onClick={e => { e.stopPropagation(); toggleFolder(f.id) }}>
                  {expandedFolders.has(f.id) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </span>
                <span className="notas-folder-name">{f.name}</span>
                <span className="notas-folder-count">{notes.filter(n => n.folderId === f.id).length}</span>
                <button className="notas-folder-delete" onClick={e => { e.stopPropagation(); deleteFolder(f.id) }} title="Eliminar carpeta"><X size={11} /></button>
              </button>
            </div>
          ))}
          {showNewFolder ? (
            <div className="notas-new-folder">
              <input
                ref={newFolderRef}
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmNewFolder(); else if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName('') } }}
                placeholder="Nombre de la carpeta..."
              />
              <button className="notas-nf-confirm" onClick={confirmNewFolder}><Check size={12} /></button>
              <button className="notas-nf-cancel" onClick={() => { setShowNewFolder(false); setNewFolderName('') }}><X size={12} /></button>
            </div>
          ) : (
            <button className="notas-add-folder" onClick={() => setShowNewFolder(true)}><FolderPlus size={13} /> Nueva carpeta</button>
          )}
        </div>

        <div className="notas-tags-filter">
          <span className="notas-tags-label">Etiquetas</span>
          <div className="notas-tags-list">
            {allTags.map(t => (
              <button key={t} className={`notas-tag-chip ${filterTag === t ? 'active' : ''}`} style={{ '--tag-color': tagColor(t) } as React.CSSProperties} onClick={() => setFilterTag(filterTag === t ? null : t)}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="notas-list">
          {filtered.map(n => (
            <div
              key={n.id}
              className={`nota-item ${activeNote === n.id ? 'active' : ''} ${dragNoteId === n.id ? 'dragging' : ''}`}
              onDoubleClick={() => setActiveNote(n.id)}
              title="Doble clic para abrir la nota"
              draggable
              onDragStart={() => setDragNoteId(n.id)}
              onDragEnd={() => { setDragNoteId(null); setDropFolder(null) }}
            >
              <span className="nota-title">{n.title}</span>
              <div className="nota-meta">
                <span className="nota-date">{n.createdAt}</span>
                {n.tags.length > 0 && <span className="nota-tag-dots">{n.tags.map(t => <span key={t} className="nota-tag-dot" style={{ background: tagColor(t) }} title={t} />)}</span>}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="notas-empty">{searchQuery ? 'Sin resultados' : 'Creá tu primera nota con el botón +'}</p>
          )}
        </div>
      </div>

      <div className="notas-editor">
        {current ? (
          <>
            <div className="notas-editor-header">
              <input
                className="nota-title-input"
                value={current.title}
                onChange={e => updateTitle(current.id, e.target.value)}
                placeholder="Título de la nota"
              />
              <div className="notas-editor-actions">
                {savedFlash && <span className="nota-saved-flash"><Check size={12} /> Guardado</span>}
                {current.ephemeral && daysLeft(current) != null && <span className="nota-ephemeral-badge"><Clock size={11} /> {daysLeft(current)}d</span>}
                {folders.length > 0 && (
                  <select className="nota-folder-select" value={current.folderId || ''} onChange={e => moveToFolder(current.id, e.target.value || null)}>
                    <option value="">Sin carpeta</option>
                    {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                )}
                <button className={`nota-action-btn ${current.ephemeral ? 'active' : ''}`} onClick={() => toggleEphemeral(current.id)} title="Auto-eliminar tras N días"><Clock size={14} /></button>
                <button className="nota-action-btn" onClick={() => duplicateNote(current.id)} title="Duplicar"><Copy size={14} /></button>
                <button className="nota-action-btn danger" onClick={() => deleteNote(current.id)} title="Eliminar"><Trash2 size={14} /></button>
              </div>
            </div>

            <div className="notas-tags-row">
              {current.tags.map(t => (
                <span key={t} className="nota-tag" style={{ '--tag-color': tagColor(t) } as React.CSSProperties}>
                  {t}
                  <button className="nota-tag-remove" onClick={() => removeTag(current.id, t)}><X size={10} /></button>
                </span>
              ))}
              {showTagInput ? (
                <input
                  ref={tagInputRef}
                  className="nota-tag-input"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { addTag(current.id, tagInput); setShowTagInput(false) } else if (e.key === 'Escape') setShowTagInput(false) }}
                  onBlur={() => { if (tagInput.trim()) addTag(current.id, tagInput); setShowTagInput(false) }}
                  placeholder="etiqueta..."
                  list="nota-tag-suggestions"
                />
              ) : (
                <button className="nota-add-tag" onClick={() => setShowTagInput(true)}><Tag size={11} /> +</button>
              )}
              <datalist id="nota-tag-suggestions">
                {DEFAULT_TAGS.map(t => <option key={t} value={t} />)}
              </datalist>
            </div>

            <RichTextEditor
              docKey={`${activeNote}-${seedVersion}`}
              html={current.content}
              onChange={setContent}
              placeholder="Escribí tu nota..."
              minHeight={280}
              className="notas-rte"
            />

            <div className="notas-save-bar">
              <button className="notas-cancel-btn" onClick={cancelEdits}>Cancelar</button>
              <button className="notas-save-btn" onClick={saveCurrent}><Check size={14} /> Guardar</button>
            </div>
          </>
        ) : (
          <div className="editor-placeholder">
            <p>Seleccioná o creá una nota para empezar</p>
          </div>
        )}
      </div>
    </div>
  )
}
