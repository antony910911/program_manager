import { useState } from 'react'
import type { AppState, Card, Filter, ID } from './types'
import type { Action } from './store'
import { matchesFilter } from './store'

export type Drag = { kind: 'card'; id: ID } | { kind: 'list'; id: ID } | null
export interface DropTarget {
  listId: ID
  index: number
}

/** Drag state shared by every list on screen, so cards and lists can move between sections. */
export function useDnd() {
  const [drag, setDrag] = useState<Drag>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const endDrag = () => {
    setDrag(null)
    setDropTarget(null)
  }
  return { drag, setDrag, dropTarget, setDropTarget, endDrag }
}
export type Dnd = ReturnType<typeof useDnd>

export function visibleCards(state: AppState, listId: ID, filter: Filter): Card[] {
  return state.lists[listId].cardIds.map((id) => state.cards[id]).filter((c) => !c.archived && matchesFilter(c, filter))
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
}
