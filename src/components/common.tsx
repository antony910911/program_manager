import { useState } from 'react'
import { Clock, Plus, X } from 'lucide-react'
import type { Card, Label, Member } from '../types'
import { formatDate, isOverdue } from '../store'

export function Avatar({ member, size = 26 }: { member: Member; size?: number }) {
  return (
    <span className="avatar" title={member.name} style={{ background: member.color, width: size, height: size, fontSize: size * 0.45 }}>
      {member.name.slice(0, 1).toUpperCase()}
    </span>
  )
}

export function LabelChip({ label, wide }: { label: Label; wide?: boolean }) {
  return (
    <span className={wide ? 'label-chip wide' : 'label-chip'} style={{ background: label.color }} title={label.name}>
      {label.name}
    </span>
  )
}

export function DueBadge({ card }: { card: Card }) {
  if (!card.dueDate) return null
  const cls = card.completed ? 'due done' : isOverdue(card) ? 'due overdue' : 'due'
  return (
    <span className={'badge ' + cls}>
      <Clock size={13} /> {formatDate(card.dueDate)}
      {card.time && <span className="due-time">{card.time}</span>}
    </span>
  )
}

/** Text that turns into an input on click; commits on blur/Enter. */
export function InlineEdit({ value, onSave, className }: { value: string; onSave: (v: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  if (!editing)
    return (
      <span
        className={className}
        onClick={() => {
          setDraft(value)
          setEditing(true)
        }}
      >
        {value}
      </span>
    )
  const commit = () => {
    setEditing(false)
    const v = draft.trim()
    if (v && v !== value) onSave(v)
  }
  return (
    <input
      className={'inline-input ' + (className ?? '')}
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') setEditing(false)
      }}
    />
  )
}

/** "+ Add ..." button that expands into a small form. */
export function AddForm({ label, placeholder, onAdd }: { label: string; placeholder: string; onAdd: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  if (!open)
    return (
      <button className="add-btn" onClick={() => setOpen(true)}>
        <Plus size={15} /> {label}
      </button>
    )
  // Adding closes the form; so does leaving it empty (tapping elsewhere).
  const submit = () => {
    if (text.trim()) onAdd(text.trim())
    setText('')
    setOpen(false)
  }
  return (
    <div
      className="add-form"
      onBlur={(e) => {
        if (!text.trim() && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <textarea
        autoFocus
        rows={2}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
          if (e.key === 'Escape') setOpen(false)
        }}
      />
      <div className="row">
        <button className="btn primary" onClick={submit}>
          {label}
        </button>
        <button className="icon-btn" onClick={() => setOpen(false)}>
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

/** Pixel mothership (same drawing as scripts/make_icons.py): G dome, W glint, S hull, T underside, Y lights, H hatch. */
const SHIP = [
  '......GGGGG......',
  '.....GWGGGGG.....',
  '....GGGGGGGGG....',
  '..TSSSSSSSSSSST..',
  '.SSYSSSSYSSSSYSS.',
  'SSSSSSSSSSSSSSSSS',
  '.TTTTTTTTTTTTTTT.',
  '.....THHHHHT.....',
]
const SHIP_COLORS: Record<string, string> = {
  G: '#96dcff',
  W: '#ffffff',
  S: '#d6dae6',
  T: '#8c92a8',
  Y: '#ffd60a',
  H: '#ffeca0',
}

/** The Mothership mark: the pixel ship beaming up three task cards. */
export function BrandMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-0.5 -1 18 18" shapeRendering="crispEdges" aria-hidden="true">
      <path d="M5 8h7l3 8H2z" fill="#ffeca0" opacity=".35" />
      {SHIP.flatMap((row, r) =>
        [...row].map((ch, c) => (ch === '.' ? null : <rect key={`${r}-${c}`} x={c} y={r} width={1.02} height={1.02} fill={SHIP_COLORS[ch]} />)),
      )}
      <rect x="4" y="13" width="3" height="2" fill="#fbbf24" />
      <rect x="7.5" y="9.5" width="3" height="2" fill="#60a5fa" />
      <rect x="10.5" y="11.5" width="3" height="2" fill="#f87171" />
    </svg>
  )
}
