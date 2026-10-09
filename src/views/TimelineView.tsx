import { useState } from 'react'
import type { AppState, Board, Card, Filter, ID } from '../types'
import { addDays, boardCards, dayOf, daysBetween, doneDate, isOverdue, matchesFilter, parseYmd, today } from '../store'
import { Segmented } from '../components/controls'

interface Props {
  state: AppState
  board: Board
  filter: Filter
  openCard: (id: ID) => void
}

const DAY_W = 32

/**
 * Gantt-style timeline, grouped by list.
 * 計畫 draws start → due date (cards need one of them); 實際 draws created → completed (or today if still open),
 * so every card shows up and the year can be looked back on as it really went.
 */
export function TimelineView({ state, board, filter, openCard }: Props) {
  const [mode, setMode] = useState<'plan' | 'actual'>('plan')
  const t = today()
  const cards = boardCards(state, board.id).filter(
    (c) => (mode === 'actual' || c.startDate || c.dueDate) && matchesFilter(c, filter),
  )
  const span = (c: Card) => {
    let s: string, e: string
    if (mode === 'actual') {
      s = dayOf(c.createdAt)
      e = c.completed ? doneDate(c).date : t
    } else {
      s = c.startDate ?? c.dueDate!
      e = c.dueDate ?? c.startDate!
    }
    return s <= e ? [s, e] : [e, s]
  }
  const allDates = cards.flatMap(span).concat(t)
  const min = addDays(
    allDates.reduce((a, b) => (a < b ? a : b)),
    -3,
  )
  const max = addDays(
    allDates.reduce((a, b) => (a > b ? a : b)),
    7,
  )
  const total = daysBetween(min, max) + 1
  const days = Array.from({ length: total }, (_, i) => addDays(min, i))

  return (
    <div className="view-panel timeline-wrap">
      <div className="timeline-mode">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'plan', label: '計畫（開始日 → 到期日）' },
            { value: 'actual', label: '實際（建立 → 完成）' },
          ]}
        />
      </div>
      <div className="timeline" style={{ width: 180 + total * DAY_W }}>
        <div className="tl-row tl-header">
          <div className="tl-name" />
          {days.map((d) => {
            const date = parseYmd(d)
            return (
              <div
                key={d}
                className={'tl-day' + (d === t ? ' today' : '') + ([0, 6].includes(date.getDay()) ? ' weekend' : '')}
                style={{ width: DAY_W }}
              >
                {date.getDate() === 1 || d === min ? <b>{date.getMonth() + 1}/</b> : null}
                {date.getDate()}
              </div>
            )
          })}
        </div>
        {[...board.listIds, ...(board.id === state.focusBoardId ? [] : state.boards[state.focusBoardId].listIds)].map((lid) => {
          const group = cards.filter((c) => c.listId === lid)
          if (!group.length) return null
          return (
            <div key={lid}>
              <div className="tl-group">
                {state.lists[lid].color && <span className="list-dot" style={{ background: state.lists[lid].color! }} />}
                {state.lists[lid].title}
                {state.boards[state.focusBoardId].listIds.includes(lid) && board.id !== state.focusBoardId && (
                  <span className="muted small"> · 雙層模式</span>
                )}
              </div>
              {group.map((c) => {
                const [s, e] = span(c)
                const label = board.labels.find((l) => c.labelIds.includes(l.id))
                return (
                  <div key={c.id} className="tl-row">
                    <div className="tl-name" title={c.title}>
                      {c.title}
                    </div>
                    <div className="tl-track">
                      <div className="tl-today" style={{ left: daysBetween(min, t) * DAY_W + DAY_W / 2 }} />
                      <div
                        className={'tl-bar' + (isOverdue(c) ? ' overdue' : '') + (c.completed ? ' completed' : '')}
                        style={{
                          left: daysBetween(min, s) * DAY_W + 2,
                          width: (daysBetween(s, e) + 1) * DAY_W - 4,
                          background: label?.color ?? '#5e6c84',
                        }}
                        onClick={() => openCard(c.id)}
                        title={
                          mode === 'actual'
                            ? `${c.title}：${s} 建立 → ${c.completed ? e + ' 完成' : '進行中'}`
                            : `${c.title}：${s} → ${e}`
                        }
                      >
                        {c.title}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
        {cards.length === 0 && (
          <p className="muted center">
            {mode === 'plan' ? '為卡片設定開始日或到期日後，就會出現在時間軸上；或切到「實際」看建立到完成的時間' : '這個看板還沒有卡片'}
          </p>
        )}
      </div>
    </div>
  )
}
