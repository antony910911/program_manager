import type { AppState, Board, Filter } from '../types'
import { addDays, boardCards, isOverdue, matchesFilter, today } from '../store'

interface Props {
  state: AppState
  board: Board
  filter: Filter
}

function BarChart({ rows }: { rows: { name: string; value: number; color: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="bars">
      {rows.map((r) => (
        <div key={r.name} className="bar-row">
          <span className="bar-name">{r.name}</span>
          <div className="bar-track">
            <div className="bar" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
          </div>
          <span className="bar-value">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

export function DashboardView({ state, board, filter }: Props) {
  const cards = boardCards(state, board.id).filter((c) => matchesFilter(c, filter))
  const t = today()
  const overdue = cards.filter(isOverdue).length
  const completed = cards.filter((c) => c.completed).length
  const dueSoon = cards.filter((c) => !c.completed && c.dueDate && c.dueDate >= t && c.dueDate <= addDays(t, 7)).length
  const activity = state.activity.filter((a) => a.boardId === board.id).slice(0, 15)

  return (
    <div className="view-panel dashboard">
      <div className="stats">
        <div className="stat">
          <div className="stat-value">{cards.length}</div>
          <div className="muted">卡片總數</div>
        </div>
        <div className="stat">
          <div className="stat-value">{cards.length ? Math.round((completed / cards.length) * 100) : 0}%</div>
          <div className="muted">完成率</div>
        </div>
        <div className="stat">
          <div className="stat-value warn">{dueSoon}</div>
          <div className="muted">7 天內到期</div>
        </div>
        <div className="stat">
          <div className="stat-value bad">{overdue}</div>
          <div className="muted">已逾期</div>
        </div>
      </div>
      <div className="charts">
        <div className="chart">
          <h4>各清單卡片數</h4>
          <BarChart
            rows={board.listIds.map((lid) => ({
              name: state.lists[lid].title,
              value: cards.filter((c) => c.listId === lid).length,
              color: 'var(--accent)',
            }))}
          />
        </div>
        <div className="chart">
          <h4>各標籤卡片數</h4>
          <BarChart
            rows={board.labels.map((l) => ({
              name: l.name || '(未命名)',
              value: cards.filter((c) => c.labelIds.includes(l.id)).length,
              color: l.color,
            }))}
          />
        </div>
        <div className="chart">
          <h4>各成員卡片數</h4>
          <BarChart
            rows={[
              ...state.members.map((m) => ({
                name: m.name,
                value: cards.filter((c) => c.memberIds.includes(m.id)).length,
                color: m.color,
              })),
              { name: '未指派', value: cards.filter((c) => c.memberIds.length === 0).length, color: '#a5adba' },
            ]}
          />
        </div>
        <div className="chart">
          <h4>最近活動</h4>
          {activity.length === 0 && <p className="muted">還沒有活動紀錄</p>}
          <ul className="activity">
            {activity.map((a) => (
              <li key={a.id}>
                {a.text}
                <div className="muted small">{new Date(a.at).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
