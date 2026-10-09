import { useEffect, useState } from 'react'
import { Copy, Link2, RefreshCw } from 'lucide-react'
import { connectionCode, loadInboxKey, rotateInboxKey } from '../inbox'
import { ConfirmButton } from './controls'

/** Generates the code that lets Beamup drop todos into the top 待辦 list (self-hosted site only). */
export function BeamupConnect({ userId }: { userId: string }) {
  const [secret, setSecret] = useState<string | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing-sql' | 'error'>('loading')
  const [note, setNote] = useState('')

  useEffect(() => {
    let alive = true
    loadInboxKey(userId)
      .then((k) => alive && (setSecret(k), setState('ready')))
      .catch((e: { code?: string; message?: string }) => {
        if (!alive) return
        // 42P01 / PGRST205: table missing, i.e. supabase/inbox.sql has not been run yet.
        setState(e?.code === '42P01' || e?.code === 'PGRST205' ? 'missing-sql' : 'error')
        setNote(e?.message ?? '')
      })
    return () => {
      alive = false
    }
  }, [userId])

  const create = async () => {
    try {
      setSecret(await rotateInboxKey(userId))
      setNote('')
    } catch (e) {
      setNote((e as { message?: string }).message ?? '建立失敗')
    }
  }

  const code = secret ? connectionCode(secret) : ''
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setNote('已複製。到 Beamup 的「設定 › 待辦事項 → 專案管理工具」貼上。')
    } catch {
      setNote('無法自動複製，請全選下面的文字後手動複製。')
    }
  }

  return (
    <section>
      <h4>
        <Link2 size={15} /> 連接 Beamup
      </h4>
      <p className="muted small">
        在 Beamup 新增的待辦，會自動變成上方「待辦」清單的卡片（高優先放進「急件」）。在 Beamup 修改或勾選完成也會同步過來。
      </p>
      {state === 'loading' && <p className="muted small">讀取中…</p>}
      {state === 'missing-sql' && (
        <p className="error-text">還差一步：到 Supabase 的 SQL Editor 執行 repo 裡的 supabase/inbox.sql，再重新打開這個面板。</p>
      )}
      {state === 'error' && <p className="error-text">讀不到連接設定：{note}</p>}
      {state === 'ready' && !secret && (
        <button className="btn primary" onClick={() => void create()}>
          <Link2 size={14} /> 產生連接碼
        </button>
      )}
      {state === 'ready' && secret && (
        <>
          <textarea className="mono" rows={3} readOnly value={code} onFocus={(e) => e.target.select()} />
          <div className="row">
            <button className="btn primary" onClick={() => void copy()}>
              <Copy size={14} /> 複製連接碼
            </button>
            <ConfirmButton className="btn" confirmText="再按一次：舊的連接碼會失效" onConfirm={() => void create()}>
              <RefreshCw size={14} /> 換一組
            </ConfirmButton>
          </div>
        </>
      )}
      {state === 'ready' && note && <p className="ok-text">{note}</p>}
    </section>
  )
}
