import { useState } from 'react'
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
      {wide ? label.name : ''}
    </span>
  )
}

export function DueBadge({ card }: { card: Card }) {
  if (!card.dueDate) return null
  const cls = card.completed ? 'due done' : isOverdue(card) ? 'due overdue' : 'due'
  return <span className={cls}>🕒 {formatDate(card.dueDate)}</span>
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
        + {label}
      </button>
    )
  const submit = () => {
    if (text.trim()) onAdd(text.trim())
    setText('')
  }
  return (
    <div className="add-form">
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
        <button className="primary" onClick={submit}>
          {label}
        </button>
        <button className="ghost" onClick={() => setOpen(false)}>
          ✕
        </button>
      </div>
    </div>
  )
}
