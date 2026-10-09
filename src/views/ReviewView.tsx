import { useState } from 'react'
import { Archive } from 'lucide-react'
import type { AppState, Card, ID } from '../types'
import { allBoardCards, boardOfList, doneDate, parseYmd } from '../store'

interface Props {
  state: AppState
  /** Board to start on; 'all' covers every board plus cards that only live in the top lists. */
  initialScope: ID | 'all'
  openCard: (id: ID) => void
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

interface Group {
  key: string
  name: string
  color: string
}

/**
 * Year-in-review: every card completed in a year, month by month, with where the work went.
 * Completed cards stay in the record even after they leave their list; archived ones are included too.
 */
export function ReviewView({ state, initialScope, openCard }: Props) {
  const [scope, setScope] = useState<ID | 'all'>(initialScope)
  const scopeCards = scope === 'all' ? Object.values(state.cards) : allBoardCards(state, scope)
  const done = scopeCards.filter((c) => c.completed).map((c) => ({ card: c, ...doneDate(c) }))

  const [thisYear] = useState(() => new Date().getFullYear())
  const years = [...new Set([thisYear, ...done.map((d) => Number(d.date.slice(0, 4)))])].sort((a, b) => b - a)
  const titleYear = scope !== 'all' ? Number(/\d{4}/.exec(state.boards[scope]?.title ?? '')?.[0]) : NaN
  const [year, setYear] = useState(() =>
    years.includes(titleYear) ? titleYear : done.length ? Math.max(...done.map((d) => Number(d.date.slice(0, 4)))) : thisYear,
  )

  if (!years.includes(year)) years.push(year)
  const items = done.filter((d) => d.date.startsWith(String(year))).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const byMonth = MONTHS.map((m) => items.filter((d) => parseYmd(d.date).getMonth() + 1 === m))
  const peak = Math.max(0, ...byMonth.map((m) => m.length))
  const busiest = peak ? byMonth.findIndex((m) => m.length === peak) + 1 : 0
  const withDue = items.filter((d) => d.exact && d.card.dueDate)
  const onTime = withDue.filter((d) => d.date <= d.card.dueDate!).length

  // Where the work went: lists of the board, or boards when looking at everything.
  const groupOf = (c: Card): Group => {
    if (scope === 'all') {
      const b = c.homeBoardId ?? boardOfList(state, c.listId)
      if (!b || b === state.focusBoardId) return { key: 'focus', name: '雙層模式（未歸專案）', color: '#94a3b8' }
      return { key: b, name: state.boards[b].title, color: state.boards[b].color }
    }
    const lid = c.homeListId && state.lists[c.homeListId] ? c.homeListId : c.listId
    const l = state.lists[lid]
    return { key: lid, name: l?.title ?? '已刪除的清單', color: l?.color ?? 'var(--accent)' }
  }
  const groups = new Map<string, Group & { count: number }>()
  for (const d of items) {
    const g = groupOf(d.card)
    groups.set(g.key, { ...g, count: (groups.get(g.key)?.count ?? 0) + 1 })
  }
  const ranked = [...groups.values()].sort((a, b) => b.count - a.count)
  const top = ranked[0]?.count ?? 0

  const scopes: { id: ID | 'all'; name: string }[] = [
    { id: 'all', name: '全部看板' },
    ...state.boardOrder.map((id) => ({ id, name: state.boards[id].title })),
  ]

  return (
    <div className="view-panel review">
      <div className="review-head">
        <h2>{year} 年度回顧</h2>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="年份">
          {years.map((y) => (
            <option key={y} value={y}>
              {y} 年
            </option>
          ))}
        </select>
        <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="範圍">
          {scopes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {items.length === 0 ? (
        <p className="muted review-empty">
          {year} 年還沒有完成的卡片。把卡片打勾完成後，就會依完成日期記在這裡。
        </p>
      ) : (
        <>
          <div className="review-stats">
            <div>
              <span className="muted small">完成</span>
              <strong>{items.length}</strong>
              <span className="muted small">張卡片</span>
            </div>
            <div>
              <span className="muted small">最忙的月份</span>
              <strong>{busiest} 月</strong>
              <span className="muted small">完成 {peak} 張</span>
            </div>
            <div>
              <span className="muted small">{scope === 'all' ? '看板' : '清單'}</span>
              <strong>{ranked.length}</strong>
              <span className="muted small">個有進展</span>
            </div>
            {withDue.length > 0 && (
              <div>
                <span className="muted small">準時完成</span>
                <strong>{Math.round((onTime / withDue.length) * 100)}%</strong>
                <span className="muted small">
                  {onTime} / {withDue.length} 張有到期日的
                </span>
              </div>
            )}
          </div>

          <section className="review-card">
            <h3>每月完成數</h3>
            <div className="review-months" role="list">
              {byMonth.map((m, i) => (
                <a
                  key={i}
                  role="listitem"
                  className={'review-month' + (m.length ? '' : ' empty')}
                  href={m.length ? `#review-m${i + 1}` : undefined}
                  title={`${i + 1} 月：完成 ${m.length} 張`}
                  onClick={(e) => {
                    e.preventDefault()
                    document.getElementById(`review-m${i + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                >
                  <span className="review-month-value">{m.length || ''}</span>
                  <span className="review-month-track">
                    <span style={{ height: peak ? `${(m.length / peak) * 100}%` : 0 }} />
                  </span>
                  <span className="review-month-label">{i + 1}月</span>
                </a>
              ))}
            </div>
          </section>

          <section className="review-card">
            <h3>{scope === 'all' ? '各看板完成數' : '各清單完成數'}</h3>
            <div className="review-groups">
              {ranked.map((g) => (
                <div key={g.key} className="review-group" title={`${g.name}：${g.count} 張`}>
                  <span className="review-group-name">
                    <i style={{ background: g.color }} />
                    {g.name}
                  </span>
                  <span className="review-group-track">
                    <span style={{ width: `${(g.count / top) * 100}%`, background: g.color }} />
                  </span>
                  <span className="review-group-count">{g.count}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="review-card">
            <h3>完成紀錄</h3>
            {byMonth.map((m, i) =>
              m.length ? (
                <div key={i} id={`review-m${i + 1}`} className="review-log-month">
                  <h4>
                    {i + 1} 月 <span className="muted small">· {m.length} 張</span>
                  </h4>
                  <ul>
                    {m.map(({ card, date, exact }) => {
                      const g = groupOf(card)
                      const d = parseYmd(date)
                      return (
                        <li key={card.id}>
                          <button className="review-item" onClick={() => openCard(card.id)}>
                            <span className="review-date" title={exact ? '完成日' : '完成日沒有記錄，以到期日或建立日估計'}>
                              {exact ? '' : '約 '}
                              {d.getMonth() + 1}/{d.getDate()}
                            </span>
                            <span className="review-title">{card.title}</span>
                            <span className="review-chip">
                              <i style={{ background: g.color }} />
                              {g.name}
                            </span>
                            {card.archived && (
                              <span className="review-archived" title="已封存">
                                <Archive size={12} />
                              </span>
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ) : null,
            )}
          </section>
        </>
      )}
    </div>
  )
}
