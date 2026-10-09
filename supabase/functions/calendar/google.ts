// Google Calendar (REST API v3) behind the Provider interface.

import type { CalEvent, Draft } from './events.ts'
import { wallToUtc } from './events.ts'
import type { Provider } from './sync.ts'

const API = 'https://www.googleapis.com/calendar/v3'

export interface GoogleConfig {
  clientId: string
  clientSecret: string
}

export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar'

export function googleAuthUrl(cfg: { clientId: string }, redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + q
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error('Google 登入失敗：' + (json.error_description || json.error || res.status))
  return json as { access_token: string; refresh_token?: string; expires_in: number }
}

/** Exchanges the code from the consent screen for a refresh token. */
export async function googleExchange(cfg: GoogleConfig, code: string, redirectUri: string) {
  const t = await tokenRequest({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })
  if (!t.refresh_token) throw new Error('Google 沒有給離線權限，請到 Google 帳戶的「第三方存取權」移除 Mothership 後再連接一次')
  const me = await fetch(API + '/calendars/primary', { headers: { Authorization: 'Bearer ' + t.access_token } }).then((r) => r.json())
  return { refreshToken: t.refresh_token, label: (me.id as string) || 'Google' }
}

/** Google event ids are base32hex; derive one from the card id so retried creates can't duplicate. */
export const googleEventId = (cardId: string) =>
  'ms' + Array.from(new TextEncoder().encode(cardId), (b) => b.toString(16).padStart(2, '0')).join('')

interface GEvent {
  id: string
  status?: string
  summary?: string
  description?: string
  start?: { date?: string; dateTime?: string }
  end?: { date?: string; dateTime?: string }
  recurringEventId?: string
}

function fromGoogle(e: GEvent): CalEvent | null {
  if (e.status === 'cancelled' || !e.start || !e.end) return null
  const allDay = !!e.start.date
  return {
    id: e.id,
    title: e.summary ?? '(無標題)',
    description: e.description ?? '',
    allDay,
    start: allDay ? e.start.date! : new Date(e.start.dateTime!).toISOString(),
    end: allDay ? e.end.date! : new Date(e.end.dateTime!).toISOString(),
    recurring: !!e.recurringEventId,
  }
}

function toGoogle(d: Draft) {
  return {
    // Also revives an event deleted earlier with the same id (Google keeps ids of deleted events).
    status: 'confirmed',
    summary: d.title,
    description: d.description,
    start: d.allDay ? { date: d.start, dateTime: null } : { dateTime: d.start, date: null },
    end: d.allDay ? { date: d.end, dateTime: null } : { dateTime: d.end, date: null },
  }
}

export function googleProvider(cfg: GoogleConfig, refreshToken: string): Provider & { calendars(): Promise<{ id: string; name: string }[]> } {
  let token: { value: string; until: number } | null = null
  const call = async (path: string, init: RequestInit = {}): Promise<Response> => {
    if (!token || token.until < Date.now()) {
      const t = await tokenRequest({ client_id: cfg.clientId, client_secret: cfg.clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' })
      token = { value: t.access_token, until: Date.now() + (t.expires_in - 60) * 1000 }
    }
    return fetch(API + path, {
      ...init,
      headers: { Authorization: 'Bearer ' + token.value, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    })
  }
  const ok = async (res: Response) => {
    if (res.ok) return res
    const body = await res.text()
    throw new Error(`Google 行事曆回應 ${res.status}：${body.slice(0, 200)}`)
  }
  const cal = (id: string) => '/calendars/' + encodeURIComponent(id)

  return {
    async calendars() {
      const res = await ok(await call('/users/me/calendarList?minAccessRole=writer'))
      const json = await res.json()
      return (json.items as { id: string; summary: string; primary?: boolean }[]).map((c) => ({ id: c.id, name: c.primary ? `${c.summary}（主要）` : c.summary }))
    },
    async list(calendarId, from, to, tz) {
      const out: CalEvent[] = []
      let page: string | undefined
      do {
        const q = new URLSearchParams({
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: '2500',
          timeMin: wallToUtc(from + 'T00:00:00', tz),
          timeMax: wallToUtc(to + 'T23:59:59', tz),
        })
        if (page) q.set('pageToken', page)
        const json = await (await ok(await call(cal(calendarId) + '/events?' + q))).json()
        for (const e of json.items as GEvent[]) {
          const ev = fromGoogle(e)
          if (ev) out.push(ev)
        }
        page = json.nextPageToken
      } while (page)
      return out
    },
    async get(calendarId, eventId) {
      const res = await call(cal(calendarId) + '/events/' + encodeURIComponent(eventId))
      if (res.status === 404 || res.status === 410) return null
      return fromGoogle(await (await ok(res)).json())
    },
    async create(calendarId, draft, _tz, cardId) {
      const id = googleEventId(cardId)
      const res = await call(cal(calendarId) + '/events', { method: 'POST', body: JSON.stringify({ id, ...toGoogle(draft) }) })
      if (res.status === 409) {
        // Already created by another device (or an earlier, interrupted attempt): update it instead.
        const ev = await this.update(calendarId, id, draft, _tz)
        if (ev) return ev
      }
      return fromGoogle(await (await ok(res)).json())!
    },
    async update(calendarId, eventId, draft) {
      const res = await call(cal(calendarId) + '/events/' + encodeURIComponent(eventId), { method: 'PATCH', body: JSON.stringify(toGoogle(draft)) })
      if (res.status === 404 || res.status === 410) return null
      return fromGoogle(await (await ok(res)).json())
    },
    async remove(calendarId, eventId) {
      const res = await call(cal(calendarId) + '/events/' + encodeURIComponent(eventId), { method: 'DELETE' })
      if (res.status !== 404 && res.status !== 410) await ok(res)
    },
  }
}
