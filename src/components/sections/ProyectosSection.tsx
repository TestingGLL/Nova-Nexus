import { useState, useRef, useEffect } from 'react'
import { FolderKanban, Plus, Trash2, Tag, Search, LayoutList, Columns3, GripVertical, ChevronDown, Edit3, Check } from 'lucide-react'
import { useConfirm } from '../ConfirmDialog'
import { allProjectLabels, type ProjectLabel } from '../../lib/projectLabels'
import './ProyectosSection.css'

type ProjectStatus = 'sinempezar' | 'todo' | 'progress' | 'done' | 'archived'

interface Project {
  id: string
  title: string
  description: string
  type: string
  status: ProjectStatus
  createdAt: string
}

const statusLabels: Record<ProjectStatus, string> = { sinempezar: 'Sin Empezar', todo: 'Por hacer', progress: 'En progreso', done: 'Completado', archived: 'Archivado' }
const statusColors: Record<ProjectStatus, string> = { sinempezar: '#94a3b8', todo: '#6b7280', progress: '#3b82f6', done: '#22c55e', archived: '#8b5cf6' }
const statusOrder: ProjectStatus[] = ['sinempezar', 'todo', 'progress', 'done', 'archived']

function loadProjects(): Project[] {
  try {
    const s = localStorage.getItem('nn-projects')
    if (s) {
      const parsed = JSON.parse(s) as Project[]
      return parsed.map(p => ({ ...p, status: p.status || 'todo' }))
    }
  } catch {}
  return []
}
function saveProjects(p: Project[]) { localStorage.setItem('nn-projects', JSON.stringify(p)) }

function ProjectCard({ p, labels, typeLabel, typeColor, onUpdate, onDelete, onStatusChange, dragHandlers }: { p: Project; labels: ProjectLabel[]; typeLabel: string; typeColor: string; onUpdate: (u: Partial<Project>) => void; onDelete: () => void; onStatusChange?: (s: ProjectStatus) => void; dragHandlers?: Record<string, any> }) {
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  return (
    <div className="card proyecto-item" {...dragHandlers}>
      {dragHandlers && <GripVertical size={12} className="proyecto-grip" />}
      <div className="proyecto-header">
        {editing
          ? <input className="proyecto-title-edit" value={p.title} onChange={e => onUpdate({ title: e.target.value })} placeholder="Título del proyecto" autoFocus />
          : <h3 className="proyecto-title">{p.title}</h3>}
        <div className="proyecto-actions">
          <div className="proyecto-type-wrap">
            <button className="proyecto-type-badge" style={{ background: typeColor + '18', color: typeColor }} onClick={() => setShowTypeMenu(v => !v)} title="Cambiar etiqueta"><Tag size={10} /> {typeLabel} <ChevronDown size={9} /></button>
            {showTypeMenu && (
              <div className="proyecto-status-menu">
                {labels.map(l => (
                  <button key={l.id} className={`proyecto-status-option ${p.type === l.id ? 'active' : ''}`} onClick={() => { onUpdate({ type: l.id }); setShowTypeMenu(false) }} style={{ '--status-color': l.color } as React.CSSProperties}>
                    <span className="proyecto-status-dot" style={{ background: l.color }} />{l.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {onStatusChange && (
            <div className="proyecto-status-wrap">
              <button className="proyecto-status-btn" style={{ color: statusColors[p.status] }} onClick={() => setShowStatusMenu(!showStatusMenu)}>
                {statusLabels[p.status]} <ChevronDown size={10} />
              </button>
              {showStatusMenu && (
                <div className="proyecto-status-menu">
                  {statusOrder.map(s => (
                    <button key={s} className={`proyecto-status-option ${p.status === s ? 'active' : ''}`} onClick={() => { onStatusChange(s); setShowStatusMenu(false) }} style={{ '--status-color': statusColors[s] } as React.CSSProperties}>
                      <span className="proyecto-status-dot" style={{ background: statusColors[s] }} />
                      {statusLabels[s]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button className="proyecto-edit" onClick={() => setEditing(e => !e)} title={editing ? 'Listo' : 'Editar'}>{editing ? <Check size={14} /> : <Edit3 size={14} />}</button>
          <button className="proyecto-delete" onClick={onDelete}><Trash2 size={14} /></button>
        </div>
      </div>
      {editing
        ? <textarea className="proyecto-desc-edit" value={p.description} onChange={e => onUpdate({ description: e.target.value })} placeholder="Descripción (opcional)" rows={2} />
        : (p.description && <p className="proyecto-desc">{p.description}</p>)}
      <span className="proyecto-date">{new Date(p.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
    </div>
  )
}

export default function ProyectosSection() {
  const [projects, setProjects] = useState<Project[]>(loadProjects)
  const [showNew, setShowNew] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [type, setType] = useState<string>('propio')
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const dragRef = useRef<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<ProjectStatus | null>(null)
  const confirm = useConfirm()

  // Built-in + custom labels (managed from Configuración → Adicionales).
  const [labels, setLabels] = useState(allProjectLabels)
  useEffect(() => {
    const refresh = () => setLabels(allProjectLabels())
    window.addEventListener('nn-project-labels-updated', refresh)
    window.addEventListener('storage', refresh)
    return () => { window.removeEventListener('nn-project-labels-updated', refresh); window.removeEventListener('storage', refresh) }
  }, [])
  const typeLabel = (id: string) => labels.find(l => l.id === id)?.label || id
  const typeColor = (id: string) => labels.find(l => l.id === id)?.color || '#6b7280'

  const save = (p: Project[]) => { setProjects(p); saveProjects(p) }

  const addProject = () => {
    if (!title.trim()) return
    save([{ id: 'proj-' + Date.now(), title: title.trim(), description: desc.trim(), type, status: 'sinempezar', createdAt: new Date().toISOString() }, ...projects])
    setTitle(''); setDesc(''); setType('propio'); setShowNew(false)
  }

  const removeProject = async (id: string) => {
    const p = projects.find(x => x.id === id)
    if (!await confirm({ title: 'Eliminar proyecto', message: `¿Eliminar el proyecto «${p?.title || ''}»?` })) return
    save(projects.filter(p => p.id !== id))
  }
  const changeStatus = (id: string, status: ProjectStatus) => save(projects.map(p => p.id === id ? { ...p, status } : p))
  const updateProject = (id: string, u: Partial<Project>) => save(projects.map(p => p.id === id ? { ...p, ...u } : p))

  const searched = projects.filter(p => {
    if (filter !== 'all' && p.type !== filter) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
  })

  return (
    <div className="proyectos-section">
      <div className="proyectos-top-bar">
        <div className="proyectos-search-wrap">
          <Search size={14} className="proyectos-search-icon" />
          <input className="proyectos-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar proyectos..." />
        </div>
        <div className="proyectos-view-toggle">
          <button className={`view-btn ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')} title="Lista"><LayoutList size={15} /></button>
          <button className={`view-btn ${view === 'kanban' ? 'active' : ''}`} onClick={() => setView('kanban')} title="Tablero"><Columns3 size={15} /></button>
        </div>
        <button className="proyectos-new-btn" onClick={() => setShowNew(!showNew)}><Plus size={14} /> Nuevo</button>
      </div>

      {showNew && (
        <div className="card proyectos-form">
          <input className="proyectos-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Título del proyecto" autoFocus />
          <textarea className="proyectos-textarea" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción (opcional)" rows={3} />
          <div className="proyectos-type-row">
            {labels.map(t => (
              <button key={t.id} className={`proyectos-type-btn ${type === t.id ? 'active' : ''}`} style={{ '--type-color': t.color } as React.CSSProperties} onClick={() => setType(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <button className="proyectos-save" onClick={addProject} disabled={!title.trim()}>Crear proyecto</button>
        </div>
      )}

      <div className="proyectos-filters">
        <button className={`proyectos-filter ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Todos</button>
        {labels.map(t => (
          <button key={t.id} className={`proyectos-filter ${filter === t.id ? 'active' : ''}`} onClick={() => setFilter(t.id)} style={{ '--type-color': t.color } as React.CSSProperties}>
            {t.label}
          </button>
        ))}
      </div>

      {view === 'list' ? (
        <div className="proyectos-list">
          {searched.length === 0 && <div className="proyectos-empty"><FolderKanban size={28} /><p>Sin proyectos{filter !== 'all' ? ` de tipo ${typeLabel(filter)}` : ''}</p></div>}
          {searched.map(p => (
            <ProjectCard key={p.id} p={p} labels={labels} typeLabel={typeLabel(p.type)} typeColor={typeColor(p.type)} onUpdate={u => updateProject(p.id, u)} onDelete={() => removeProject(p.id)} onStatusChange={s => changeStatus(p.id, s)} />
          ))}
        </div>
      ) : (
        <div className="kanban-board">
          {statusOrder.map(status => {
            const colProjects = searched.filter(p => p.status === status)
            return (
              <div
                key={status}
                className={`kanban-column ${dragOverCol === status ? 'drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOverCol(status) }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={() => {
                  if (dragRef.current) { changeStatus(dragRef.current, status) }
                  dragRef.current = null
                  setDragOverCol(null)
                }}
              >
                <div className="kanban-column-header">
                  <span className="kanban-column-dot" style={{ background: statusColors[status] }} />
                  <span className="kanban-column-title">{statusLabels[status]}</span>
                  <span className="kanban-column-count">{colProjects.length}</span>
                </div>
                <div className="kanban-column-cards">
                  {colProjects.map(p => (
                    <ProjectCard
                      key={p.id}
                      p={p}
                      labels={labels}
                      typeLabel={typeLabel(p.type)}
                      typeColor={typeColor(p.type)}
                      onUpdate={u => updateProject(p.id, u)}
                      onDelete={() => removeProject(p.id)}
                      dragHandlers={{
                        draggable: true,
                        onDragStart: () => { dragRef.current = p.id },
                        onDragEnd: () => { dragRef.current = null; setDragOverCol(null) },
                      }}
                    />
                  ))}
                  {colProjects.length === 0 && <div className="kanban-empty">Arrastrá proyectos aquí</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
