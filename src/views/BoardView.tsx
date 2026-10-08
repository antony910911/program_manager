import { useState } from 'react'
import type { AppState, Board, Card, Filter, ID } from '../types'
import type { Action } from '../store'
import { matchesFilter } from '../store'
import { AddForm, Avatar, DueBadge, InlineEdit, LabelChip } from '../components/common'

interface Props {
  state: AppState
  board: Board
  filter: Filter
  dispatch: (a: Action) => void
  openCard: (id: ID) => void
}

type Drag = { kind: 'card'; id: ID } | { kind: 'list'; id: ID } | null

export function BoardView({ state, board, filter, dispatch, openCard }: Props) {
  const [drag, setDrag] = useState<Drag>(null)
  const [dropTarget, setDropTarget] = useState<{ listId: ID; index: number } | null>(null)

  const endDrag = () => {
    setDrag(null)
    setDropTarget(null)
  }

  return (
    <div className="board-canvas">
      {board.listIds.map((listId, listIndex) => {
        const list = state.lists[listId]
        const cards = list.cardIds.map((id) => state.cards[id]).filter((c) => !c.archived && matchesFilter(c, filter))
        return (
          <div
            key={listId}
            className={'list' + (drag?.kind === 'list' && drag.id === listId ? ' dragging' : '')}
            onDragOver={(e) => {
              if (!drag) return
              e.preventDefault()
              if (drag.kind === 'card' && cards.length === 0) setDropTarget({ listId, index: 0 })
            }}
            onDrop={(e) => {
              e.preventDefault()
              if (drag?.kind === 'list') dispatch({ type: 'moveList', boardId: board.id, listId: drag.id, toIndex: listIndex })
              if (drag?.kind === 'card' && dropTarget) {
                // dropTarget.index is relative to the visible (filtered) cards; map it back to the full list.
                const target = state.lists[dropTarget.listId]
                const anchor = visibleAnchor(state, dropTarget.listId, filter, dropTarget.index, drag.id)
                const toIndex = anchor ? target.cardIds.filter((c) => c !== drag.id).indexOf(anchor) : Infinity
                dispatch({ type: 'moveCard', cardId: drag.id, toListId: dropTarget.listId, toIndex })
              }
              endDrag()
            }}
          >
            <div
              className="list-header"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move'
                setDrag({ kind: 'list', id: listId })
              }}
              onDragEnd={endDrag}
            >
              <InlineEdit className="list-title" value={list.title} onSave={(title) => dispatch({ type: 'renameList', listId, title })} />
              <span className="muted small">{cards.length}</span>
              <button
                className="ghost small"
                title="刪除清單"
                onClick={() =>
                  confirm(`刪除清單「${list.title}」及其所有卡片？`) && dispatch({ type: 'deleteList', boardId: board.id, listId })
                }
              >
                ⋯
              </button>
            </div>
            <div className="list-cards">
              {cards.map((card, i) => (
                <div key={card.id}>
                  {dropTarget?.listId === listId && dropTarget.index === i && <div className="drop-placeholder" />}
                  <CardTile
                    state={state}
                    board={board}
                    card={card}
                    dragging={drag?.kind === 'card' && drag.id === card.id}
                    onClick={() => openCard(card.id)}
                    onDragStart={() => setDrag({ kind: 'card', id: card.id })}
                    onDragEnd={endDrag}
                    onDragOver={(e) => {
                      if (drag?.kind !== 'card') return
                      e.preventDefault()
                      e.stopPropagation()
                      const rect = e.currentTarget.getBoundingClientRect()
                      const after = e.clientY > rect.top + rect.height / 2
                      setDropTarget({ listId, index: after ? i + 1 : i })
                    }}
                  />
                </div>
              ))}
              {dropTarget?.listId === listId && dropTarget.index >= cards.length && <div className="drop-placeholder" />}
            </div>
            <AddForm label="新增卡片" placeholder="輸入卡片標題…" onAdd={(title) => dispatch({ type: 'addCard', listId, title })} />
          </div>
        )
      })}
      <div className="list add-list">
        <AddForm label="新增清單" placeholder="輸入清單名稱…" onAdd={(title) => dispatch({ type: 'addList', boardId: board.id, title })} />
      </div>
    </div>
  )
}

/** The id of the visible card currently at `index`, which the dragged card should be placed before. */
function visibleAnchor(state: AppState, listId: ID, filter: Filter, index: number, draggedId: ID): ID | undefined {
  const visible = state.lists[listId].cardIds.filter((id) => {
    const c = state.cards[id]
    return !c.archived && matchesFilter(c, filter)
  })
  for (let i = index; i < visible.length; i++) if (visible[i] !== draggedId) return visible[i]
  return undefined
}

interface TileProps {
  state: AppState
  board: Board
  card: Card
  dragging: boolean
  onClick: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void
}

function CardTile({ state, board, card, dragging, onClick, onDragStart, onDragEnd, onDragOver }: TileProps) {
  const labels = board.labels.filter((l) => card.labelIds.includes(l.id))
  const members = state.members.filter((m) => card.memberIds.includes(m.id))
  const done = card.checklist.filter((i) => i.done).length
  return (
    <div
      className={'card-tile' + (dragging ? ' dragging' : '') + (card.completed ? ' completed' : '')}
      draggable
      onClick={onClick}
      onDragStart={(e) => {
        e.stopPropagation()
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
    >
      {labels.length > 0 && (
        <div className="chips">
          {labels.map((l) => (
            <LabelChip key={l.id} label={l} />
          ))}
        </div>
      )}
      <div className="card-title">{card.title}</div>
      <div className="card-badges">
        <DueBadge card={card} />
        {card.description && <span title="有描述">≡</span>}
        {card.comments.length > 0 && <span>💬 {card.comments.length}</span>}
        {card.checklist.length > 0 && (
          <span className={done === card.checklist.length ? 'due done' : ''}>
            ☑ {done}/{card.checklist.length}
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
