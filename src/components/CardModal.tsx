import { useState } from 'react'
import type { AppState, Board, Card } from '../types'
import type { Action } from '../store'
import { uid } from '../store'
import { Undo2, Archive, CheckSquare, Image, MessageSquare, Tag, Trash2, Users, X, AlignLeft, CalendarDays, Type } from 'lucide-react'
import { COVER_COLORS, softPreview } from '../theme'
import { Avatar, InlineEdit } from './common'
import { ConfirmButton } from './controls'

interface Props {
  state: AppState
  board: Board
  card: Card
  dispatch: (a: Action) => void
  onClose: () => void
}

export function CardModal({ state, board, card, dispatch, onClose }: Props) {
  const update = (patch: Partial<Card>) => dispatch({ type: 'updateCard', cardId: card.id, patch })
  const [desc, setDesc] = useState(card.description)
  const [newItem, setNewItem] = useState('')
  const [comment, setComment] = useState('')
  const done = card.checklist.filter((i) => i.done).length
  // The project list a card was pulled up from, if it still exists in a board.
  const homeList =
    card.homeListId && state.lists[card.homeListId] && card.homeBoardId && state.boards[card.homeBoardId]?.listIds.includes(card.homeListId)
      ? state.lists[card.homeListId]
      : undefined
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        {card.cover && <div className="modal-cover" style={{ background: softPreview(card.cover, 'card', state.theme.colorStrength) }} />}
        <button className="modal-close icon-btn" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="modal-head">
          <input type="checkbox" checked={card.completed} onChange={(e) => update({ completed: e.target.checked })} title="標記完成" />
          <InlineEdit className="modal-title" value={card.title} onSave={(title) => update({ title })} />
        </div>
        <div className="muted">
          在清單「
          <select
            value={card.listId}
            onChange={(e) => dispatch({ type: 'moveCard', cardId: card.id, toListId: e.target.value, toIndex: Infinity })}
          >
            {[state.focusBoardId, ...(board.id === state.focusBoardId ? [] : [board.id])].map((bid) => (
              <optgroup key={bid} label={bid === state.focusBoardId ? '雙層模式' : state.boards[bid].title}>
                {state.boards[bid].listIds.map((lid) => (
                  <option key={lid} value={lid}>
                    {state.lists[lid].title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          」中
        </div>

        <div className="modal-body">
          <div className="modal-main">
            <section>
              <h4>
                <Tag size={15} /> 標籤
              </h4>
              <div className="chips">
                {board.labels.map((l) => (
                  <button
                    key={l.id}
                    className={'label-toggle' + (card.labelIds.includes(l.id) ? ' on' : '')}
                    style={{ background: l.color }}
                    onClick={() => update({ labelIds: toggle(card.labelIds, l.id) })}
                  >
                    {l.name || ' '}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h4>
                <Users size={15} /> 成員
              </h4>
              <div className="chips">
                {state.members.map((m) => (
                  <button
                    key={m.id}
                    className={'member-toggle' + (card.memberIds.includes(m.id) ? ' on' : '')}
                    onClick={() => update({ memberIds: toggle(card.memberIds, m.id) })}
                  >
                    <Avatar member={m} size={22} /> {m.name}
                  </button>
                ))}
              </div>
            </section>

            <section className="row wrap dates">
              <CalendarDays size={15} />
              <label>
                開始日 <input type="date" value={card.startDate ?? ''} onChange={(e) => update({ startDate: e.target.value || null })} />
              </label>
              <label>
                到期日 <input type="date" value={card.dueDate ?? ''} onChange={(e) => update({ dueDate: e.target.value || null })} />
              </label>
            </section>

            <section>
              <h4>
                <AlignLeft size={15} /> 描述
              </h4>
              <textarea
                rows={4}
                placeholder="新增更詳細的描述…"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                onBlur={() => desc !== card.description && update({ description: desc })}
              />
            </section>

            {board.customFields.length > 0 && (
              <section>
                <h4>
                  <Type size={15} /> 自訂欄位
                </h4>
                <div className="custom-fields">
                  {board.customFields.map((f) => {
                    const v = card.customFields[f.id] ?? ''
                    const set = (val: string) => update({ customFields: { ...card.customFields, [f.id]: val } })
                    return (
                      <label key={f.id}>
                        {f.name}
                        {f.type === 'select' ? (
                          <select value={v} onChange={(e) => set(e.target.value)}>
                            <option value="">—</option>
                            {f.options.map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </select>
                        ) : (
                          <input type={f.type} value={v} onChange={(e) => set(e.target.value)} />
                        )}
                      </label>
                    )
                  })}
                </div>
              </section>
            )}

            <section>
              <h4>
                <CheckSquare size={15} /> 待辦清單{' '}
                {card.checklist.length > 0 && (
                  <span className="muted">
                    ({done}/{card.checklist.length})
                  </span>
                )}
              </h4>
              {card.checklist.length > 0 && (
                <div className="progress">
                  <div style={{ width: `${(done / card.checklist.length) * 100}%` }} />
                </div>
              )}
              {card.checklist.map((item) => (
                <div key={item.id} className="check-item">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => update({ checklist: card.checklist.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)) })}
                  />
                  <span className={item.done ? 'strike' : ''}>{item.text}</span>
                  <button className="icon-btn" onClick={() => update({ checklist: card.checklist.filter((i) => i.id !== item.id) })}>
                    <X size={14} />
                  </button>
                </div>
              ))}
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!newItem.trim()) return
                  update({ checklist: [...card.checklist, { id: uid(), text: newItem.trim(), done: false }] })
                  setNewItem('')
                }}
              >
                <input placeholder="新增項目…" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
                <button className="btn primary">新增</button>
              </form>
            </section>

            <section>
              <h4>
                <MessageSquare size={15} /> 留言
              </h4>
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!comment.trim()) return
                  dispatch({ type: 'addComment', cardId: card.id, text: comment.trim() })
                  setComment('')
                }}
              >
                <input placeholder="撰寫留言…" value={comment} onChange={(e) => setComment(e.target.value)} />
                <button className="btn primary">送出</button>
              </form>
              {[...card.comments].reverse().map((c) => {
                const m = state.members.find((x) => x.id === c.memberId)
                return (
                  <div key={c.id} className="comment">
                    {m && <Avatar member={m} size={24} />}
                    <div>
                      <div className="muted small">
                        {m?.name} · {new Date(c.createdAt).toLocaleString()}
                      </div>
                      <div>{c.text}</div>
                    </div>
                  </div>
                )
              })}
            </section>
          </div>

          <aside className="modal-side">
            <div className="side-title">
              <Image size={14} /> 卡片顏色
            </div>
            <div className="cover-swatches">
              <button className={'swatch none' + (card.cover ? '' : ' on')} title="無顏色" onClick={() => update({ cover: null })}>
                <X size={12} />
              </button>
              {COVER_COLORS.map((c) => (
                <button
                  key={c}
                  className={'swatch' + (card.cover === c ? ' on' : '')}
                  style={{ background: softPreview(c, 'card', state.theme.colorStrength) }}
                  onClick={() => update({ cover: c })}
                />
              ))}
              <input
                type="color"
                title="自訂封面顏色"
                value={card.cover ?? '#579dff'}
                onChange={(e) => update({ cover: e.target.value })}
              />
            </div>
            <div className="side-title">動作</div>
            {homeList && card.listId !== homeList.id && (
              <button
                className="btn primary"
                title={`移回「${homeList.title}」`}
                onClick={() => dispatch({ type: 'moveCard', cardId: card.id, toListId: homeList.id, toIndex: Infinity })}
              >
                <Undo2 size={14} /> 移回原清單
              </button>
            )}
            <button className="btn" onClick={() => update({ archived: true })}>
              <Archive size={14} /> 封存
            </button>
            <ConfirmButton
              className="btn danger"
              confirmText="再按一次刪除"
              onConfirm={() => {
                dispatch({ type: 'deleteCard', cardId: card.id })
                onClose()
              }}
            >
              <Trash2 size={14} /> 刪除
            </ConfirmButton>
          </aside>
        </div>
      </div>
    </div>
  )
}
