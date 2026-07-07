import { useRef, useEffect, useState } from 'react'
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered, Palette, Highlighter, Smile, Type, ChevronDown, Eraser, CaseSensitive, CaseUpper, CaseLower, GripVertical, Plus, X } from 'lucide-react'
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
function BlockRow({ block, placeholder, onInput, onEnter, onBackspaceEmpty, onDuplicate, onFocus, onDragStart, onDragEnd, onDragOver, onDrop, onRemove, dragOver }: {
  block: Block; placeholder?: string
  onInput: (html: string) => void
  onEnter: () => void
  onBackspaceEmpty: () => void
  onDuplicate: () => void
  onFocus: () => void
  onDragStart: () => void; onDragEnd: () => void; onDragOver: () => void; onDrop: () => void
  onRemove: () => void
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
    if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); onDuplicate(); return }
    if (e.key === 'Enter' && !e.shiftKey) {
      // Dentro de una lista, Enter sigue creando ítems (comportamiento nativo).
      const sel = window.getSelection()
      let n: Node | null = sel?.anchorNode || null
      while (n && n !== ref.current) { if (n.nodeName === 'LI') return; n = n.parentNode }
      e.preventDefault(); onEnter()
    } else if (e.key === 'Backspace' && (ref.current?.textContent || '') === '' && !/(<hr|<img|<details)/i.test(ref.current?.innerHTML || '')) {
      e.preventDefault(); onBackspaceEmpty()
    }
  }
  // Clic sobre el triángulo de un encabezado desplegable → abre/cierra.
  const handleClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement
    if (t.tagName === 'SUMMARY' && (e.nativeEvent as MouseEvent).offsetX < 20) {
      const d = t.parentElement as HTMLDetailsElement; d.open = !d.open; e.preventDefault()
    }
  }

  return (
    <div className={`rte-block-row ${dragOver ? 'drag-over' : ''}`} onDragOver={e => { e.preventDefault(); onDragOver() }} onDrop={onDrop}>
      <span className="rte-block-grip" draggable onDragStart={onDragStart} onDragEnd={onDragEnd} title="Arrastrar para reordenar"><GripVertical size={13} /></span>
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
  const [dragOverId, setDragOverId] = useState<string | null>(null)
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
  const duplicateBlock = (id: string) => {
    const idx = blocks.findIndex(b => b.id === id); if (idx < 0) return
    const nb: Block = { id: newBlockId(), html: blocks[idx].html }
    const next = [...blocks]; next.splice(idx + 1, 0, nb); commit(next)
  }
  const reorder = (toId: string) => {
    const from = dragId.current
    setDragOverId(null); dragId.current = null
    if (!from || from === toId) return
    const fromIdx = blocks.findIndex(b => b.id === from)
    const toIdx = blocks.findIndex(b => b.id === toId)
    if (fromIdx < 0 || toIdx < 0) return
    const next = [...blocks]; const [m] = next.splice(fromIdx, 1); next.splice(toIdx, 0, m); commit(next)
  }

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

      <div className="rte-blocks" ref={wrapRef} style={minHeight ? { minHeight } : undefined}>
        {blocks.map((b, i) => (
          <BlockRow
            key={b.id}
            block={b}
            placeholder={i === 0 ? (placeholder || 'Escribí...') : undefined}
            dragOver={dragOverId === b.id}
            onInput={h => updateBlock(b.id, h)}
            onEnter={() => addAfter(b.id)}
            onBackspaceEmpty={() => removeBlock(b.id)}
            onDuplicate={() => duplicateBlock(b.id)}
            onFocus={() => { activeId.current = b.id }}
            onRemove={() => removeBlock(b.id)}
            onDragStart={() => { dragId.current = b.id }}
            onDragEnd={() => { dragId.current = null; setDragOverId(null) }}
            onDragOver={() => setDragOverId(b.id)}
            onDrop={() => reorder(b.id)}
          />
        ))}
        <button type="button" className="rte-add-block" onClick={() => addAfter(blocks[blocks.length - 1]?.id || '')}><Plus size={12} /> Agregar bloque</button>
      </div>
    </div>
  )
}
