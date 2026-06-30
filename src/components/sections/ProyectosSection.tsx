import { useState, useRef } from 'react'
import { FolderKanban, Plus, Trash2, Tag, Search, LayoutList, Columns3, GripVertical, ChevronDown } from 'lucide-react'
import { useConfirm } from '../ConfirmDialog'
import './ProyectosSection.css'

type ProjectType = 'freelancer' | 'propio' | 'etsy' | 'producto' | 'servicio'
type ProjectStatus = 'todo' | 'progress' | 'done' | 'archived'

interface Project {
  id: string
  title: string
  description: string
  type: ProjectType
  status: ProjectStatus
  createdAt: string
}

const typeLabels: Record<ProjectType, string> = { freelancer: 'Freelancer', propio: 'Propio', etsy: 'Etsy', producto: 'Producto', servicio: 'Servicio' }
const typeColors: Record<ProjectType, string> = { freelancer: '#8b5cf6', propio: '#3b82f6', etsy: '#f97316', producto: '#22c55e', servicio: '#06b6d4' }
const statusLabels: Record<ProjectStatus, string> = { todo: 'Por hacer', progress: 'En progreso', done: 'Completado', archived: 'Archivado' }
const statusColors: Record<ProjectStatus, string> = { todo: '#6b7280', progress: '#3b82f6', done: '#22c55e', archived: '#8b5cf6' }
const statusOrder: ProjectStatus[] = ['todo', 'progress', 'done', 'archived']

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

function ProjectCard({ p, onDelete, onStatusChange, dragHandlers }: { p: Project; onDelete: () => void; onStatusChange?: (s: ProjectStatus) => void; dragHandlers?: Record<string, any> }) {
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  return (
    <div className="card proyecto-item" {...dragHandlers}>
      {dragHandlers && <GripVertical size={12} className="proyecto-grip" />}
      <div className="proyecto-header">
        <h3 className="proyecto-title">{p.title}</h3>
        <div className="proyecto-actions">
          <span className="proyecto-type-badge" style={{ background: typeColors[p.type] + '18', color: typeColors[p.type] }}><Tag size={10} /> {typeLabels[p.type]}</span>
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
          <button className="proyecto-delete" onClick={onDelete}><Trash2 size={14} /></button>
        </div>
      </div>
      {p.description && <p className="proyecto-desc">{p.description}</p>}
      <span className="proyecto-date">{new Date(p.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
    </div>
  )
}

export default function ProyectosSection() {
  const [projects, setProjects] = useState<Project[]>(loadProjects)
  const [showNew, setShowNew] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [type, setType] = useState<ProjectType>('propio')
  const [filter, setFilter] = useState<ProjectType | 'all'>('all')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const dragRef = useRef<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<ProjectStatus | null>(null)
  const confirm = useConfirm()

  const save = (p: Project[]) => { setProjects(p); saveProjects(p) }

  const addProject = () => {
    if (!title.trim()) return
    save([{ id: 'proj-' + Date.now(), title: title.trim(), description: desc.trim(), type, status: 'todo', createdAt: new Date().toISOString() }, ...projects])
    setTitle(''); setDesc(''); setType('propio'); setShowNew(false)
  }

  const removeProject = async (id: string) => {
    const p = projects.find(x => x.id === id)
    if (!await confirm({ title: 'Eliminar proyecto', message: `¿Eliminar el proyecto «${p?.title || ''}»?` })) return
    save(projects.filter(p => p.id !== id))
  }
  const changeStatus = (id: string, status: ProjectStatus) => save(projects.map(p => p.id === id ? { ...p, status } : p))

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
            {(Object.keys(typeLabels) as ProjectType[]).map(t => (
              <button key={t} className={`proyectos-type-btn ${type === t ? 'active' : ''}`} style={{ '--type-color': typeColors[t] } as React.CSSProperties} onClick={() => setType(t)}>
                {typeLabels[t]}
              </button>
            ))}
          </div>
          <button className="proyectos-save" onClick={addProject} disabled={!title.trim()}>Crear proyecto</button>
        </div>
      )}

      <div className="proyectos-filters">
        <button className={`proyectos-filter ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Todos</button>
        {(Object.keys(typeLabels) as ProjectType[]).map(t => (
          <button key={t} className={`proyectos-filter ${filter === t ? 'active' : ''}`} onClick={() => setFilter(t)} style={{ '--type-color': typeColors[t] } as React.CSSProperties}>
            {typeLabels[t]}
          </button>
        ))}
      </div>

      {view === 'list' ? (
        <div className="proyectos-list">
          {searched.length === 0 && <div className="proyectos-empty"><FolderKanban size={28} /><p>Sin proyectos{filter !== 'all' ? ` de tipo ${typeLabels[filter as ProjectType]}` : ''}</p></div>}
          {searched.map(p => (
            <ProjectCard key={p.id} p={p} onDelete={() => removeProject(p.id)} onStatusChange={s => changeStatus(p.id, s)} />
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
