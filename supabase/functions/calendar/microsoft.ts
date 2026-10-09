// Outlook / Microsoft 365 calendar (Microsoft Graph) behind the Provider interface.

import type { CalEvent, Draft } from './events.ts'
import { wallToUtc } from './events.ts'
import type { Provider } from './sync.ts'

const GRAPH = 'https://graph.microsoft.com/v1.0'
export const MS_SCOPE = 'offline_access User.Read Calendars.ReadWrite'

export interface MicrosoftConfig {
  clientId: string
  clientSecret: string
  /** "common" (any account), "organizations", or the company's tenant id / domain. */
  tenant: string
}

export function microsoftAuthUrl(cfg: { clientId: string; tenant: string }, redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: MS_SCOPE,
    prompt: 'select_account',
    state,
  })
  return `https://login.microsoftonline.com/${encodeURIComponent(cfg.tenant)}/oauth2/v2.0/authorize?` + q
}

async function tokenRequest(cfg: MicrosoftConfig, body: Record<string, string>) {
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(cfg.tenant)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, scope: MS_SCOPE, ...body }),
  })
  const json = await res.json()
  if (!res.ok) {
    const msg: string = json.error_description || json.error || String(res.status)
    if (/AADSTS65001|consent/i.test(msg)) throw new Error('公司帳號需要系統管理員核准這個 App 的行事曆權限，請把 DEPLOY.md 的 Outlook 步驟交給 IT')
    throw new Error('Microsoft 登入失敗：' + msg.split('\n')[0])
  }
  return json as { access_token: string; refresh_token?: string; expires_in: number }
}

export async function microsoftExchange(cfg: MicrosoftConfig, code: string, redirectUri: string) {
  const t = await tokenRequest(cfg, { code, redirect_uri: redirectUri, grant_type: 'authorization_code' })
  if (!t.refresh_token) throw new Error('Microsoft 沒有給離線權限')
  const me = await fetch(GRAPH + '/me', { headers: { Authorization: 'Bearer ' + t.access_token } }).then((r) => r.json())
  return { refreshToken: t.refresh_token, label: (me.mail || me.userPrincipalName || 'Outlook') as string }
}

interface MEvent {
  id: string
  subject?: string
  body?: { content?: string; contentType?: string }
  isAllDay?: boolean
  isCancelled?: boolean
  type?: string
  start?: { dateTime: string; timeZone: string }
  end?: { dateTime: string; timeZone: string }
}

/** Graph returns times as "2026-10-10T06:00:00.0000000" in the zone we ask for (UTC). */
const utc = (dt: string) => new Date(dt.replace(/(\.\d{3})\d*$/, '$1') + 'Z').toISOString()

function fromGraph(e: MEvent): CalEvent | null {
  if (e.isCancelled || !e.start || !e.end) return null
  const allDay = !!e.isAllDay
  return {
    id: e.id,
    title: e.subject ?? '(無標題)',
    description: (e.body?.content ?? '').replace(/\r\n/g, '\n').trim(),
    allDay,
    // All-day events come back as midnight-to-midnight; their date part is the day.
    start: allDay ? e.start.dateTime.slice(0, 10) : utc(e.start.dateTime),
    end: allDay ? e.end.dateTime.slice(0, 10) : utc(e.end.dateTime),
    recurring: e.type === 'occurrence' || e.type === 'exception',
  }
}

function toGraph(d: Draft, tz: string) {
  return {
    subject: d.title,
    body: { contentType: 'text', content: d.description },
    isAllDay: d.allDay,
    // All-day events must start and end at midnight in the event's own time zone.
    start: d.allDay ? { dateTime: d.start + 'T00:00:00', timeZone: tz } : { dateTime: d.start.replace('Z', ''), timeZone: 'UTC' },
    end: d.allDay ? { dateTime: d.end + 'T00:00:00', timeZone: tz } : { dateTime: d.end.replace('Z', ''), timeZone: 'UTC' },
  }
}

const SELECT = 'id,subject,body,isAllDay,isCancelled,type,start,end'

export function microsoftProvider(cfg: MicrosoftConfig, refreshToken: string): Provider & {
  calendars(): Promise<{ id: string; name: string }[]>
  /** Microsoft rotates refresh tokens; the newest one, to be stored. */
  latestRefreshToken(): string
} {
  let refresh = refreshToken
  let token: { value: string; until: number } | null = null
  const call = async (path: string, init: RequestInit = {}): Promise<Response> => {
    if (!token || token.until < Date.now()) {
      const t = await tokenRequest(cfg, { refresh_token: refresh, grant_type: 'refresh_token' })
      token = { value: t.access_token, until: Date.now() + (t.expires_in - 60) * 1000 }
      if (t.refresh_token) refresh = t.refresh_token
    }
    return fetch(path.startsWith('https://') ? path : GRAPH + path, {
      ...init,
      headers: {
        Authorization: 'Bearer ' + token.value,
        'Content-Type': 'application/json',
        Prefer: 'outlook.timezone="UTC", outlook.body-content-type="text"',
        ...(init.headers ?? {}),
      },
    })
  }
  const ok = async (res: Response) => {
    if (res.ok) return res
    const body = await res.text()
    throw new Error(`Outlook 行事曆回應 ${res.status}：${body.slice(0, 200)}`)
  }

  return {
    latestRefreshToken: () => refresh,
    async calendars() {
      const json = await (await ok(await call('/me/calendars?$select=id,name,canEdit,isDefaultCalendar'))).json()
      return (json.value as { id: string; name: string; canEdit: boolean; isDefaultCalendar?: boolean }[])
        .filter((c) => c.canEdit)
        .map((c) => ({ id: c.id, name: c.isDefaultCalendar ? `${c.name}（預設）` : c.name }))
    },
    async list(calendarId, from, to, tz) {
      const out: CalEvent[] = []
      const q = new URLSearchParams({
        startDateTime: wallToUtc(from + 'T00:00:00', tz),
        endDateTime: wallToUtc(to + 'T23:59:59', tz),
        $top: '500',
        $select: SELECT,
      })
      let url: string | undefined = `/me/calendars/${encodeURIComponent(calendarId)}/calendarView?` + q
      while (url) {
        const json = await (await ok(await call(url))).json()
        for (const e of json.value as MEvent[]) {
          const ev = fromGraph(e)
          if (ev) out.push(ev)
        }
        url = json['@odata.nextLink']
      }
      return out
    },
    async get(_calendarId, eventId) {
      const res = await call(`/me/events/${encodeURIComponent(eventId)}?$select=${SELECT}`)
      if (res.status === 404) return null
      return fromGraph(await (await ok(res)).json())
    },
    async create(calendarId, draft, tz, cardId) {
      // transactionId makes a retried or concurrent create return the same event instead of a duplicate.
      const res = await call(`/me/calendars/${encodeURIComponent(calendarId)}/events`, {
        method: 'POST',
        body: JSON.stringify({ ...toGraph(draft, tz), transactionId: 'mothership-' + cardId }),
      })
      return fromGraph(await (await ok(res)).json())!
    },
    async update(_calendarId, eventId, draft, tz) {
      const res = await call(`/me/events/${encodeURIComponent(eventId)}`, { method: 'PATCH', body: JSON.stringify(toGraph(draft, tz)) })
      if (res.status === 404) return null
      return fromGraph(await (await ok(res)).json())
    },
    async remove(_calendarId, eventId) {
      const res = await call(`/me/events/${encodeURIComponent(eventId)}`, { method: 'DELETE' })
      if (res.status !== 404) await ok(res)
    },
  }
}
