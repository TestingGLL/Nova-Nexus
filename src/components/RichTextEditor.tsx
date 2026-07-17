import { useRef, useEffect, useState } from 'react'
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered, ListChecks, Palette, Highlighter, Smile, Type, ChevronDown, Eraser, CaseSensitive, CaseUpper, CaseLower, GripVertical, Plus, X, Copy, Trash2 } from 'lucide-react'
import DuplicateIcon from './DuplicateIcon'
import { notify } from './Toast'
import './RichTextEditor.css'

// ===== Editor de Textos unificado de la app =====
// Se usa en todas las ediciones ricas (descripciones, notas, anotaciones, diarios,
// objetivos, etc.). Internamente es un editor por BLOQUES (cada bloque es un
// contentEditable independiente, reordenable), pero de cara afuera mantiene el
// contrato simple `html + onChange`: siembra su HTML cuando cambia `docKey` y
// reporta el HTML combinado por `onChange`.

export const RTE_TEXT_COLORS = ['#1d1d1f', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b', '#ffffff']
export const RTE_HIGHLIGHTS = ['#fff59d', '#c5e1a5', '#80deea', '#90caf9', '#f48fb1', '#ffcc80', '#e0e0e0']
const RTE_EMOJIS = ['😀', '😅', '😍', '🥰', '😎', '🤔', '👍', '👏', '🙌', '🎉', '🔥', '✨', '⭐', '❤️', '💡', '✅', '❌', '⚠️', '📌', '📝', '📅', '⏰', '💪', '🚀', '🎯', '💰', '🛒', '🎨', '📦', '🌟', '🙏', '👀']
// Colores muy suaves / de bajo contraste para las líneas divisorias (hr).
const HR_COLORS = ['#f1f3f5', '#e9ecef', '#eef1f4', '#f3f6f9', '#fdeaea', '#fdf0e3', '#fef6dd', '#eaf7ee', '#eaf1fd', '#f1edfb', '#fcecf4']

interface Block { id: string; html: string }
const BLOCK_LEVEL = /^\s*<(h[1-6]|ul|ol|blockquote|hr|details|div|p)/i
let blkSeq = 0
const newBlockId = () => 'rb-' + (blkSeq++) + '-' + Math.random().toString(36).slice(2, 5)

// HTML combinado → lista de bloques (cada elemento de nivel de bloque es un bloque).
function htmlToBlocks(html: string): Block[] {
  const div = document.createElement('div')
  div.innerHTML = html || ''
  const out: Block[] = []
  div.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent || ''
      if (t.trim()) out.push({ id: newBlockId(), html: t.replace(/</g, '&lt;') })
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      const tag = el.tagName.toLowerCase()
      // div/p genéricos: se desenvuelven (guardamos su contenido interno).
      out.push({ id: newBlockId(), html: (tag === 'div' || tag === 'p') ? el.innerHTML : el.outerHTML })
    }
  })
  if (out.length === 0) out.push({ id: newBlockId(), html: '' })
  return out
}

// Extrae el contenido interno de un bloque (desenvuelve h1-6/p/div, o toma el
// summary si es un encabezado desplegable) para poder reconvertirlo.
function unwrap(html: string): string {
  const d = document.createElement('div'); d.innerHTML = html || ''
  const c = d.childNodes.length === 1 ? d.firstChild : null
  if (c && c.nodeType === Node.ELEMENT_NODE) {
    const el = c as HTMLElement; const tag = el.tagName.toLowerCase()
    if (tag === 'details') { const s = el.querySelector('summary'); return s ? s.innerHTML : (el.textContent || '') }
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div'].includes(tag)) return el.innerHTML
  }
  return html
}

// Lista de bloques → HTML combinado (cada bloque queda como un elemento separado).
function blocksToHtml(blocks: Block[]): string {
  return blocks.map(b => {
    const h = b.html || ''
    if (!h.trim()) return '<div><br></div>'
    return BLOCK_LEVEL.test(h) ? h : `<div>${h}</div>`
  }).join('')
}

interface Props {
  html: string
  onChange: (html: string) => void
  docKey?: string | number   // cambia → se re-siembra el contenido (cambio de documento)
  placeholder?: string
  minHeight?: number
  className?: string
}

// Un bloque: contentEditable que siembra su innerHTML solo al montar (por id) para
// no perder el cursor; reporta cambios por onInput.
function BlockRow({ block, placeholder, selected, onInput, onEnter, onBackspaceEmpty, onDuplicate, onSelectAll, onToggleSelect, onClearSelect, onHrClick, onFocus, onDragStart, onDragEnd, onDragOver, onDrop, onRemove, onGripMenu, dragOver }: {
  block: Block; placeholder?: string; selected: boolean
  onInput: (html: string) => void
  onEnter: () => void
  onBackspaceEmpty: () => void
  onDuplicate: () => void
  onSelectAll: () => void
  onToggleSelect: () => void
  onClearSelect: () => void
  onHrClick: (el: HTMLElement, x: number, y: number) => void
  onFocus: () => void
  onDragStart: () => void; onDragEnd: () => void; onDragOver: () => void; onDrop: () => void
  onRemove: () => void
  onGripMenu: (e: React.MouseEvent) => void
  dragOver: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (ref.current && ref.current.innerHTML !== block.html) ref.current.innerHTML = block.html }, [block.id])

  // 4+ guiones en el bloque → línea fina de separación (hr).
  const handleInput = () => {
    const sel = window.getSelection()
    const node = sel?.anchorNode
    if (node && node.nodeType === Node.TEXT_NODE && /^-{4,}$/.test((node.textContent || '').trim())) {
      const range = document.createRange(); range.selectNode(node)
      sel!.removeAllRanges(); sel!.addRange(range)
      document.execCommand('insertHTML', false, '<hr class="rte-hr">')
    }
    onInput(ref.current?.innerHTML || '')
  }
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) { e.preventDefault(); onSelectAll(); return }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); onDuplicate(); return }
    if (e.key === 'Enter' && !e.shiftKey) {
      const sel = window.getSelection()
      let n: Node | null = sel?.anchorNode || null
      let li: HTMLElement | null = null
      while (n && n !== ref.current) { if (n.nodeName === 'LI') { li = n as HTMLElement; break } n = n.parentNode }
      // Fallback: Chromium a veces deja el caret a nivel del <ul> o del bloque (típico
      // de una casilla vacía o recién creada). Sin esto, Enter no encontraba el <li> y
      // creaba un párrafo en vez de otra casilla (bug reportado). Resolvemos el <li> igual.
      if (!li && ref.current) {
        const ul = ref.current.querySelector('.rte-checklist') as HTMLElement | null
        if (ul) {
          const a = sel?.anchorNode
          if (a === ul) {
            const kids = Array.from(ul.children) as HTMLElement[]
            li = kids[Math.max(0, (sel?.anchorOffset ?? kids.length) - 1)] || (ul.lastElementChild as HTMLElement | null)
          } else if (a === ref.current || (a && ul.contains(a))) {
            li = ul.lastElementChild as HTMLElement | null
          }
        }
      }
      // En una checklist, Enter crea explícitamente otra casilla (desmarcada) debajo.
      if (li && li.closest('.rte-checklist')) {
        e.preventDefault()
        if ((li.textContent || '').trim() === '') {
          // Casilla vacía + Enter → salir de la checklist y crear un bloque normal debajo.
          const ul = li.parentElement
          li.remove()
          if (ul && !ul.querySelector('li')) ul.remove()
          onInput(ref.current?.innerHTML || '')
          onEnter()
          return
        }
        const nli = document.createElement('li')
        nli.setAttribute('data-checked', 'false')
        nli.innerHTML = '<br>'
        li.after(nli)
        const range = document.createRange()
        range.setStart(nli, 0); range.collapse(true)
        sel?.removeAllRanges(); sel?.addRange(range)
        onInput(ref.current?.innerHTML || '')
        return
      }
      // Otras listas (ul/ol normales): Enter nativo sigue creando ítems.
      if (li) return
      e.preventDefault(); onEnter()
    } else if (e.key === 'Backspace' && (ref.current?.textContent || '') === '' && !/(<hr|<img|<details)/i.test(ref.current?.innerHTML || '')) {
      e.preventDefault(); onBackspaceEmpty()
    }
  }
  // Clic sobre una línea divisoria (hr) → menú de color/eliminar; sobre el triángulo
  // de un encabezado desplegable → abre/cierra.
  const handleClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement
    if (t.tagName === 'HR') { e.preventDefault(); onHrClick(t, e.clientX, e.clientY); return }
    // Clic sobre la casilla de un ítem de checklist (zona izquierda) → marcar/desmarcar.
    const li = t.closest('.rte-checklist li') as HTMLElement | null
    if (li && (e.nativeEvent as MouseEvent).offsetX < 24) {
      e.preventDefault()
      const checked = li.getAttribute('data-checked') === 'true'
      li.setAttribute('data-checked', checked ? 'false' : 'true')
      onInput(ref.current?.innerHTML || '')
      return
    }
    if (t.tagName === 'SUMMARY' && (e.nativeEvent as MouseEvent).offsetX < 20) {
      const d = t.parentElement as HTMLDetailsElement; d.open = !d.open; e.preventDefault()
    }
  }
  // Ctrl/Cmd + clic → (des)selecciona el bloque (sin colocar el cursor); clic normal
  // limpia la selección para editar con normalidad.
  const handleRowMouseDown = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); onToggleSelect() }
    else onClearSelect()
  }

  return (
    <div className={`rte-block-row ${dragOver ? 'drag-over' : ''} ${selected ? 'selected' : ''}`} onMouseDown={handleRowMouseDown} onDragOver={e => { e.preventDefault(); onDragOver() }} onDrop={onDrop}>
      <span className="rte-block-grip" draggable onMouseDown={e => e.stopPropagation()} onDragStart={onDragStart} onDragEnd={onDragEnd} onContextMenu={onGripMenu} title="Arrastrar para reordenar (mueve la selección) · clic derecho para convertir a encabezado"><GripVertical size={13} /></span>
      <div
        ref={ref}
        data-rte-block={block.id}
        className="rte-block"
        contentEditable
        suppressContentEditableWarning
        spellCheck
        lang="es-419"
        data-ph={placeholder}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onFocus={onFocus}
      />
      <button type="button" className="rte-block-del" onClick={onRemove} title="Eliminar bloque"><X size={12} /></button>
    </div>
  )
}

export default function RichTextEditor({ html, onChange, docKey, placeholder, minHeight, className }: Props) {
  const [blocks, setBlocks] = useState<Block[]>(() => htmlToBlocks(html))
  const [menu, setMenu] = useState<null | 'color' | 'highlight' | 'emoji' | 'heading' | 'case'>(null)
  const [ctxMenu, setCtxMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [hrMenu, setHrMenu] = useState<{ el: HTMLElement; x: number; y: number } | null>(null)
  const activeId = useRef<string | null>(null)
  const dragId = useRef<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Re-sembrar los bloques cuando cambia el documento (preserva el cursor al tipear).
  useEffect(() => {
    setBlocks(htmlToBlocks(html))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey])

  const commit = (next: Block[]) => { setBlocks(next); onChange(blocksToHtml(next)) }
  const blockEl = (id: string) => wrapRef.current?.querySelector(`[data-rte-block="${id}"]`) as HTMLElement | null

  const updateBlock = (id: string, html: string) => commit(blocks.map(b => b.id === id ? { ...b, html } : b))
  const addAfter = (id: string) => {
    const idx = blocks.findIndex(b => b.id === id)
    const nb: Block = { id: newBlockId(), html: '' }
    const next = [...blocks]; next.splice(idx + 1, 0, nb); commit(next)
    setTimeout(() => blockEl(nb.id)?.focus(), 0)
  }
  const removeBlock = (id: string) => {
    if (blocks.length <= 1) { commit([{ id: newBlockId(), html: '' }]); return }
    const idx = blocks.findIndex(b => b.id === id)
    const next = blocks.filter(b => b.id !== id); commit(next)
    const prev = blocks[idx - 1] || next[0]
    if (prev) setTimeout(() => { const el = blockEl(prev.id); el?.focus() }, 0)
  }
  // Convierte un bloque a encabezado (h1/h2/h3), encabezado desplegable (d1/d2/d3)
  // o texto normal (p), preservando el contenido interno.
  const convertBlock = (id: string, kind: 'h1' | 'h2' | 'h3' | 'p' | 'd1' | 'd2' | 'd3' | 'check') => {
    const el = blockEl(id)
    const cur = el ? el.innerHTML : (blocks.find(b => b.id === id)?.html || '')
    const inner = unwrap(cur)
    let html: string
    if (kind === 'p') html = inner || '<br>'
    else if (kind === 'check') html = `<ul class="rte-checklist"><li data-checked="false">${inner || '<br>'}</li></ul>`
    else if (kind[0] === 'h') html = `<${kind}>${inner || '<br>'}</${kind}>`
    else html = `<details class="rte-det-${kind[1]}" open><summary>${inner || 'Encabezado'}</summary><div><br></div></details>`
    if (el) el.innerHTML = html
    updateBlock(id, html)
    setCtxMenu(null)
  }
  // Convierte el bloque activo (o el último) en una checklist. Sirve tanto para
  // agregar una casilla nueva como para convertir un texto existente en verificable.
  const insertChecklist = () => {
    const id = activeId.current || blocks[blocks.length - 1]?.id
    if (id) convertBlock(id, 'check')
  }
  const duplicateBlock = (id: string) => {
    const idx = blocks.findIndex(b => b.id === id); if (idx < 0) return
    const nb: Block = { id: newBlockId(), html: blocks[idx].html }
    const next = [...blocks]; next.splice(idx + 1, 0, nb); commit(next)
  }
  // Reordenar: mueve el bloque arrastrado o TODA la selección (si el arrastrado
  // pertenece a ella) hasta la posición del bloque de destino.
  const reorder = (toId: string) => {
    const from = dragId.current
    setDragOverId(null); dragId.current = null
    if (!from) return
    const ids = (selected.has(from) && selected.size > 0) ? blocks.filter(b => selected.has(b.id)).map(b => b.id) : [from]
    if (ids.includes(toId)) return
    const moving = blocks.filter(b => ids.includes(b.id))
    const rest = blocks.filter(b => !ids.includes(b.id))
    const toIdx = rest.findIndex(b => b.id === toId)
    if (toIdx < 0) return
    commit([...rest.slice(0, toIdx), ...moving, ...rest.slice(toIdx)])
  }

  // ---- Selección múltiple de bloques ----
  const toggleSelect = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const clearSelect = () => setSelected(s => (s.size ? new Set() : s))
  const selectAll = () => setSelected(new Set(blocks.map(b => b.id)))
  const duplicateSelected = () => {
    const sel = blocks.filter(b => selected.has(b.id)); if (!sel.length) return
    const lastIdx = Math.max(...sel.map(b => blocks.findIndex(x => x.id === b.id)))
    const copies = sel.map(b => ({ id: newBlockId(), html: b.html }))
    const next = [...blocks]; next.splice(lastIdx + 1, 0, ...copies); commit(next)
    setSelected(new Set(copies.map(c => c.id)))
  }
  const deleteSelected = () => {
    const next = blocks.filter(b => !selected.has(b.id))
    commit(next.length ? next : [{ id: newBlockId(), html: '' }]); setSelected(new Set())
  }
  const copySelected = async () => {
    const sel = blocks.filter(b => selected.has(b.id)); if (!sel.length) return
    const htmlStr = blocksToHtml(sel)
    const tmp = document.createElement('div'); tmp.innerHTML = htmlStr
    const plain = tmp.innerText
    try {
      const CI = (window as any).ClipboardItem
      if (navigator.clipboard && CI) await navigator.clipboard.write([new CI({ 'text/html': new Blob([htmlStr], { type: 'text/html' }), 'text/plain': new Blob([plain], { type: 'text/plain' }) })])
      else await navigator.clipboard.writeText(plain)
      notify()?.success('Copiado')
    } catch { try { await navigator.clipboard.writeText(plain); notify()?.success('Copiado') } catch {} }
  }

  // ---- Líneas divisorias (hr): color / eliminar ----
  const persistHr = (el: HTMLElement) => { const bid = el.closest('[data-rte-block]')?.getAttribute('data-rte-block'); const bel = bid ? blockEl(bid) : null; if (bid && bel) updateBlock(bid, bel.innerHTML) }
  const setHrColor = (c: string) => { if (!hrMenu) return; const el = hrMenu.el; el.style.setProperty('border-color', c); el.style.setProperty('background-color', c); el.style.setProperty('color', c); persistHr(el) }
  const deleteHr = () => { if (!hrMenu) return; const el = hrMenu.el; const bid = el.closest('[data-rte-block]')?.getAttribute('data-rte-block'); el.remove(); const bel = bid ? blockEl(bid) : null; if (bid && bel) updateBlock(bid, bel.innerHTML); setHrMenu(null) }

  // Atajos en modo selección de bloques (Ctrl+A/C/D, Delete, Escape), a nivel documento.
  useEffect(() => {
    if (selected.size === 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelected(new Set()); return }
      // No interferir si el foco está en un campo editable (input/textarea/otro bloque).
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      const cmd = e.ctrlKey || e.metaKey
      if (cmd && (e.key === 'a' || e.key === 'A')) { e.preventDefault(); setSelected(new Set(blocks.map(b => b.id))) }
      else if (cmd && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); copySelected() }
      else if (cmd && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); duplicateSelected() }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, blocks])

  // Comandos de la toolbar: se aplican al bloque enfocado y luego leemos su HTML.
  const exec = (cmd: string, val?: string) => {
    const id = activeId.current || blocks[blocks.length - 1]?.id
    const el = id ? blockEl(id) : null
    if (!el) return
    el.focus()
    try { document.execCommand('styleWithCSS', false, 'true') } catch {}
    document.execCommand(cmd, false, val)
    if (id) updateBlock(id, el.innerHTML)
    setMenu(null)
  }
  const insertHTML = (h: string) => {
    const id = activeId.current || blocks[blocks.length - 1]?.id
    const el = id ? blockEl(id) : null
    if (!el) return
    el.focus(); document.execCommand('insertHTML', false, h)
    if (id) updateBlock(id, el.innerHTML)
    setMenu(null)
  }
  const changeCase = (mode: 'sentence' | 'upper' | 'lower') => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) { setMenu(null); return }
    const text = sel.toString()
    let out = text
    if (mode === 'upper') out = text.toUpperCase()
    else if (mode === 'lower') out = text.toLowerCase()
    else out = text.toLowerCase().replace(/(^\s*\p{L})|([.!?¡¿]\s+\p{L})/gu, m => m.toUpperCase())
    const id = activeId.current
    const el = id ? blockEl(id) : null
    if (el) { el.focus(); document.execCommand('insertText', false, out); updateBlock(id!, el.innerHTML) }
    setMenu(null)
  }

  const btn = (title: string, onClick: () => void, children: React.ReactNode, active = false) => (
    <button type="button" className={`rte-btn ${active ? 'active' : ''}`} title={title} onMouseDown={e => e.preventDefault()} onClick={onClick}>{children}</button>
  )

  return (
    <div className={`rte ${className || ''}`} onMouseDown={() => menu && setMenu(null)}>
      <div className="rte-toolbar" onMouseDown={e => e.stopPropagation()}>
        <div className="rte-menu-wrap">
          {btn('Encabezados', () => setMenu(menu === 'heading' ? null : 'heading'), <><Type size={14} /><ChevronDown size={11} /></>, menu === 'heading')}
          {menu === 'heading' && (
            <div className="rte-pop rte-pop-list">
              <button onMouseDown={e => e.preventDefault()} onClick={() => exec('formatBlock', 'p')}>Texto normal</button>
              <button onMouseDown={e => e.preventDefault()} onClick={() => exec('formatBlock', 'h1')} className="rte-h1">Encabezado 1</button>
              <button onMouseDown={e => e.preventDefault()} onClick={() => exec('formatBlock', 'h2')} className="rte-h2">Encabezado 2</button>
              <button onMouseDown={e => e.preventDefault()} onClick={() => exec('formatBlock', 'h3')} className="rte-h3">Encabezado 3</button>
              <button onMouseDown={e => e.preventDefault()} onClick={() => insertHTML('<details open><summary>Encabezado</summary><div>Contenido…</div></details>')} className="rte-collapse-opt">▸ Encabezado desplegable</button>
            </div>
          )}
        </div>
        <span className="rte-sep" />
        {btn('Negrita (Ctrl+B)', () => exec('bold'), <Bold size={14} />)}
        {btn('Cursiva (Ctrl+I)', () => exec('italic'), <Italic size={14} />)}
        {btn('Subrayado (Ctrl+U)', () => exec('underline'), <Underline size={14} />)}
        {btn('Tachado', () => exec('strikeThrough'), <Strikethrough size={14} />)}
        <span className="rte-sep" />
        {btn('Lista con viñetas', () => exec('insertUnorderedList'), <List size={14} />)}
        {btn('Lista numerada', () => exec('insertOrderedList'), <ListOrdered size={14} />)}
        {btn('Checklist (casilla verificable)', insertChecklist, <ListChecks size={14} />)}
        <span className="rte-sep" />
        <div className="rte-menu-wrap">
          {btn('Color de texto', () => setMenu(menu === 'color' ? null : 'color'), <Palette size={14} />, menu === 'color')}
          {menu === 'color' && (
            <div className="rte-pop rte-pop-colors">
              {RTE_TEXT_COLORS.map(c => <button key={c} style={{ background: c }} onMouseDown={e => e.preventDefault()} onClick={() => exec('foreColor', c)} title={c} />)}
            </div>
          )}
        </div>
        <div className="rte-menu-wrap">
          {btn('Resaltar', () => setMenu(menu === 'highlight' ? null : 'highlight'), <Highlighter size={14} />, menu === 'highlight')}
          {menu === 'highlight' && (
            <div className="rte-pop rte-pop-colors">
              {RTE_HIGHLIGHTS.map(c => <button key={c} style={{ background: c }} onMouseDown={e => e.preventDefault()} onClick={() => exec('hiliteColor', c)} title={c} />)}
              <button className="rte-hl-none" onMouseDown={e => e.preventDefault()} onClick={() => exec('hiliteColor', 'transparent')} title="Quitar resaltado">✕</button>
            </div>
          )}
        </div>
        <span className="rte-sep" />
        <div className="rte-menu-wrap">
          {btn('Mayúsculas / minúsculas', () => setMenu(menu === 'case' ? null : 'case'), <><CaseSensitive size={15} /><ChevronDown size={11} /></>, menu === 'case')}
          {menu === 'case' && (
            <div className="rte-pop rte-pop-list">
              <button onMouseDown={e => e.preventDefault()} onClick={() => changeCase('sentence')}><CaseSensitive size={13} /> Tipo oración</button>
              <button onMouseDown={e => e.preventDefault()} onClick={() => changeCase('upper')}><CaseUpper size={13} /> TODO MAYÚS</button>
              <button onMouseDown={e => e.preventDefault()} onClick={() => changeCase('lower')}><CaseLower size={13} /> todo minús</button>
            </div>
          )}
        </div>
        <div className="rte-menu-wrap">
          {btn('Emoji', () => setMenu(menu === 'emoji' ? null : 'emoji'), <Smile size={14} />, menu === 'emoji')}
          {menu === 'emoji' && (
            <div className="rte-pop rte-pop-emoji">
              {RTE_EMOJIS.map(em => <button key={em} onMouseDown={e => e.preventDefault()} onClick={() => insertHTML(em)}>{em}</button>)}
            </div>
          )}
        </div>
        {btn('Quitar formato', () => exec('removeFormat'), <Eraser size={14} />)}
      </div>

      {selected.size > 0 && (
        <div className="rte-selbar" onMouseDown={e => e.stopPropagation()}>
          <span className="rte-selbar-count">{selected.size} bloque{selected.size > 1 ? 's' : ''} seleccionado{selected.size > 1 ? 's' : ''}</span>
          <button onClick={duplicateSelected} title="Duplicar (Ctrl+D)"><DuplicateIcon size={13} /> Duplicar</button>
          <button onClick={copySelected} title="Copiar (Ctrl+C)"><Copy size={13} /> Copiar</button>
          <button className="rte-selbar-del" onClick={deleteSelected} title="Eliminar (Supr)"><Trash2 size={13} /> Eliminar</button>
          <span className="rte-selbar-hint">Arrastrá para mover · Ctrl+clic para (des)seleccionar</span>
          <button className="rte-selbar-close" onClick={() => setSelected(new Set())} title="Cancelar selección"><X size={13} /></button>
        </div>
      )}

      <div className="rte-blocks" ref={wrapRef} style={minHeight ? { minHeight } : undefined}>
        {blocks.map((b, i) => (
          <BlockRow
            key={b.id}
            block={b}
            placeholder={i === 0 ? (placeholder || 'Escribí...') : undefined}
            dragOver={dragOverId === b.id}
            selected={selected.has(b.id)}
            onInput={h => updateBlock(b.id, h)}
            onEnter={() => addAfter(b.id)}
            onBackspaceEmpty={() => removeBlock(b.id)}
            onDuplicate={() => duplicateBlock(b.id)}
            onSelectAll={selectAll}
            onToggleSelect={() => toggleSelect(b.id)}
            onClearSelect={clearSelect}
            onHrClick={(el, x, y) => setHrMenu({ el, x: Math.min(x, window.innerWidth - 210), y: Math.min(y, window.innerHeight - 180) })}
            onFocus={() => { activeId.current = b.id }}
            onRemove={() => removeBlock(b.id)}
            onGripMenu={e => {
              e.preventDefault(); setMenu(null); setCtxMenu(null); setHrMenu(null)
              // Si el bloque es una línea divisoria, el clic derecho en el grip abre el menú de color.
              const hr = blockEl(b.id)?.querySelector('hr') as HTMLElement | null
              if (hr) { setHrMenu({ el: hr, x: Math.min(e.clientX, window.innerWidth - 210), y: Math.min(e.clientY, window.innerHeight - 180) }); return }
              setCtxMenu({ id: b.id, x: Math.min(e.clientX, window.innerWidth - 240), y: Math.min(e.clientY, window.innerHeight - 300) })
            }}
            onDragStart={() => { dragId.current = b.id }}
            onDragEnd={() => { dragId.current = null; setDragOverId(null) }}
            onDragOver={() => setDragOverId(b.id)}
            onDrop={() => reorder(b.id)}
          />
        ))}
        <button type="button" className="rte-add-block" onClick={() => addAfter(blocks[blocks.length - 1]?.id || '')}><Plus size={12} /> Agregar bloque</button>
      </div>

      {ctxMenu && (
        <>
          <div className="rte-ctx-backdrop" onClick={() => setCtxMenu(null)} onContextMenu={e => { e.preventDefault(); setCtxMenu(null) }} />
          <div className="rte-ctx-menu" style={{ top: ctxMenu.y, left: ctxMenu.x }}>
            <span className="rte-ctx-title">Convertir bloque</span>
            <button onClick={() => convertBlock(ctxMenu.id, 'h1')} className="rte-h1">Encabezado 1</button>
            <button onClick={() => convertBlock(ctxMenu.id, 'h2')} className="rte-h2">Encabezado 2</button>
            <button onClick={() => convertBlock(ctxMenu.id, 'h3')} className="rte-h3">Encabezado 3</button>
            <div className="rte-ctx-sep" />
            <button onClick={() => convertBlock(ctxMenu.id, 'd1')} className="rte-h1">▸ Encabezado desplegable 1</button>
            <button onClick={() => convertBlock(ctxMenu.id, 'd2')} className="rte-h2">▸ Encabezado desplegable 2</button>
            <button onClick={() => convertBlock(ctxMenu.id, 'd3')} className="rte-h3">▸ Encabezado desplegable 3</button>
            <div className="rte-ctx-sep" />
            <button onClick={() => convertBlock(ctxMenu.id, 'check')}><ListChecks size={13} /> Casilla verificable</button>
            <button onClick={() => convertBlock(ctxMenu.id, 'p')}>Texto normal</button>
          </div>
        </>
      )}

      {hrMenu && (
        <>
          <div className="rte-ctx-backdrop" onMouseDown={() => setHrMenu(null)} onContextMenu={e => { e.preventDefault(); setHrMenu(null) }} />
          <div className="rte-hr-menu" style={{ top: hrMenu.y, left: hrMenu.x }} onMouseDown={e => e.stopPropagation()}>
            <span className="rte-ctx-title">Línea divisoria</span>
            <div className="rte-hr-colors">
              {HR_COLORS.map(c => <button key={c} style={{ background: c }} title={c} onClick={() => setHrColor(c)} />)}
            </div>
            <button className="rte-hr-del" onClick={deleteHr}><Trash2 size={12} /> Eliminar línea</button>
          </div>
        </>
      )}
    </div>
  )
}
