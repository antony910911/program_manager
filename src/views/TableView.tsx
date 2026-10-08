import { useState } from 'react'
import type { AppState, Board, Card, Filter, ID } from '../types'
import { boardCards, matchesFilter } from '../store'
import { Avatar, DueBadge, LabelChip } from '../components/common'

interface Props {
  state: AppState
  board: Board
  filter: Filter
  openCard: (id: ID) => void
}

type SortKey = 'title' | 'list' | 'due' | 'start'

export function TableView({ state, board, filter, openCard }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'list', asc: true })
  const listOrder = (c: Card) => board.listIds.indexOf(c.listId)
  const value = (c: Card): string | number => {
    switch (sort.key) {
      case 'title':
        return c.title
      case 'list':
        return listOrder(c)
      case 'due':
        return c.dueDate ?? '9999'
      case 'start':
        return c.startDate ?? '9999'
    }
  }
  const cards = boardCards(state, board.id)
    .filter((c) => matchesFilter(c, filter))
    .sort((a, b) => {
      const va = value(a)
      const vb = value(b)
      const r = va < vb ? -1 : va > vb ? 1 : 0
      return sort.asc ? r : -r
    })

  const header = (key: SortKey, text: string) => (
    <th onClick={() => setSort((s) => ({ key, asc: s.key === key ? !s.asc : true }))}>
      {text} {sort.key === key ? (sort.asc ? '▲' : '▼') : ''}
    </th>
  )

  return (
    <div className="view-panel">
      <table className="table">
        <thead>
          <tr>
            {header('title', '卡片')}
            {header('list', '清單')}
            <th>標籤</th>
            <th>成員</th>
            {header('start', '開始')}
            {header('due', '到期')}
            {board.customFields.map((f) => (
              <th key={f.id}>{f.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cards.map((c) => (
            <tr key={c.id} onClick={() => openCard(c.id)}>
              <td className={c.completed ? 'strike' : ''}>{c.title}</td>
              <td>{state.lists[c.listId].title}</td>
              <td>
                <div className="chips">
                  {board.labels
                    .filter((l) => c.labelIds.includes(l.id))
                    .map((l) => (
                      <LabelChip key={l.id} label={l} wide />
                    ))}
                </div>
              </td>
              <td>
                {state.members
                  .filter((m) => c.memberIds.includes(m.id))
                  .map((m) => (
                    <Avatar key={m.id} member={m} size={22} />
                  ))}
              </td>
              <td>{c.startDate ?? '—'}</td>
              <td>
                <DueBadge card={c} />
              </td>
              {board.customFields.map((f) => (
                <td key={f.id}>{c.customFields[f.id] || '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {cards.length === 0 && <p className="muted center">沒有符合條件的卡片</p>}
    </div>
  )
}
