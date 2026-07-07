import { useRef, useEffect, useState } from 'react'
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered, Palette, Highlighter, Smile, Type, ChevronDown, Eraser, CaseSensitive, CaseUpper, CaseLower } from 'lucide-react'
import './RichTextEditor.css'

// ===== Editor de Textos unificado de la app =====
// Se usa en todas las ediciones ricas (descripciones, notas, anotaciones, diarios,
// objetivos, etc.). Es un contentEditable no controlado: siembra su HTML cuando
// cambia `docKey` (al cambiar de documento/entrada) y reporta cambios por `onChange`.

export const RTE_TEXT_COLORS = ['#1d1d1f', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b', '#ffffff']
export const RTE_HIGHLIGHTS = ['#fff59d', '#c5e1a5', '#80deea', '#90caf9', '#f48fb1', '#ffcc80', '#e0e0e0']
const RTE_EMOJIS = ['😀', '😅', '😍', '🥰', '😎', '🤔', '👍', '👏', '🙌', '🎉', '🔥', '✨', '⭐', '❤️', '💡', '✅', '❌', '⚠️', '📌', '📝', '📅', '⏰', '💪', '🚀', '🎯', '💰', '🛒', '🎨', '📦', '🌟', '🙏', '👀']

interface Props {
  html: string
  onChange: (html: string) => void
  docKey?: string | number   // cambia → se re-siembra el HTML (cambio de documento)
  placeholder?: string
  minHeight?: number
  className?: string
}

export default function RichTextEditor({ html, onChange, docKey, placeholder, minHeight, className }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<null | 'color' | 'highlight' | 'emoji' | 'heading' | 'case'>(null)

  // Sembrar innerHTML solo cuando cambia el documento (preserva el cursor al tipear).
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== html) ref.current.innerHTML = html
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey])

  const emit = () => onChange(ref.current?.innerHTML || '')
  const focus = () => ref.current?.focus()

  const exec = (cmd: string, val?: string) => {
    focus()
    try { document.execCommand('styleWithCSS', false, 'true') } catch {}
    document.execCommand(cmd, false, val)
    emit()
  }

  // Transformaciones de caso sobre la selección.
  const changeCase = (mode: 'sentence' | 'upper' | 'lower') => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) { setMenu(null); return }
    const text = sel.toString()
    let out = text
    if (mode === 'upper') out = text.toUpperCase()
    else if (mode === 'lower') out = text.toLowerCase()
    else out = text.toLowerCase().replace(/(^\s*\p{L})|([.!?¡¿]\s+\p{L})/gu, m => m.toUpperCase())
    focus()
    document.execCommand('insertText', false, out)
    emit(); setMenu(null)
  }

  const insertCollapsible = () => {
    focus()
    document.execCommand('insertHTML', false, '<details open><summary>Encabezado</summary><div>Contenido…</div></details><p><br></p>')
    emit(); setMenu(null)
  }

  const insertEmoji = (e: string) => { focus(); document.execCommand('insertText', false, e); emit(); setMenu(null) }

  // 4+ guiones seguidos en una línea → línea fina de separación (hr gris claro).
  const handleInput = () => {
    const sel = window.getSelection()
    const node = sel?.anchorNode
    if (node && node.nodeType === Node.TEXT_NODE && /^-{4,}$/.test((node.textContent || '').trim())) {
      const range = document.createRange()
      range.selectNode(node)
      sel!.removeAllRanges(); sel!.addRange(range)
      document.execCommand('insertHTML', false, '<hr class="rte-hr"><p><br></p>')
    }
    emit()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Duplicar línea/selección (Ctrl/Cmd + D).
    if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault()
      const sel = window.getSelection()
      if (sel && !sel.isCollapsed) { const t = sel.toString(); document.execCommand('insertText', false, t + t) }
      else {
        const line = (sel?.anchorNode?.textContent || '')
        if (line) document.execCommand('insertHTML', false, '<div>' + line.replace(/</g, '&lt;') + '</div>')
      }
      emit()
    }
  }

  // Clic sobre el triángulo de un encabezado desplegable → abre/cierra.
  const handleClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement
    if (t.tagName === 'SUMMARY' && (e.nativeEvent as MouseEvent).offsetX < 20) {
      const d = t.parentElement as HTMLDetailsElement
      d.open = !d.open
      e.preventDefault()
    }
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
              <button onMouseDown={e => e.preventDefault()} onClick={() => { exec('formatBlock', 'p'); setMenu(null) }}>Texto normal</button>
              <button onMouseDown={e => e.preventDefault()} onClick={() => { exec('formatBlock', 'h1'); setMenu(null) }} className="rte-h1">Encabezado 1</button>
              <button onMouseDown={e => e.preventDefault()} onClick={() => { exec('formatBlock', 'h2'); setMenu(null) }} className="rte-h2">Encabezado 2</button>
              <button onMouseDown={e => e.preventDefault()} onClick={() => { exec('formatBlock', 'h3'); setMenu(null) }} className="rte-h3">Encabezado 3</button>
              <button onMouseDown={e => e.preventDefault()} onClick={insertCollapsible} className="rte-collapse-opt">▸ Encabezado desplegable</button>
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
              {RTE_TEXT_COLORS.map(c => <button key={c} style={{ background: c }} onMouseDown={e => e.preventDefault()} onClick={() => { exec('foreColor', c); setMenu(null) }} title={c} />)}
            </div>
          )}
        </div>
        <div className="rte-menu-wrap">
          {btn('Resaltar', () => setMenu(menu === 'highlight' ? null : 'highlight'), <Highlighter size={14} />, menu === 'highlight')}
          {menu === 'highlight' && (
            <div className="rte-pop rte-pop-colors">
              {RTE_HIGHLIGHTS.map(c => <button key={c} style={{ background: c }} onMouseDown={e => e.preventDefault()} onClick={() => { exec('hiliteColor', c); setMenu(null) }} title={c} />)}
              <button className="rte-hl-none" onMouseDown={e => e.preventDefault()} onClick={() => { exec('hiliteColor', 'transparent'); setMenu(null) }} title="Quitar resaltado">✕</button>
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
              {RTE_EMOJIS.map(em => <button key={em} onMouseDown={e => e.preventDefault()} onClick={() => insertEmoji(em)}>{em}</button>)}
            </div>
          )}
        </div>
        {btn('Quitar formato', () => exec('removeFormat'), <Eraser size={14} />)}
      </div>
      <div
        ref={ref}
        className="rte-content"
        contentEditable
        suppressContentEditableWarning
        spellCheck
        lang="es-419"
        data-ph={placeholder || 'Escribí...'}
        style={minHeight ? { minHeight } : undefined}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onBlur={emit}
      />
    </div>
  )
}
