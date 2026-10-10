import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppState, Card, Filter, ID } from './types'
import type { Action } from './store'
import { matchesFilter } from './store'

/** `height` is the dragged card's height, so its placeholder takes exactly its room. */
export type Drag = { kind: 'card'; id: ID; height?: number } | { kind: 'list'; id: ID } | null
export interface DropTarget {
  listId: ID
  /** Card slot in the list's visible cards; -1 when a list is dragged over this list. */
  index: number
}

/** Drag state shared by every list on screen, so cards and lists can move between sections. */
export function useDnd() {
  const [drag, setDrag] = useState<Drag>(null)
  const [dropTarget, setTarget] = useState<DropTarget | null>(null)
  const [landed, setLanded] = useState<ID | null>(null)
  const current = useRef<DropTarget | null>(null)
  // dragover fires many times a second; only re-render when the slot actually changes.
  const setDropTarget = useCallback((t: DropTarget | null) => {
    const c = current.current
    if (c === t || (c && t && c.listId === t.listId && c.index === t.index)) return
    current.current = t
    setTarget(t)
  }, [])
  const endDrag = useCallback(() => {
    setDrag(null)
    current.current = null
    setTarget(null)
  }, [])
  useEffect(() => {
    if (!landed) return
    const t = setTimeout(() => setLanded(null), 450)
    return () => clearTimeout(t)
  }, [landed])
  return { drag, setDrag, dropTarget, setDropTarget, endDrag, landed, setLanded }
}
export type Dnd = ReturnType<typeof useDnd>

/** Open cards shown in a list; done cards move to the list's collapsed 已完成 section. */
export function visibleCards(state: AppState, listId: ID, filter: Filter): Card[] {
  return state.lists[listId].cardIds
    .map((id) => state.cards[id])
    .filter((c) => !c.archived && !c.completed && matchesFilter(c, filter))
}

export function doneCards(state: AppState, listId: ID, filter: Filter): Card[] {
  return state.lists[listId].cardIds
    .map((id) => state.cards[id])
    .filter((c) => !c.archived && c.completed && matchesFilter(c, filter))
}

/** Drop the dragged card at the current drop target, mapping the visible index back to the full list. */
export function dropCard(state: AppState, filter: Filter, dnd: Dnd, dispatch: (a: Action) => void) {
  const { drag, dropTarget } = dnd
  if (drag?.kind !== 'card' || !dropTarget) return
  const visible = visibleCards(state, dropTarget.listId, filter).map((c) => c.id)
  let anchor: ID | undefined
  for (let i = dropTarget.index; i < visible.length; i++) {
    if (visible[i] !== drag.id) {
      anchor = visible[i]
      break
    }
  }
  const rest = state.lists[dropTarget.listId].cardIds.filter((c) => c !== drag.id)
  dispatch({ type: 'moveCard', cardId: drag.id, toListId: dropTarget.listId, toIndex: anchor ? rest.indexOf(anchor) : Infinity })
  dnd.setLanded(drag.id)
}

/**
 * While anything is dragged, scrolls the scrollable areas under the pointer (the board, a list's
 * cards, split mode's rows) when the pointer nears their edges, faster the closer it gets. Runs on
 * animation frames so it stays smooth even when dragover events come in slowly (touch polyfill).
 */
export function installDragAutoScroll() {
  const MAX = 16
  let x = 0
  let y = 0
  let raf = 0
  // Narrower on phones, where a wide zone would scroll away whenever a card nears the next list.
  const edge = () => Math.min(64, Math.max(32, window.innerWidth * 0.1))
  const speed = (dist: number) => {
    const e = edge()
    return dist < e ? Math.ceil(((e - Math.max(dist, 0)) / e) ** 2 * MAX) : 0
  }
  const tick = () => {
    let el = document.elementFromPoint(x, y) as HTMLElement | null
    let doneX = false
    let doneY = false
    for (; el && el !== document.body && !(doneX && doneY); el = el.parentElement) {
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      if (!doneX && el.scrollWidth > el.clientWidth + 1 && /auto|scroll/.test(cs.overflowX)) {
        const dx = speed(x - r.left) ? -speed(x - r.left) : speed(r.right - x)
        if (dx) el.scrollLeft += dx
        doneX = true
      }
      if (!doneY && el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(cs.overflowY)) {
        const dy = speed(y - r.top) ? -speed(y - r.top) : speed(r.bottom - y)
        if (dy) el.scrollTop += dy
        doneY = true
      }
    }
    raf = requestAnimationFrame(tick)
  }
  const stop = () => {
    cancelAnimationFrame(raf)
    raf = 0
  }
  document.addEventListener('dragover', (e) => {
    x = e.clientX
    y = e.clientY
    if (!raf) raf = requestAnimationFrame(tick)
  })
  document.addEventListener('dragend', stop)
  document.addEventListener('drop', stop)
}
