import { useState } from 'react'
import { Copy, Upload } from 'lucide-react'
import type { AppState } from '../types'
import type { Action } from '../store'
import { ConfirmButton } from './controls'

/** Back up everything as JSON, or restore a backup — also how data moves from claude.ai to the self-hosted site. */
export function DataTransfer({ state, dispatch }: { state: AppState; dispatch: (a: Action) => void }) {
  const [text, setText] = useState('')
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const copy = async () => {
    const json = JSON.stringify(state)
    setText(json)
    try {
      await navigator.clipboard.writeText(json)
      setNote({ kind: 'ok', text: '已複製全部資料。到另一個地方打開這個面板，貼上後按「匯入」。' })
    } catch {
      setNote({ kind: 'ok', text: '無法自動複製，請全選下面的文字後手動複製。' })
    }
  }

  const parsed = (() => {
    if (!text.trim()) return null
    try {
      const v = JSON.parse(text) as AppState
      return v && typeof v === 'object' && v.boards && v.lists && v.cards && v.focusBoardId ? v : null
    } catch {
      return null
    }
  })()

  return (
    <section>
      <h4>備份與搬家</h4>
      <p className="muted small">複製全部資料（看板、卡片、外觀、外星人），貼到另一個地方匯入，例如從 claude.ai 版搬到自己的網站。</p>
      <div className="row">
        <button className="btn" onClick={() => void copy()}>
          <Copy size={14} /> 複製全部資料
        </button>
      </div>
      <textarea
        id="data-transfer"
        className="mono"
        rows={4}
        placeholder="在這裡貼上備份資料"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setNote(null)
        }}
        onFocus={(e) => e.target.select()}
      />
      {text.trim() && !parsed && text !== JSON.stringify(state) && <div className="error-text">這段文字不是有效的備份資料。</div>}
      {parsed && text !== JSON.stringify(state) && (
        <ConfirmButton
          className="btn danger wide"
          confirmText="再按一次：用這份資料取代目前全部資料"
          onConfirm={() => {
            dispatch({ type: 'hydrate', state: parsed })
            setText('')
            setNote({ kind: 'ok', text: '匯入完成。' })
          }}
        >
          <Upload size={14} /> 匯入（{Object.keys(parsed.cards).length} 張卡片）
        </ConfirmButton>
      )}
      {note && <p className={note.kind === 'ok' ? 'ok-text' : 'error-text'}>{note.text}</p>}
    </section>
  )
}
