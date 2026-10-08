import type { AppState, Board, Filter, ID } from '../types'
import { addDays, boardCards, daysBetween, isOverdue, matchesFilter, parseYmd, today } from '../store'

interface Props {
  state: AppState
  board: Board
  filter: Filter
  openCard: (id: ID) => void
}

const DAY_W = 32

/** Gantt-style timeline, grouped by list. Cards need a start or due date to appear. */
export function TimelineView({ state, board, filter, openCard }: Props) {
  const cards = boardCards(state, board.id).filter((c) => (c.startDate || c.dueDate) && matchesFilter(c, filter))
  const t = today()
  const span = (c: (typeof cards)[number]) => {
    const s = c.startDate ?? c.dueDate!
    const e = c.dueDate ?? c.startDate!
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
        {board.listIds.map((lid) => {
          const group = cards.filter((c) => c.listId === lid)
          if (!group.length) return null
          return (
            <div key={lid}>
              <div className="tl-group">{state.lists[lid].title}</div>
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
                        title={`${c.title}：${s} → ${e}`}
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
        {cards.length === 0 && <p className="muted center">為卡片設定開始日或到期日後，就會出現在時間軸上</p>}
      </div>
    </div>
  )
}
