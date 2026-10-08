import { useState } from 'react'
import type { Board, Filter, ID, ViewKind } from './types'
import { BOARD_COLORS, LABEL_COLORS, emptyFilter, useAppStore } from './store'
import type { Action } from './store'
import { Avatar, InlineEdit } from './components/common'
import { CardModal } from './components/CardModal'
import { BoardView } from './views/BoardView'
import { TableView } from './views/TableView'
import { CalendarView } from './views/CalendarView'
import { TimelineView } from './views/TimelineView'
import { DashboardView } from './views/DashboardView'

const VIEWS: { kind: ViewKind; name: string }[] = [
  { kind: 'board', name: '看板' },
  { kind: 'table', name: '表格' },
  { kind: 'calendar', name: '行事曆' },
  { kind: 'timeline', name: '時間軸' },
  { kind: 'dashboard', name: '儀表板' },
]

export default function App() {
  const [state, dispatch] = useAppStore()
  const [boardId, setBoardId] = useState<ID | null>(null)
  const [view, setView] = useState<ViewKind>('board')
  const [filter, setFilter] = useState<Filter>(emptyFilter)
  const [openCardId, setOpenCardId] = useState<ID | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const board = boardId ? state.boards[boardId] : undefined
  const openCard = openCardId ? state.cards[openCardId] : undefined
  const me = state.members.find((m) => m.id === state.currentMemberId)

  return (
    <div className="app" style={{ '--board-color': board?.color ?? '#026aa7' } as React.CSSProperties}>
      <header className="topbar">
        <button className="brand ghost" onClick={() => setBoardId(null)}>
          ▦ Program Manager
        </button>
        {board && (
          <select value={board.id} onChange={(e) => setBoardId(e.target.value)}>
            {state.boardOrder.map((id) => (
              <option key={id} value={id}>
                {state.boards[id].title}
              </option>
            ))}
          </select>
        )}
        <span className="spacer" />
        {me && <Avatar member={me} />}
      </header>

      {!board ? (
        <Home state={state} dispatch={dispatch} onOpen={(id) => setBoardId(id)} />
      ) : (
        <main className="board-page">
          <div className="board-bar">
            <InlineEdit
              className="board-title"
              value={board.title}
              onSave={(title) => dispatch({ type: 'renameBoard', boardId: board.id, title })}
            />
            <nav className="tabs">
              {VIEWS.map((v) => (
                <button key={v.kind} className={view === v.kind ? 'tab active' : 'tab'} onClick={() => setView(v.kind)}>
                  {v.name}
                </button>
              ))}
            </nav>
            <span className="spacer" />
            <button className="bar-btn" onClick={() => setSettingsOpen(true)}>
              ⚙ 看板設定
            </button>
          </div>
          <FilterBar board={board} members={state.members} filter={filter} setFilter={setFilter} />

          {view === 'board' && <BoardView state={state} board={board} filter={filter} dispatch={dispatch} openCard={setOpenCardId} />}
          {view === 'table' && <TableView state={state} board={board} filter={filter} openCard={setOpenCardId} />}
          {view === 'calendar' && <CalendarView state={state} board={board} filter={filter} dispatch={dispatch} openCard={setOpenCardId} />}
          {view === 'timeline' && <TimelineView state={state} board={board} filter={filter} openCard={setOpenCardId} />}
          {view === 'dashboard' && <DashboardView state={state} board={board} filter={filter} />}
        </main>
      )}

      {board && openCard && (
        <CardModal key={openCard.id} state={state} board={board} card={openCard} dispatch={dispatch} onClose={() => setOpenCardId(null)} />
      )}
      {board && settingsOpen && (
        <BoardSettings
          state={state}
          board={board}
          dispatch={dispatch}
          onClose={() => setSettingsOpen(false)}
          onDeleted={() => {
            setSettingsOpen(false)
            setBoardId(null)
          }}
        />
      )}
    </div>
  )
}

function Home({
  state,
  dispatch,
  onOpen,
}: {
  state: ReturnType<typeof useAppStore>[0]
  dispatch: (a: Action) => void
  onOpen: (id: ID) => void
}) {
  const [title, setTitle] = useState('')
  const [color, setColor] = useState(BOARD_COLORS[0])
  return (
    <main className="home">
      <h2>你的看板</h2>
      <div className="board-grid">
        {state.boardOrder.map((id) => {
          const b = state.boards[id]
          const count = b.listIds.reduce((n, l) => n + state.lists[l].cardIds.length, 0)
          return (
            <button key={id} className="board-tile" style={{ background: b.color }} onClick={() => onOpen(id)}>
              <strong>{b.title}</strong>
              <span>
                {b.listIds.length} 個清單 · {count} 張卡片
              </span>
            </button>
          )
        })}
        <form
          className="board-tile new"
          onSubmit={(e) => {
            e.preventDefault()
            if (!title.trim()) return
            dispatch({ type: 'addBoard', title: title.trim(), color })
            setTitle('')
          }}
        >
          <input placeholder="新看板名稱" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="swatches">
            {BOARD_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className={c === color ? 'swatch on' : 'swatch'}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <button className="primary">建立看板</button>
        </form>
      </div>
      <p className="muted small">
        資料目前存在瀏覽器的 localStorage。
        <button className="ghost small" onClick={() => confirm('清除所有資料並還原範例？') && dispatch({ type: 'reset' })}>
          重設範例資料
        </button>
      </p>
    </main>
  )
}

function FilterBar({
  board,
  members,
  filter,
  setFilter,
}: {
  board: Board
  members: ReturnType<typeof useAppStore>[0]['members']
  filter: Filter
  setFilter: (f: Filter) => void
}) {
  const toggle = (arr: ID[], v: ID) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
  const active = filter.text || filter.labelIds.length || filter.memberIds.length || filter.due !== 'all'
  return (
    <div className="filter-bar">
      <input placeholder="🔍 搜尋卡片…" value={filter.text} onChange={(e) => setFilter({ ...filter, text: e.target.value })} />
      <div className="chips">
        {board.labels.map((l) => (
          <button
            key={l.id}
            className={'label-toggle small' + (filter.labelIds.includes(l.id) ? ' on' : '')}
            style={{ background: l.color }}
            onClick={() => setFilter({ ...filter, labelIds: toggle(filter.labelIds, l.id) })}
          >
            {l.name || ' '}
          </button>
        ))}
      </div>
      <div className="chips">
        {members.map((m) => (
          <button
            key={m.id}
            className={'avatar-toggle' + (filter.memberIds.includes(m.id) ? ' on' : '')}
            onClick={() => setFilter({ ...filter, memberIds: toggle(filter.memberIds, m.id) })}
          >
            <Avatar member={m} size={22} />
          </button>
        ))}
      </div>
      <select value={filter.due} onChange={(e) => setFilter({ ...filter, due: e.target.value as Filter['due'] })}>
        <option value="all">所有日期</option>
        <option value="overdue">已逾期</option>
        <option value="week">7 天內到期</option>
        <option value="none">沒有到期日</option>
      </select>
      {active ? (
        <button className="bar-btn" onClick={() => setFilter(emptyFilter)}>
          清除篩選
        </button>
      ) : null}
    </div>
  )
}

function BoardSettings({
  state,
  board,
  dispatch,
  onClose,
  onDeleted,
}: {
  state: ReturnType<typeof useAppStore>[0]
  board: Board
  dispatch: (a: Action) => void
  onClose: () => void
  onDeleted: () => void
}) {
  const [fieldName, setFieldName] = useState('')
  const [fieldType, setFieldType] = useState<'text' | 'number' | 'select'>('text')
  const [fieldOptions, setFieldOptions] = useState('')
  const archived = board.listIds.flatMap((lid) => state.lists[lid].cardIds.map((cid) => state.cards[cid])).filter((c) => c.archived)
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal narrow" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close ghost" onClick={onClose}>
          ✕
        </button>
        <h3>看板設定</h3>

        <section>
          <h4>標籤</h4>
          {board.labels.map((l) => (
            <div key={l.id} className="row">
              <input
                type="color"
                value={l.color}
                onChange={(e) => dispatch({ type: 'upsertLabel', boardId: board.id, label: { ...l, color: e.target.value } })}
              />
              <input
                value={l.name}
                placeholder="標籤名稱"
                onChange={(e) => dispatch({ type: 'upsertLabel', boardId: board.id, label: { ...l, name: e.target.value } })}
              />
              <button className="ghost small" onClick={() => dispatch({ type: 'deleteLabel', boardId: board.id, labelId: l.id })}>
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              dispatch({
                type: 'upsertLabel',
                boardId: board.id,
                label: { name: '', color: LABEL_COLORS[board.labels.length % LABEL_COLORS.length] },
              })
            }
          >
            + 新增標籤
          </button>
        </section>

        <section>
          <h4>自訂欄位</h4>
          {board.customFields.map((f) => (
            <div key={f.id} className="row">
              <span>
                {f.name}{' '}
                <span className="muted small">
                  ({f.type}
                  {f.options.length ? `: ${f.options.join(', ')}` : ''})
                </span>
              </span>
              <span className="spacer" />
              <button className="ghost small" onClick={() => dispatch({ type: 'deleteCustomField', boardId: board.id, fieldId: f.id })}>
                ✕
              </button>
            </div>
          ))}
          <form
            className="row wrap"
            onSubmit={(e) => {
              e.preventDefault()
              if (!fieldName.trim()) return
              const options = fieldOptions
                .split(',')
                .map((o) => o.trim())
                .filter(Boolean)
              dispatch({
                type: 'addCustomField',
                boardId: board.id,
                name: fieldName.trim(),
                fieldType,
                options: fieldType === 'select' ? options : [],
              })
              setFieldName('')
              setFieldOptions('')
            }}
          >
            <input placeholder="欄位名稱" value={fieldName} onChange={(e) => setFieldName(e.target.value)} />
            <select value={fieldType} onChange={(e) => setFieldType(e.target.value as typeof fieldType)}>
              <option value="text">文字</option>
              <option value="number">數字</option>
              <option value="select">下拉選單</option>
            </select>
            {fieldType === 'select' && (
              <input placeholder="選項，用逗號分隔" value={fieldOptions} onChange={(e) => setFieldOptions(e.target.value)} />
            )}
            <button className="primary">新增欄位</button>
          </form>
        </section>

        <section>
          <h4>已封存的卡片</h4>
          {archived.length === 0 && <p className="muted small">沒有封存的卡片</p>}
          {archived.map((c) => (
            <div key={c.id} className="row">
              <span>{c.title}</span>
              <span className="spacer" />
              <button className="small" onClick={() => dispatch({ type: 'updateCard', cardId: c.id, patch: { archived: false } })}>
                還原
              </button>
            </div>
          ))}
        </section>

        <section>
          <h4>危險區域</h4>
          <button
            className="danger"
            onClick={() => {
              if (confirm(`確定刪除看板「${board.title}」？此動作無法復原。`)) {
                dispatch({ type: 'deleteBoard', boardId: board.id })
                onDeleted()
              }
            }}
          >
            刪除看板
          </button>
        </section>
      </div>
    </div>
  )
}
