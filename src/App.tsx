import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Archive,
  ChartColumn,
  ChartGantt,
  CalendarDays,
  Cloud,
  CloudAlert,
  CloudOff,
  House,
  RefreshCw,
  Image,
  Palette,
  Plus,
  Rows2,
  Search,
  Settings,
  SquareKanban,
  Table2,
  Tag,
  Trash2,
  Type,
  X,
} from 'lucide-react'
import type { Board, BoardBackground, Filter, ID, ViewKind } from './types'
import { BOARD_TEMPLATES, LABEL_COLORS, cardBoard, emptyFilter, useAppStore } from './store'
import type { Action } from './store'
import { BACKGROUND_PRESETS, backgroundCss, defaultBackground, themeVars } from './theme'
import { Avatar, InlineEdit } from './components/common'
import { CardModal } from './components/CardModal'
import { AppearancePanel } from './components/AppearancePanel'
import { BackgroundEditor } from './components/BackgroundEditor'
import { AlienHero } from './components/AlienHero'
import { cheer } from './alien'
import { ConfirmButton } from './components/controls'
import { BoardView } from './views/BoardView'
import { TableView } from './views/TableView'
import { CalendarView } from './views/CalendarView'
import { TimelineView } from './views/TimelineView'
import { DashboardView } from './views/DashboardView'
import { SplitView } from './views/SplitView'
import { useCloudSync } from './sync'
import type { SyncStatus } from './sync'

const VIEWS: { kind: ViewKind; name: string; icon: ReactNode }[] = [
  { kind: 'board', name: '看板', icon: <SquareKanban size={15} /> },
  { kind: 'table', name: '表格', icon: <Table2 size={15} /> },
  { kind: 'calendar', name: '行事曆', icon: <CalendarDays size={15} /> },
  { kind: 'timeline', name: '時間軸', icon: <ChartGantt size={15} /> },
  { kind: 'dashboard', name: '儀表板', icon: <ChartColumn size={15} /> },
]

export default function App() {
  const [state, dispatch] = useAppStore()
  const sync = useCloudSync(state, dispatch)

  // Daily visit for the alien, and a celebration for each new reward earned in this session.
  const [startedAt] = useState(() => Date.now())
  useEffect(() => {
    dispatch({ type: 'petVisit' })
  }, [dispatch])
  const lastEvent = state.pet.lastEvent
  useEffect(() => {
    if (lastEvent && lastEvent.at >= startedAt) cheer(lastEvent.text)
  }, [lastEvent, startedAt])
  const [boardId, setBoardIdRaw] = useState<ID | null>(null)
  const [view, setView] = useState<ViewKind>('board')
  const [filter, setFilter] = useState<Filter>(emptyFilter)
  // Label ids are per board, so a filter never carries over to another board.
  const setBoardId = (id: ID | null) => {
    setBoardIdRaw(id)
    setFilter(emptyFilter)
  }
  const [openCardId, setOpenCardId] = useState<ID | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const [bgOpen, setBgOpen] = useState(false)
  const bgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!bgOpen) return
    const close = (e: MouseEvent) => {
      if (!bgRef.current?.contains(e.target as Node)) setBgOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [bgOpen])

  // Theme mode lives on <html> so native controls and scrollbars follow it too.
  useEffect(() => {
    const root = document.documentElement
    if (state.theme.mode === 'system') delete root.dataset.theme
    else root.dataset.theme = state.theme.mode
    for (const [k, v] of Object.entries(themeVars(state.theme))) root.style.setProperty(k, v)
    root.dataset.cardStyle = state.theme.cardStyle
    root.dataset.labelStyle = state.theme.labelStyle
  }, [state.theme])

  const board = boardId ? state.boards[boardId] : undefined
  const isSplit = !!board && board.id === state.focusBoardId
  const openCard = openCardId ? state.cards[openCardId] : undefined
  const me = state.members.find((m) => m.id === state.currentMemberId)

  return (
    <div
      className={(board ? 'app on-board' : 'app') + (isSplit ? ' split-mode' : '')}
      style={board ? { background: backgroundCss(board.background) } : undefined}
    >
      <header className="topbar">
        <button className="brand" onClick={() => setBoardId(null)}>
          <span className="brand-mark">
            <SquareKanban size={16} />
          </span>
          <span className="brand-text">Program Manager</span>
        </button>
        {board && (
          <>
            <button className="icon-btn" title="所有看板" onClick={() => setBoardId(null)}>
              <House size={17} />
            </button>
            <select className="board-switch" value={board.id} onChange={(e) => setBoardId(e.target.value)}>
              <option value={state.focusBoardId}>⬒ 雙層模式</option>
              {state.boardOrder.map((id) => (
                <option key={id} value={id}>
                  {state.boards[id].title}
                </option>
              ))}
            </select>
          </>
        )}
        <span className="spacer" />
        {!isSplit && (
          <button className="top-btn" onClick={() => setBoardId(state.focusBoardId)}>
            <Rows2 size={16} /> <span className="btn-label">雙層模式</span>
          </button>
        )}
        <button className="top-btn" onClick={() => setAppearanceOpen(true)}>
          <Palette size={16} /> <span className="btn-label">外觀</span>
        </button>
        <SyncBadge status={sync.status} error={sync.error} />
        {me && <Avatar member={me} size={30} />}
      </header>

      {!board ? (
        <Home state={state} dispatch={dispatch} onOpen={(id) => setBoardId(id)} synced={sync.status !== 'local'} />
      ) : (
        <main className="board-page">
          <div className="board-bar">
            {isSplit ? (
              <>
                <span className="board-title static">
                  <Rows2 size={18} /> 雙層模式
                </span>
                <span className="split-hint">上方與下方的清單都能改名、新增、刪除，卡片與清單可上下互相拖曳</span>
              </>
            ) : (
              <>
                <InlineEdit
                  className="board-title"
                  value={board.title}
                  onSave={(title) => dispatch({ type: 'renameBoard', boardId: board.id, title })}
                />
                <nav className="tabs">
                  {VIEWS.map((v) => (
                    <button key={v.kind} className={view === v.kind ? 'tab active' : 'tab'} onClick={() => setView(v.kind)}>
                      {v.icon}
                      <span>{v.name}</span>
                    </button>
                  ))}
                </nav>
              </>
            )}
            <span className="spacer" />
            <div className="popover-anchor" ref={bgRef}>
              <button className="glass-btn" onClick={() => setBgOpen((o) => !o)}>
                <Image size={15} /> 背景
              </button>
              {bgOpen && (
                <div className="popover">
                  <div className="popover-head">
                    <strong>{isSplit ? '雙層模式背景' : '看板背景'}</strong>
                    <button className="icon-btn" onClick={() => setBgOpen(false)}>
                      <X size={16} />
                    </button>
                  </div>
                  <BackgroundEditor
                    value={board.background}
                    onChange={(patch) => dispatch({ type: 'setBoardBackground', boardId: board.id, patch })}
                  />
                </div>
              )}
            </div>
            <button className="glass-btn" onClick={() => setSettingsOpen(true)}>
              <Settings size={15} /> 設定
            </button>
          </div>
          <FilterBar board={isSplit ? undefined : board} members={state.members} filter={filter} setFilter={setFilter} />

          {isSplit ? (
            <SplitView state={state} filter={filter} dispatch={dispatch} openCard={setOpenCardId} openBoard={(id) => setBoardId(id)} />
          ) : (
            <>
              {view === 'board' && <BoardView state={state} board={board} filter={filter} dispatch={dispatch} openCard={setOpenCardId} />}
              {view === 'table' && <TableView state={state} board={board} filter={filter} openCard={setOpenCardId} />}
              {view === 'calendar' && (
                <CalendarView state={state} board={board} filter={filter} dispatch={dispatch} openCard={setOpenCardId} />
              )}
              {view === 'timeline' && <TimelineView state={state} board={board} filter={filter} openCard={setOpenCardId} />}
              {view === 'dashboard' && <DashboardView state={state} board={board} filter={filter} />}
            </>
          )}
        </main>
      )}

      {board && openCard && (
        <CardModal
          key={openCard.id}
          state={state}
          board={cardBoard(state, openCard)}
          card={openCard}
          dispatch={dispatch}
          onClose={() => setOpenCardId(null)}
        />
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
      {appearanceOpen && <AppearancePanel state={state} dispatch={dispatch} onClose={() => setAppearanceOpen(false)} />}
    </div>
  )
}

function Home({
  state,
  dispatch,
  onOpen,
  synced,
}: {
  state: ReturnType<typeof useAppStore>[0]
  dispatch: (a: Action) => void
  onOpen: (id: ID) => void
  synced: boolean
}) {
  const [title, setTitle] = useState('')
  const [template, setTemplate] = useState(0)
  const [nextYear] = useState(() => new Date().getFullYear() + 1)
  const [bg, setBg] = useState<BoardBackground>({ ...defaultBackground('#000'), ...BACKGROUND_PRESETS[0].bg })
  const [greeting] = useState(() => {
    const hour = new Date().getHours()
    return hour < 12 ? '早安' : hour < 18 ? '午安' : '晚安'
  })
  return (
    <main className="home">
      <AlienHero state={state} dispatch={dispatch} greeting={greeting} />
      <button className="split-entry" onClick={() => onOpen(state.focusBoardId)}>
        <span className="split-entry-icon">
          <Rows2 size={22} />
        </span>
        <span>
          <strong>雙層模式</strong>
          <span className="muted">
            上方放你最常看的清單（預設待辦 / 進行中 / 急件），下方列出每個看板的所有清單，卡片可以上下互相拖曳。
          </span>
        </span>
        <span className="split-entry-count">
          {state.boards[state.focusBoardId].listIds.reduce(
            (n, l) => n + state.lists[l].cardIds.filter((c) => !state.cards[c].archived).length,
            0,
          )}{' '}
          張焦點卡片
        </span>
      </button>
      <h2 className="section-title">你的看板</h2>
      <div className="board-grid">
        {state.boardOrder.map((id) => {
          const b = state.boards[id]
          const cardIds = b.listIds.flatMap((l) => state.lists[l].cardIds)
          const done = cardIds.filter((c) => state.cards[c].completed).length
          return (
            <button key={id} className="board-tile" style={{ background: backgroundCss(b.background) }} onClick={() => onOpen(id)}>
              <strong>{b.title}</strong>
              <span className="board-tile-meta">
                {b.listIds.length} 個清單 · {cardIds.length} 張卡片
              </span>
              <span className="board-tile-progress">
                <span style={{ width: `${cardIds.length ? (done / cardIds.length) * 100 : 0}%` }} />
              </span>
            </button>
          )
        })}
        <form
          className="board-tile new"
          onSubmit={(e) => {
            e.preventDefault()
            if (!title.trim()) return
            dispatch({ type: 'addBoard', title: title.trim(), background: bg, lists: BOARD_TEMPLATES[template].lists })
            setTitle('')
          }}
        >
          <span className="new-preview" style={{ background: backgroundCss(bg) }} />
          <input placeholder={`新看板名稱，例：${nextYear} 年度專案`} value={title} onChange={(e) => setTitle(e.target.value)} />
          <select value={template} onChange={(e) => setTemplate(Number(e.target.value))} title="初始清單">
            {BOARD_TEMPLATES.map((t, i) => (
              <option key={t.name} value={i}>
                {t.name}
              </option>
            ))}
          </select>
          <div className="bg-presets small">
            {BACKGROUND_PRESETS.map((p) => {
              const next = { ...defaultBackground('#000'), ...p.bg }
              return (
                <button
                  type="button"
                  key={p.name}
                  title={p.name}
                  className={next.color === bg.color && next.color2 === bg.color2 ? 'bg-preset on' : 'bg-preset'}
                  style={{ background: backgroundCss(next) }}
                  onClick={() => setBg(next)}
                />
              )
            })}
          </div>
          <button className="btn primary">
            <Plus size={15} /> 建立看板
          </button>
        </form>
      </div>
      <p className="muted small home-foot">
        {synced ? '資料會同步到你的 claude.ai 帳號，登入同一個帳號的手機、電腦、iPad 都看得到。' : '資料只存在這個瀏覽器裡。'}
        <ConfirmButton
          className="link-btn"
          confirmText="再按一次：清除所有資料並還原範例（外觀會保留）"
          onConfirm={() => dispatch({ type: 'reset' })}
        >
          重設範例資料
        </ConfirmButton>
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
  board?: Board
  members: ReturnType<typeof useAppStore>[0]['members']
  filter: Filter
  setFilter: (f: Filter) => void
}) {
  const toggle = (arr: ID[], v: ID) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
  const active = filter.text || filter.labelIds.length || filter.memberIds.length || filter.due !== 'all'
  return (
    <div className="filter-bar">
      <label className="search">
        <Search size={15} />
        <input placeholder="搜尋卡片…" value={filter.text} onChange={(e) => setFilter({ ...filter, text: e.target.value })} />
      </label>
      <div className="chips">
        {(board?.labels ?? []).map((l) => (
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
      <select className="glass-select" value={filter.due} onChange={(e) => setFilter({ ...filter, due: e.target.value as Filter['due'] })}>
        <option value="all">所有日期</option>
        <option value="overdue">已逾期</option>
        <option value="week">7 天內到期</option>
        <option value="none">沒有到期日</option>
      </select>
      {active ? (
        <button className="glass-btn" onClick={() => setFilter(emptyFilter)}>
          <X size={14} /> 清除篩選
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
  const isFocus = board.id === state.focusBoardId
  const archived = Object.values(state.cards).filter(
    (c) => c.archived && (board.listIds.includes(c.listId) || (!isFocus && c.homeBoardId === board.id)),
  )
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal narrow" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close icon-btn" onClick={onClose}>
          <X size={18} />
        </button>
        <h3>{isFocus ? '雙層模式設定' : '看板設定'}</h3>

        <section>
          <h4>
            <Image size={15} /> 背景
          </h4>
          <BackgroundEditor
            value={board.background}
            onChange={(patch) => dispatch({ type: 'setBoardBackground', boardId: board.id, patch })}
          />
        </section>

        <section>
          <h4>
            <Tag size={15} /> 標籤
          </h4>
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
              <button className="icon-btn" onClick={() => dispatch({ type: 'deleteLabel', boardId: board.id, labelId: l.id })}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button
            className="btn"
            onClick={() =>
              dispatch({
                type: 'upsertLabel',
                boardId: board.id,
                label: { name: '', color: LABEL_COLORS[board.labels.length % LABEL_COLORS.length] },
              })
            }
          >
            <Plus size={14} /> 新增標籤
          </button>
        </section>

        <section>
          <h4>
            <Type size={15} /> 自訂欄位
          </h4>
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
              <button className="icon-btn" onClick={() => dispatch({ type: 'deleteCustomField', boardId: board.id, fieldId: f.id })}>
                <Trash2 size={15} />
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
            <button className="btn primary">新增欄位</button>
          </form>
        </section>

        <section>
          <h4>
            <Archive size={15} /> 已封存的卡片
          </h4>
          {archived.length === 0 && <p className="muted small">沒有封存的卡片</p>}
          {archived.map((c) => (
            <div key={c.id} className="row">
              <span>{c.title}</span>
              <span className="spacer" />
              <button className="btn small" onClick={() => dispatch({ type: 'updateCard', cardId: c.id, patch: { archived: false } })}>
                還原
              </button>
            </div>
          ))}
        </section>

        {isFocus ? (
          <p className="muted small">上方清單用的標籤與自訂欄位設定在這裡；從下方看板拖上來的卡片仍沿用原看板的標籤。</p>
        ) : (
          <section>
            <h4>危險區域</h4>
            <ConfirmButton
              className="btn danger"
              confirmText={`再按一次刪除「${board.title}」（無法復原）`}
              onConfirm={() => {
                dispatch({ type: 'deleteBoard', boardId: board.id })
                onDeleted()
              }}
            >
              刪除看板
            </ConfirmButton>
          </section>
        )}
      </div>
    </div>
  )
}

const SYNC_LABELS: Record<SyncStatus, string> = {
  local: '只存在這台裝置',
  connecting: '連線到雲端…',
  synced: '已同步',
  saving: '同步中…',
  error: '同步發生問題',
}

function SyncBadge({ status, error }: { status: SyncStatus; error: string }) {
  const icon =
    status === 'synced' ? (
      <Cloud size={16} />
    ) : status === 'error' ? (
      <CloudAlert size={16} />
    ) : status === 'local' ? (
      <CloudOff size={16} />
    ) : (
      <RefreshCw size={15} className="spin" />
    )
  return (
    <span className={'sync-badge ' + status} title={error || SYNC_LABELS[status]} role="status">
      {icon}
      <span className="btn-label">{SYNC_LABELS[status]}</span>
    </span>
  )
}
