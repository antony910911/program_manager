import { useEffect, useState } from 'react'
import { RotateCcw, Trash2, X } from 'lucide-react'
import type { AppState } from '../types'
import type { Action } from '../store'
import { TRASH_DAYS } from '../store'
import { ConfirmButton } from './controls'

/** Deleted cards, kept for TRASH_DAYS days; each can be restored or deleted for good. */
export function TrashModal({ state, dispatch, onClose }: { state: AppState; dispatch: (a: Action) => void; onClose: () => void }) {
  const [now] = useState(() => Date.now())
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const items = [...state.trash].sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1))

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal narrow trash" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close icon-btn" onClick={onClose} aria-label="關閉">
          <X size={18} />
        </button>
        <h3>
          <Trash2 size={18} /> 垃圾桶
        </h3>
        <p className="muted small">
          刪除的卡片（包括刪除清單或看板時一起刪掉的）會在這裡保留 {TRASH_DAYS} 天，之後自動清掉。救回時會回到原本的清單；原本的清單不在了，就放進上方的「待辦」。
        </p>
        {items.length === 0 ? (
          <p className="muted trash-empty">垃圾桶是空的</p>
        ) : (
          <>
            <ul className="trash-list">
              {items.map((t) => {
                const days = Math.floor((now - Date.parse(t.deletedAt)) / 86400000)
                const left = Math.max(1, TRASH_DAYS - days)
                return (
                  <li key={t.card.id}>
                    <div className="trash-info">
                      <strong>{t.card.title}</strong>
                      <span className="muted small">
                        {[t.boardTitle, t.listTitle].filter(Boolean).join(' · ')} · {days === 0 ? '今天' : `${days} 天前`}刪除 · 剩 {left} 天
                      </span>
                    </div>
                    <button className="btn small primary" onClick={() => dispatch({ type: 'restoreTrash', cardId: t.card.id })}>
                      <RotateCcw size={13} /> 救回
                    </button>
                    <ConfirmButton
                      className="btn small"
                      confirmText="確定永久刪除"
                      onConfirm={() => dispatch({ type: 'purgeTrash', cardId: t.card.id })}
                    >
                      永久刪除
                    </ConfirmButton>
                  </li>
                )
              })}
            </ul>
            <ConfirmButton
              className="btn danger wide"
              confirmText={`再按一次：永久刪除這 ${items.length} 張卡片`}
              onConfirm={() => dispatch({ type: 'purgeTrash' })}
            >
              <Trash2 size={14} /> 清空垃圾桶
            </ConfirmButton>
          </>
        )}
      </div>
    </div>
  )
}
