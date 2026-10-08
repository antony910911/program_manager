import type { AppState, Board, Filter, ID } from '../types'
import type { Action } from '../store'
import { AddListColumn, ListColumn } from '../components/ListColumn'
import { useDnd } from '../dnd'

interface Props {
  state: AppState
  board: Board
  filter: Filter
  dispatch: (a: Action) => void
  openCard: (id: ID) => void
}

export function BoardView({ state, board, filter, dispatch, openCard }: Props) {
  const dnd = useDnd()
  return (
    <div className="board-canvas">
      {board.listIds.map((listId, listIndex) => (
        <ListColumn
          key={listId}
          state={state}
          list={state.lists[listId]}
          boardId={board.id}
          filter={filter}
          dnd={dnd}
          dispatch={dispatch}
          openCard={openCard}
          onDropList={(id) => dispatch({ type: 'moveList', listId: id, toBoardId: board.id, toIndex: listIndex })}
        />
      ))}
      <AddListColumn
        dnd={dnd}
        onAdd={(title) => dispatch({ type: 'addList', boardId: board.id, title })}
        onDropList={(id) => dispatch({ type: 'moveList', listId: id, toBoardId: board.id, toIndex: Infinity })}
      />
    </div>
  )
}
