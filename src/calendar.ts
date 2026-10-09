import { useEffect, useRef, useState } from 'react'
import type { AppState, ID } from './types'
import type { Action, CalendarChange } from './store'
import { calendarHash } from './store'
import { supabase, usesSupabase } from './supabase'
import type { SyncStatus } from './sync'

/**
 * Two-way calendar sync through the "calendar" Supabase Edge Function (supabase/functions/calendar).
 *
 * The app sends every card whose dates/title/description/completion changed since it was last written
 * (tracked by `calHash`), plus deletions, and gets back what changed on the calendars since the last
 * sync. It syncs on start, a few seconds after edits, whenever the app comes back to the foreground,
 * and every two minutes while it is open.
 */

export interface CalendarAccount {
  id: string
  provider: 'google' | 'microsoft' | 'icloud'
  label: string
  calendarId: string | null
  calendarName: string | null
  isTarget: boolean
  lastSync: string | null
  lastError: string | null
}

export const PROVIDER_NAMES: Record<CalendarAccount['provider'], string> = {
  google: 'Google 日曆',
  microsoft: 'Outlook',
  icloud: 'iCloud 行事曆',
}

export async function calendarCall<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new Error('沒有連線到雲端')
  const { data, error } = await supabase.functions.invoke('calendar', { body: { action, ...body } })
  if (error) {
    // The function's own error message is in the response body.
    const ctx = (error as { context?: Response }).context
    let msg = error.message
    try {
      const b = ctx ? await ctx.json() : null
      if (b?.error) msg = b.error
    } catch {
      // not JSON
    }
    if (ctx?.status === 404 || /Failed to send a request|not found/i.test(msg)) throw new Error('NOT_DEPLOYED')
    throw new Error(msg)
  }
  return data as T
}

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Taipei'
export const redirectUri = () => location.origin + location.pathname
const STATE_KEY = 'mothership:calendar-oauth'

/** Sends the browser to Google / Microsoft to allow calendar access; they come back to this page. */
export async function startOAuth(provider: 'google' | 'microsoft') {
  const nonce = crypto.getRandomValues(new Uint32Array(2)).join('')
  const state = `cal:${provider}:${nonce}`
  sessionStorage.setItem(STATE_KEY, state)
  const { url } = await calendarCall<{ url: string }>('authUrl', { provider, redirectUri: redirectUri(), state })
  location.assign(url)
}

/** Finishes a Google / Microsoft sign-in when the page loads with ?code=…&state=cal:… */
export async function finishOAuth(): Promise<{ ok: boolean; message: string } | null> {
  const q = new URLSearchParams(location.search)
  const state = q.get('state')
  if (!state?.startsWith('cal:')) return null
  history.replaceState(null, '', location.pathname + location.hash)
  const expected = sessionStorage.getItem(STATE_KEY)
  sessionStorage.removeItem(STATE_KEY)
  if (q.get('error')) return { ok: false, message: '沒有完成授權：' + (q.get('error_description') ?? q.get('error')) }
  if (state !== expected) return { ok: false, message: '授權連結已過期，請再按一次「連接」' }
  const provider = state.split(':')[1]
  try {
    const r = await calendarCall<{ account: CalendarAccount }>('connect', { provider, code: q.get('code'), redirectUri: redirectUri() })
    return { ok: true, message: `已連接 ${PROVIDER_NAMES[r.account.provider]}（${r.account.label}），同步「${r.account.calendarName}」` }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}

const BATCH = 40

interface SyncReply {
  done: ID[]
  changes: CalendarChange[]
  errors: { cardId?: string; accountId?: string; message: string }[]
  accounts: CalendarAccount[]
}

/** Cards to write to (or remove from) the calendar right now. */
export function pendingCalendarWork(state: AppState) {
  const upserts: { cardId: ID; title: string; description: string; startDate: string | null; dueDate: string | null; completed: boolean; time: string | null }[] = []
  const deletes: ID[] = []
  const hashes: Record<ID, string | null> = {}
  for (const c of Object.values(state.cards)) {
    const want = calendarHash(c)
    const have = c.calHash ?? null
    if (want === have) continue
    hashes[c.id] = want
    if (want) upserts.push({ cardId: c.id, title: c.title, description: c.description, startDate: c.startDate, dueDate: c.dueDate, completed: c.completed, time: c.time ?? null })
    else deletes.push(c.id)
  }
  for (const t of state.trash)
    if (t.card.calHash) {
      hashes[t.card.id] = null
      deletes.push(t.card.id)
    }
  return { upserts, deletes, hashes }
}

export const CALENDAR_EVENT = 'mothership:calendar-changed'

export function useCalendarSync(userId: string | undefined, status: SyncStatus, state: AppState, dispatch: (a: Action) => void) {
  const ready = !!userId && usesSupabase() && (status === 'synced' || status === 'saving')
  const [accounts, setAccounts] = useState<CalendarAccount[] | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null)
  const stateRef = useRef(state)
  const dispatchRef = useRef(dispatch)
  useEffect(() => {
    stateRef.current = state
    dispatchRef.current = dispatch
  }, [state, dispatch])
  const running = useRef(false)
  const again = useRef(false)
  const connected = useRef(false)

  const run = useRef(async () => {})
  const hasAccounts = !!accounts && accounts.length > 0
  useEffect(() => {
    connected.current = hasAccounts
  }, [hasAccounts])
  const sync = async () => {
    if (!ready || !connected.current) return
    if (running.current) return void (again.current = true)
    running.current = true
    try {
      do {
        again.current = false
        const work = pendingCalendarWork(stateRef.current)
        const upserts = work.upserts.slice(0, BATCH)
        const deletes = work.deletes.slice(0, BATCH)
        const r = await calendarCall<SyncReply>('sync', { tz: tz(), upserts, deletes })
        const sent = [...upserts.map((u) => u.cardId), ...deletes]
        const hashes = Object.fromEntries(r.done.filter((id) => sent.includes(id)).map((id) => [id, work.hashes[id]]))
        if (Object.keys(hashes).length) dispatchRef.current({ type: 'calendarSynced', hashes })
        if (r.changes.length) dispatchRef.current({ type: 'calendarApply', changes: r.changes })
        setAccounts(r.accounts)
        setError(r.errors.length ? r.errors[0].message : '')
        if (work.upserts.length > BATCH || work.deletes.length > BATCH) again.current = true
        // Let the dispatches above land before looking for more work.
        if (again.current) await new Promise((res) => setTimeout(res, 50))
      } while (again.current)
    } catch (e) {
      setError((e as Error).message === 'NOT_DEPLOYED' ? '' : (e as Error).message)
    } finally {
      running.current = false
    }
  }
  useEffect(() => {
    run.current = sync
  })

  // Accounts, and any sign-in that just came back from Google / Microsoft.
  useEffect(() => {
    if (!ready) return
    let alive = true
    const load = async () => {
      try {
        const result = await finishOAuth()
        if (result && alive) setNotice(result)
        const r = await calendarCall<{ accounts: CalendarAccount[] }>('status')
        if (!alive) return
        setAccounts(r.accounts)
        connected.current = r.accounts.length > 0
        void run.current()
      } catch (e) {
        if (alive) setAccounts([])
        if ((e as Error).message !== 'NOT_DEPLOYED' && alive) setError((e as Error).message)
      }
    }
    void load()
    const onChanged = () => void load()
    window.addEventListener(CALENDAR_EVENT, onChanged)
    return () => {
      alive = false
      window.removeEventListener(CALENDAR_EVENT, onChanged)
    }
  }, [ready])

  // Foreground and every two minutes.
  useEffect(() => {
    if (!ready) return
    const tick = () => document.visibilityState === 'visible' && void run.current()
    document.addEventListener('visibilitychange', tick)
    const timer = setInterval(tick, 120_000)
    return () => {
      document.removeEventListener('visibilitychange', tick)
      clearInterval(timer)
    }
  }, [ready])

  // A few seconds after card edits that affect the calendar.
  const pending = ready && hasAccounts ? pendingCalendarWork(state) : null
  const pendingKey = pending ? JSON.stringify(pending.hashes) : ''
  useEffect(() => {
    if (!pendingKey || pendingKey === '{}') return
    const t = setTimeout(() => void run.current(), 3000)
    return () => clearTimeout(t)
  }, [pendingKey])

  return { accounts, error, notice, clearNotice: () => setNotice(null), syncNow: () => void run.current() }
}
