import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { createPortal } from 'react-dom'
import { AlignLeft, Check, ChevronDown, ChevronRight, Ellipsis, MessageSquare, Sparkles, SquareCheck, Trash2, X } from 'lucide-react'
import type { AppState, Card, Filter, ID, List } from '../types'
import type { Action } from '../store'
import { cardBoard } from '../store'
import { doneCards, dropCard, visibleCards } from '../dnd'
import type { Dnd } from '../dnd'
import { LIST_COLORS, softPreview } from '../theme'
import { AddForm, Avatar, DueBadge, InlineEdit, LabelChip } from './common'
import { ColorPicker, ConfirmButton } from './controls'

interface Props {
  state: AppState
  list: List
  boardId: ID
  filter: Filter
  dnd: Dnd
  dispatch: (a: Action) => void
  openCard: (id: ID) => void
  /** Called when a dragged list is dropped onto this list. */
  onDropList?: (listId: ID) => void
  /** Show which project each card belongs to (used in the focus lists). */
  showProject?: boolean
  className?: string
}

export function ListColumn({ state, list, boardId, filter, dnd, dispatch, openCard, onDropList, showProject, className }: Props) {
  const { drag, setDrag, dropTarget, setDropTarget, endDrag, landed } = dnd
  const cards = visibleCards(state, list.id, filter)
  const done = doneCards(state, list.id, filter)
  const [showDone, setShowDone] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuBtn = useRef<HTMLButtonElement>(null)
  const isTarget = drag?.kind === 'card' && dropTarget?.listId === list.id
  const cls = [
    'list',
    className,
    list.color && 'colored',
    drag?.kind === 'list' && drag.id === list.id && 'dragging',
    isTarget && 'drop-active',
    drag?.kind === 'list' && drag.id !== list.id && dropTarget?.listId === list.id && 'list-drop',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={cls}
      style={list.color ? ({ '--list-color': list.color } as React.CSSProperties) : undefined}
      // The whole list can be dragged by any spot that isn't a card (cards drag themselves) or a text box.
      draggable
      onPointerDownCapture={(e) => {
        if (!(e.target as HTMLElement).closest(TEXT_FIELDS)) return
        const el = e.currentTarget
        el.draggable = false
        const restore = () => {
          el.draggable = true
          window.removeEventListener('pointerup', restore, true)
          window.removeEventListener('pointercancel', restore, true)
        }
        window.addEventListener('pointerup', restore, true)
        window.addEventListener('pointercancel', restore, true)
      }}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', list.title)
        // After the browser has taken its picture of the list, so styling it can't cancel the drag.
        setTimeout(() => setDrag({ kind: 'list', id: list.id }))
      }}
      onDragEnd={endDrag}
      onDragOver={(e) => {
        if (!drag) return
        if (drag.kind === 'list' && !onDropList) return
        e.preventDefault()
        if (drag.kind === 'list') setDropTarget({ listId: list.id, index: -1 })
        else if (cards.length === 0 || dropTarget?.listId !== list.id) setDropTarget({ listId: list.id, index: cards.length })
      }}
      onDrop={(e) => {
        e.preventDefault()
        if (drag?.kind === 'list' && onDropList && drag.id !== list.id) onDropList(drag.id)
        dropCard(state, filter, dnd, dispatch)
        endDrag()
      }}
    >
      <div className="list-header">
        <InlineEdit
          className="list-title"
          value={list.title}
          onSave={(title) => dispatch({ type: 'renameList', listId: list.id, title })}
        />
        <span className="list-count">{cards.length}</span>
        <div>
          <button ref={menuBtn} className="icon-btn" title="清單選單" onClick={() => setMenuOpen((o) => !o)}>
            <Ellipsis size={16} />
          </button>
          {menuOpen && (
            <ListMenu
              anchor={menuBtn}
              list={list}
              colorStrength={state.theme.colorStrength}
              onClose={() => setMenuOpen(false)}
              onColor={(color) => dispatch({ type: 'setListColor', listId: list.id, color })}
              onDelete={() => dispatch({ type: 'deleteList', boardId, listId: list.id })}
            />
          )}
        </div>
      </div>
      <div className="list-cards">
        {cards.map((card, i) => (
          <div key={card.id}>
            {isTarget && dropTarget.index === i && <Placeholder drag={drag} />}
            <CardTile
              state={state}
              card={card}
              showProject={showProject}
              dragging={drag?.kind === 'card' && drag.id === card.id}
              landed={landed === card.id}
              onClick={() => openCard(card.id)}
              onComplete={() => dispatch({ type: 'updateCard', cardId: card.id, patch: { completed: true } })}
              onDragStart={(height) => {
                setDrag({ kind: 'card', id: card.id, height })
                // The card folds away and its placeholder takes its place, so nothing jumps.
                setDropTarget({ listId: list.id, index: i })
              }}
              onDragEnd={endDrag}
              onDragOver={(e) => {
                if (drag?.kind !== 'card') return
                e.preventDefault()
                e.stopPropagation()
                const rect = e.currentTarget.getBoundingClientRect()
                const after = e.clientY > rect.top + rect.height / 2
                setDropTarget({ listId: list.id, index: after ? i + 1 : i })
              }}
            />
          </div>
        ))}
        {isTarget && cards.length > 0 && dropTarget.index >= cards.length && <Placeholder drag={drag} />}
        {/* Stays put while a card hovers, so the list doesn't shrink out from under the pointer. */}
        {!cards.length && <div className={'list-empty' + (isTarget ? ' active' : '')}>{isTarget ? '放開即可加入' : '拖曳卡片到這裡'}</div>}
      </div>
      <AddForm label="新增卡片" placeholder="輸入卡片標題…" onAdd={(title) => dispatch({ type: 'addCard', listId: list.id, title })} />
      {done.length > 0 && (
        <div className="list-done">
          <button className="list-done-toggle" onClick={() => setShowDone((v) => !v)}>
            {showDone ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Check size={13} /> 已完成 {done.length} 張
          </button>
          {showDone && (
            <div className="list-done-cards">
              {done.map((card) => (
                <CardTile
                  key={card.id}
                  state={state}
                  card={card}
                  showProject={showProject}
                  dragging={drag?.kind === 'card' && drag.id === card.id}
                  onClick={() => openCard(card.id)}
                  onComplete={() => dispatch({ type: 'updateCard', cardId: card.id, patch: { completed: false } })}
                  onDragStart={(height) => setDrag({ kind: 'card', id: card.id, height })}
                  onDragEnd={endDrag}
                  onDragOver={() => {}}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Pressing in these starts text selection, not a list drag. */
const TEXT_FIELDS = 'input, textarea, select, [contenteditable="true"]'

/** Where a dragged card will land; as tall as the card itself. */
function Placeholder({ drag }: { drag: Dnd['drag'] }) {
  const height = drag?.kind === 'card' && drag.height ? drag.height : 40
  return <div className="drop-placeholder" style={{ height }} />
}

const MENU_W = 260

/** Rendered in a portal with fixed coordinates so scroll containers and blurred lists can't clip or cover it. */
function ListMenu({
  anchor,
  list,
  colorStrength,
  onClose,
  onColor,
  onDelete,
}: {
  anchor: RefObject<HTMLButtonElement | null>
  list: List
  colorStrength: number
  onClose: () => void
  onColor: (c: string | null) => void
  onDelete: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  useLayoutEffect(() => {
    const place = () => {
      const r = anchor.current?.getBoundingClientRect()
      if (!r) return
      const height = ref.current?.offsetHeight ?? 300
      const top = r.bottom + 6 + height > window.innerHeight ? Math.max(8, r.top - 6 - height) : r.bottom + 6
      setPos({ top, left: Math.min(Math.max(8, r.right - MENU_W), window.innerWidth - MENU_W - 8) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchor])
  useEffect(() => {
    const close = (e: MouseEvent) => {
      const t = e.target as Node
      if (!ref.current?.contains(t) && !anchor.current?.contains(t)) onClose()
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [onClose, anchor])
  return createPortal(
    <div className="popover list-menu" ref={ref} style={{ position: 'fixed', top: pos.top, left: pos.left, width: MENU_W }}>
      <div className="popover-head">
        <strong>{list.title}</strong>
        <button className="icon-btn" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="field-label">清單顏色</div>
      <ColorPicker
        value={list.color ?? '#94a3b8'}
        swatches={LIST_COLORS}
        preview={(c) => softPreview(c, 'list', colorStrength)}
        onChange={onColor}
      />
      <button className="btn wide small" onClick={() => onColor(null)} disabled={!list.color}>
        移除顏色
      </button>
      <div className="menu-sep" />
      <ConfirmButton className="btn danger wide" confirmText={`再按一次刪除（${list.cardIds.length} 張卡片會放進垃圾桶）`} onConfirm={onDelete}>
        <Trash2 size={14} /> 刪除清單
      </ConfirmButton>
    </div>,
    document.body,
  )
}

interface TileProps {
  state: AppState
  card: Card
  dragging: boolean
  /** Just dropped here: plays a short settle animation. */
  landed?: boolean
  showProject?: boolean
  onClick: () => void
  /** Round check button: marks an open card done, or a done card open again. */
  onComplete?: () => void
  /** Receives the card's height, for its placeholder. */
  onDragStart: (height: number) => void
  onDragEnd: () => void
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void
}

export function CardTile({ state, card, dragging, landed, showProject, onClick, onComplete, onDragStart, onDragEnd, onDragOver }: TileProps) {
  const board = cardBoard(state, card)
  const labels = board.labels.filter((l) => card.labelIds.includes(l.id))
  const members = state.members.filter((m) => card.memberIds.includes(m.id))
  const done = card.checklist.filter((i) => i.done).length
  const project = showProject && card.homeBoardId ? state.boards[card.homeBoardId] : undefined
  const homeList = project && card.homeListId ? state.lists[card.homeListId] : undefined
  return (
    <div
      className={
        'card-tile' + (dragging ? ' dragging' : '') + (landed ? ' landed' : '') + (card.completed ? ' completed' : '') + (card.cover ? ' has-color' : '')
      }
      style={card.cover ? coloredCardStyle(card.cover) : undefined}
      draggable
      onClick={onClick}
      onDragStart={(e) => {
        e.stopPropagation()
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', card.title)
        const height = e.currentTarget.getBoundingClientRect().height
        // After the browser has taken its picture of the card: hiding it any sooner cancels the drag.
        setTimeout(() => onDragStart(height))
      }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
    >
      {project && (
        <span className="project-chip">
          <span style={{ background: project.color }} />
          {homeList ? `${project.title} · ${homeList.title}` : project.title}
        </span>
      )}
      {card.sourceId && (
        <span className="source-chip" title="從 Beamup 送來的待辦">
          <Sparkles size={11} /> Beamup
        </span>
      )}
      {labels.length > 0 && (
        <div className="chips card-labels">
          {labels.map((l) => (
            <LabelChip key={l.id} label={l} />
          ))}
        </div>
      )}
      <div className="card-title">
        {onComplete && (
          <button
            className={'card-check' + (card.completed ? ' on' : '')}
            title={card.completed ? '改回未完成' : '標記完成'}
            aria-label={card.completed ? '改回未完成' : '標記完成'}
            onClick={(e) => {
              e.stopPropagation()
              onComplete()
            }}
          >
            <Check size={11} strokeWidth={3} />
          </button>
        )}
        {card.title}
      </div>
      <div className="card-badges">
        <DueBadge card={card} />
        {card.description && (
          <span className="badge" title="有描述">
            <AlignLeft size={13} />
          </span>
        )}
        {card.comments.length > 0 && (
          <span className="badge">
            <MessageSquare size={13} /> {card.comments.length}
          </span>
        )}
        {card.checklist.length > 0 && (
          <span className={done === card.checklist.length ? 'badge due done' : 'badge'}>
            <SquareCheck size={13} /> {done}/{card.checklist.length}
          </span>
        )}
        <span className="spacer" />
        {members.map((m) => (
          <Avatar key={m.id} member={m} size={22} />
        ))}
      </div>
    </div>
  )
}

/** The trailing "add list" column; also accepts a dragged list to append it to this board. */
export function AddListColumn({
  dnd,
  onAdd,
  onDropList,
  className,
}: {
  dnd: Dnd
  onAdd: (title: string) => void
  onDropList: (listId: ID) => void
  className?: string
}) {
  const { drag, endDrag } = dnd
  return (
    <div
      className={['list add-list', className, drag?.kind === 'list' && 'drop-active'].filter(Boolean).join(' ')}
      onDragOver={(e) => {
        if (drag?.kind !== 'list') return
        e.preventDefault()
        dnd.setDropTarget(null)
      }}
      onDrop={(e) => {
        e.preventDefault()
        if (drag?.kind === 'list') onDropList(drag.id)
        endDrag()
      }}
    >
      <AddForm label="新增清單" placeholder="輸入清單名稱…" onAdd={onAdd} />
    </div>
  )
}

/** Pass the card's color to CSS, which softens it for the current light/dark theme. */
function coloredCardStyle(color: string): React.CSSProperties {
  return { '--card-color': color } as React.CSSProperties
}
