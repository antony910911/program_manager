import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, GripHorizontal } from 'lucide-react'
import type { AppState, Filter, ID } from '../types'
import type { Action } from '../store'
import { AddListColumn, ListColumn } from '../components/ListColumn'
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
        {state.boardOrder.length === 0 && (
          <p className="empty-note">還沒有看板。回到首頁建立一個看板（例如「年度專案」），它就會出現在這裡。</p>
        )}
        {state.boardOrder.map((bid) => {
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
      </section>
    </div>
  )
}
