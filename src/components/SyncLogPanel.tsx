import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
import { SYNC_LOG_EVENT, syncLog } from '../synclog'

/** 設定 › 同步紀錄: what cloud sync did on this device since the app was opened. */
export function SyncLogPanel() {
  const [lines, setLines] = useState(syncLog)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    const update = () => setLines(syncLog())
    window.addEventListener(SYNC_LOG_EVENT, update)
    return () => window.removeEventListener(SYNC_LOG_EVENT, update)
  }, [])
  return (
    <section>
      <p className="muted small">
        這台裝置打開 Mothership 之後，雲端同步做了什麼（最新的在上面）。卡片跑掉時，把這頁截圖或複製給開發者，就能看出是哪一步造成的。
      </p>
      <p className="muted small">版本 {__BUILD__}</p>
      <button
        className="btn small"
        onClick={() => {
          void navigator.clipboard?.writeText([`版本 ${__BUILD__}`, ...lines].join('\n')).then(() => setCopied(true))
        }}
      >
        <Copy size={13} /> {copied ? '已複製' : '複製全部'}
      </button>
      <pre className="sync-log">{lines.length ? lines.join('\n') : '還沒有紀錄'}</pre>
    </section>
  )
}
