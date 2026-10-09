import { useEffect, useState } from 'react'
import { CalendarDays, RefreshCw } from 'lucide-react'
import type { CalendarAccount } from '../calendar'
import { CALENDAR_EVENT, PROVIDER_NAMES, calendarCall, startOAuth } from '../calendar'
import { ConfirmButton } from './controls'

interface Props {
  accounts: CalendarAccount[] | null
  error: string
  syncNow: () => void
}

const changed = () => window.dispatchEvent(new Event(CALENDAR_EVENT))

/** 外觀 → 行事曆同步: connect Google / Outlook / iCloud and pick the calendars. */
export function CalendarConnect({ accounts, error, syncNow }: Props) {
  const [config, setConfig] = useState<{ google: boolean; microsoft: boolean } | 'missing' | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [icloudOpen, setIcloudOpen] = useState(false)
  const [appleId, setAppleId] = useState('')
  const [applePw, setApplePw] = useState('')

  useEffect(() => {
    calendarCall<{ google: boolean; microsoft: boolean }>('config')
      .then(setConfig)
      .catch(() => setConfig('missing'))
  }, [])

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setNote('')
    try {
      await fn()
      changed()
    } catch (e) {
      setNote((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h4>
        <CalendarDays size={15} /> 行事曆同步
      </h4>
      <p className="muted small">
        有日期的卡片會變成行事曆上的行程；行事曆上今天起 90 天內的行程也會變成上方「行事曆」清單的卡片。兩邊新增、修改、完成（標題前加 ✓）、刪除都會同步。
      </p>
      {config === 'missing' && (
        <p className="error-text">行事曆同步還沒部署到雲端。照 DEPLOY.md「連接行事曆」的步驟設定好後，這裡就能連接。</p>
      )}
      {config && config !== 'missing' && (
        <>
          {accounts?.map((a) => (
            <AccountRow key={a.id} account={a} busy={busy} act={act} />
          ))}
          <div className="row wrap">
            {config.google && (
              <button className="btn" disabled={busy} onClick={() => void act(() => startOAuth('google'))}>
                連接 Google 日曆
              </button>
            )}
            {config.microsoft && (
              <button className="btn" disabled={busy} onClick={() => void act(() => startOAuth('microsoft'))}>
                連接 Outlook
              </button>
            )}
            <button className="btn" disabled={busy} onClick={() => setIcloudOpen((v) => !v)}>
              連接 iCloud 行事曆
            </button>
          </div>
          {!config.google && !config.microsoft && (
            <p className="muted small">要連接 Google 或 Outlook，先照 DEPLOY.md 把它們的連線資訊設定到 GitHub。</p>
          )}
          {icloudOpen && (
            <form
              className="icloud-form"
              onSubmit={(e) => {
                e.preventDefault()
                void act(async () => {
                  await calendarCall('connect', { provider: 'icloud', username: appleId, password: applePw })
                  setIcloudOpen(false)
                  setApplePw('')
                })
              }}
            >
              <input type="email" autoComplete="username" placeholder="Apple ID（Email）" value={appleId} onChange={(e) => setAppleId(e.target.value)} />
              <input
                type="password"
                autoComplete="off"
                placeholder="App 專用密碼（xxxx-xxxx-xxxx-xxxx）"
                value={applePw}
                onChange={(e) => setApplePw(e.target.value)}
              />
              <p className="muted small">
                Apple ID 要填登入 account.apple.com 時用的那個 Email（有些人是 @icloud.com，不一定是 Gmail）。密碼不是你的 Apple ID 密碼：到 <a href="https://account.apple.com/account/manage" target="_blank" rel="noreferrer">account.apple.com</a> → 登入與安全性 → App 專用密碼，產生一組給 Mothership。之後可以隨時在那裡撤銷。
              </p>
              <button className="btn primary" disabled={busy || !appleId || !applePw}>
                連接
              </button>
            </form>
          )}
          {accounts && accounts.length > 0 && (
            <button className="btn small" disabled={busy} onClick={syncNow}>
              <RefreshCw size={13} /> 立即同步
            </button>
          )}
        </>
      )}
      {(note || error) && <p className="error-text">{note || error}</p>}
    </section>
  )
}

function AccountRow({ account: a, busy, act }: { account: CalendarAccount; busy: boolean; act: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [calendars, setCalendars] = useState<{ id: string; name: string }[] | null>(null)
  const loadCalendars = () => {
    if (calendars) return
    calendarCall<{ calendars: { id: string; name: string }[] }>('calendars', { accountId: a.id })
      .then((r) => setCalendars(r.calendars))
      .catch(() => setCalendars([]))
  }
  const options = calendars ?? (a.calendarId ? [{ id: a.calendarId, name: a.calendarName ?? '行事曆' }] : [])

  return (
    <div className="cal-account">
      <div className="cal-account-head">
        <strong>{PROVIDER_NAMES[a.provider]}</strong>
        <span className="muted small">{a.label}</span>
      </div>
      <label className="cal-field">
        <span className="muted small">同步的行事曆</span>
        <select
          value={a.calendarId ?? ''}
          onFocus={loadCalendars}
          onMouseDown={loadCalendars}
          disabled={busy}
          onChange={(e) => {
            const c = options.find((x) => x.id === e.target.value)
            void act(() => calendarCall('update', { accountId: a.id, calendarId: e.target.value, calendarName: c?.name }))
          }}
        >
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="cal-target">
        <input
          type="radio"
          name="cal-target"
          checked={a.isTarget}
          disabled={busy}
          onChange={() => void act(() => calendarCall('update', { accountId: a.id, isTarget: true }))}
        />
        Mothership 新增的卡片寫到這個行事曆
      </label>
      <div className="cal-account-foot">
        <span className="muted small">
          {a.lastError ? <span className="error-text">{a.lastError}</span> : a.lastSync ? `上次同步 ${new Date(a.lastSync).toLocaleString()}` : '尚未同步'}
        </span>
        <ConfirmButton
          className="btn small"
          confirmText="再按一次：中斷連接（行程和卡片都會留著）"
          onConfirm={() => void act(() => calendarCall('disconnect', { accountId: a.id }))}
        >
          中斷連接
        </ConfirmButton>
      </div>
    </div>
  )
}
