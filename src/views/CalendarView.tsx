import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { AppState, Board, Filter, ID } from '../types'
import type { Action } from '../store'
import { boardCards, isOverdue, matchesFilter, today, ymd } from '../store'

interface Props {
  state: AppState
  board: Board
  filter: Filter
  dispatch: (a: Action) => void
  openCard: (id: ID) => void
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function CalendarView({ state, board, filter, dispatch, openCard }: Props) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [dragId, setDragId] = useState<ID | null>(null)

  const cards = boardCards(state, board.id).filter((c) => c.dueDate && matchesFilter(c, filter))
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const start = new Date(first)
  start.setDate(1 - first.getDay())
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
  const t = today()
  const shift = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1))

  return (
    <div className="view-panel">
      <div className="row cal-nav">
        <button className="icon-btn" onClick={() => shift(-1)}>
          <ChevronLeft size={18} />
        </button>
        <strong>
          {cursor.getFullYear()} 年 {cursor.getMonth() + 1} 月
        </strong>
        <button className="icon-btn" onClick={() => shift(1)}>
          <ChevronRight size={18} />
        </button>
        <button className="btn small" onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
          今天
        </button>
        <span className="muted small">提示：把卡片拖到其他日期即可改到期日</span>
      </div>
      <div className="calendar">
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal-head">
            {w}
          </div>
        ))}
        {days.map((d) => {
          const key = ymd(d)
          const dayCards = cards.filter((c) => c.dueDate === key)
          const cls = ['cal-day', d.getMonth() !== cursor.getMonth() && 'other', key === t && 'today'].filter(Boolean).join(' ')
          return (
            <div
              key={key}
              className={cls}
              onDragOver={(e) => dragId && e.preventDefault()}
              onDrop={() => {
                if (dragId) dispatch({ type: 'updateCard', cardId: dragId, patch: { dueDate: key } })
                setDragId(null)
              }}
            >
              <div className="cal-date">{d.getDate()}</div>
              {dayCards.map((c) => {
                const label = board.labels.find((l) => c.labelIds.includes(l.id))
                return (
                  <div
                    key={c.id}
                    className={'cal-card' + (isOverdue(c) ? ' overdue' : '') + (c.completed ? ' completed' : '')}
                    style={{ borderLeftColor: label?.color ?? '#aaa' }}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => openCard(c.id)}
                  >
                    {c.title}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
