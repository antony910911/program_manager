import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, ChevronDown, ChevronRight, Ellipsis, Eye, EyeOff, ExternalLink, GripHorizontal, X } from 'lucide-react'
import type { AppState, Filter, ID } from '../types'
import type { Action } from '../store'
import { AddListColumn, AnchoredPopover, ListColumn } from '../components/ListColumn'
import { useDnd, visibleCards } from '../dnd'

interface Props {
  state: AppState
  filter: Filter
  dispatch: (a: Action) => void
  openCard: (id: ID) => void
  openBoard: (id: ID) => void
}

const SPLIT_KEY = 'program-manager:split-ratio'
const COLLAPSE_KEY = 'program-manager:split-collapsed'

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // per-viewer convenience only
  }
}

/**
 * Split mode: the focus lists on top (待辦 / 進行中 / 急件 by default, all editable), every board's lists below.
 * One shared drag context, so cards and lists move freely between the two halves.
 */
export function SplitView({ state, filter, dispatch, openCard, openBoard }: Props) {
  const dnd = useDnd()
  const focus = state.boards[state.focusBoardId]
  const [ratio, setRatio] = useState(() => readStored(SPLIT_KEY, 42))
  const [collapsed, setCollapsed] = useState<ID[]>(() => readStored(COLLAPSE_KEY, []))
  const containerRef = useRef<HTMLDivElement>(null)
  const [resizing, setResizing] = useState(false)

  useEffect(() => writeStored(SPLIT_KEY, ratio), [ratio])
  useEffect(() => writeStored(COLLAPSE_KEY, collapsed), [collapsed])

  useEffect(() => {
    if (!resizing) return
    const move = (e: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      setRatio(Math.round(Math.min(75, Math.max(20, ((e.clientY - rect.top) / rect.height) * 100))))
    }
    const up = () => setResizing(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [resizing])

  const shown = state.boardOrder.filter((bid) => !state.boards[bid]?.hiddenInSplit)
  const hidden = state.boardOrder.filter((bid) => state.boards[bid]?.hiddenInSplit)

  const toggle = (id: ID) => setCollapsed((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))

  return (
    <div className={'split' + (resizing ? ' resizing' : '')} ref={containerRef}>
      <section className="split-top" style={{ height: `${ratio}%` }}>
        <div className="split-top-lists">
          {focus.listIds.map((lid, index) => (
            <ListColumn
              key={lid}
              className="focus-list"
              state={state}
              list={state.lists[lid]}
              boardId={focus.id}
              filter={filter}
              dnd={dnd}
              dispatch={dispatch}
              openCard={openCard}
              onDropList={(id) => dispatch({ type: 'moveList', listId: id, toBoardId: focus.id, toIndex: index })}
              showProject
            />
          ))}
          <AddListColumn
            dnd={dnd}
            className="focus-add"
            onAdd={(title) => dispatch({ type: 'addList', boardId: focus.id, title })}
            onDropList={(id) => dispatch({ type: 'moveList', listId: id, toBoardId: focus.id, toIndex: Infinity })}
          />
        </div>
      </section>

      <div className="split-resizer" onPointerDown={() => setResizing(true)} title="拖曳調整上下比例">
        <GripHorizontal size={16} />
      </div>

      {/* Edge scrolling while dragging is global (installDragAutoScroll in dnd.ts). */}
      <section className="split-bottom">
        {shown.length === 0 && hidden.length === 0 && (
          <p className="empty-note">還沒有看板。回到首頁建立一個看板（例如「年度專案」），它就會出現在這裡。</p>
        )}
        {shown.map((bid) => {
          const board = state.boards[bid]
          const isCollapsed = collapsed.includes(bid)
          const count = board.listIds.reduce((n, l) => n + visibleCards(state, l, filter).length, 0)
          return (
            <div key={bid} className={'project-row' + (isCollapsed ? ' collapsed' : '')}>
              <header className="project-head">
                <button className="icon-btn" onClick={() => toggle(bid)} title={isCollapsed ? '展開' : '收合'}>
                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                </button>
                <span className="project-swatch" style={{ background: board.color }} />
                <strong>{board.title}</strong>
                <span className="list-count">{count}</span>
                <span className="muted small">{board.listIds.length} 個清單</span>
                <span className="spacer" />
                <button className="glass-btn small" onClick={() => openBoard(bid)}>
                  <ExternalLink size={13} /> 開啟看板
                </button>
                <ProjectMenu
                  title={board.title}
                  index={state.boardOrder.indexOf(bid)}
                  count={state.boardOrder.length}
                  onMove={(toIndex) => dispatch({ type: 'moveBoard', boardId: bid, toIndex })}
                  onHide={() => dispatch({ type: 'setBoardHiddenInSplit', boardId: bid, hidden: true })}
                />
              </header>
              {!isCollapsed && (
                <div className="project-lists">
                  {board.listIds.map((lid, index) => (
                    <ListColumn
                      key={lid}
                      state={state}
                      list={state.lists[lid]}
                      boardId={bid}
                      filter={filter}
                      dnd={dnd}
                      dispatch={dispatch}
                      openCard={openCard}
                      onDropList={(id) => dispatch({ type: 'moveList', listId: id, toBoardId: bid, toIndex: index })}
                    />
                  ))}
                  <AddListColumn
                    dnd={dnd}
                    onAdd={(title) => dispatch({ type: 'addList', boardId: bid, title })}
                    onDropList={(id) => dispatch({ type: 'moveList', listId: id, toBoardId: bid, toIndex: Infinity })}
                  />
                </div>
              )}
            </div>
          )
        })}
        {hidden.length > 0 && (
          <div className="hidden-projects">
            <EyeOff size={14} />
            <span className="muted small">已隱藏：</span>
            {hidden.map((bid) => (
              <button
                key={bid}
                className="hidden-chip"
                title="在雙層模式顯示"
                onClick={() => dispatch({ type: 'setBoardHiddenInSplit', boardId: bid, hidden: false })}
              >
                <span className="project-swatch" style={{ background: state.boards[bid].color }} />
                {state.boards[bid].title}
                <Eye size={13} />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

/** A project's ⋯ menu below 雙層模式: its place in the order (shared with the home page), or fold it away. */
function ProjectMenu({
  title,
  index,
  count,
  onMove,
  onHide,
}: {
  title: string
  index: number
  count: number
  onMove: (toIndex: number) => void
  onHide: () => void
}) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const act = (fn: () => void) => () => {
    fn()
    setOpen(false)
  }
  return (
    <>
      <button ref={btn} className="icon-btn" title="專案選單" onClick={() => setOpen((o) => !o)}>
        <Ellipsis size={16} />
      </button>
      {open && (
        <AnchoredPopover anchor={btn} onClose={() => setOpen(false)}>
          <div className="popover-head">
            <strong>{title}</strong>
            <button className="icon-btn" aria-label="關閉" onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </div>
          <div className="menu-list">
            <button className="menu-item" disabled={index <= 0} onClick={act(() => onMove(0))}>
              <ArrowUpToLine size={15} /> 移到最上面
            </button>
            <button className="menu-item" disabled={index <= 0} onClick={act(() => onMove(index - 1))}>
              <ArrowUp size={15} /> 上移
            </button>
            <button className="menu-item" disabled={index >= count - 1} onClick={act(() => onMove(index + 1))}>
              <ArrowDown size={15} /> 下移
            </button>
            <button className="menu-item" disabled={index >= count - 1} onClick={act(() => onMove(count - 1))}>
              <ArrowDownToLine size={15} /> 移到最下面
            </button>
          </div>
          <div className="menu-sep" />
          <button className="menu-item" onClick={act(onHide)}>
            <EyeOff size={15} /> 在雙層模式隱藏
          </button>
          <p className="muted small menu-hint">看板和卡片都還在，首頁也看得到；底下可以再顯示回來。順序也會套用到首頁的看板。</p>
        </AnchoredPopover>
      )}
    </>
  )
}
