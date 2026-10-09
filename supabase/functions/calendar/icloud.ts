// iCloud Calendar over CalDAV, signed in with an app-specific password, behind the Provider interface.
// Event ids are the event's resource path (plus "#<RECURRENCE-ID>" for one occurrence of a repeating event).

import type { CalEvent, Draft } from './events.ts'
import { addDays, wallToUtc } from './events.ts'
import type { Provider } from './sync.ts'

const ROOT = 'https://caldav.icloud.com'

// ---------- iCalendar (RFC 5545), only what calendar events need ----------

function unfold(ics: string): string[] {
  return ics.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/)
}

const unescapeText = (v: string) => v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
const escapeText = (v: string) => v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')

interface Prop {
  value: string
  params: Record<string, string>
}

/** "20261010T140000Z" / "20261010T140000" (+TZID) / "20261010" → all-day date or UTC instant. */
function icsTime(p: Prop, tz: string): { allDay: boolean; value: string } {
  const v = p.value
  if (p.params.VALUE === 'DATE' || /^\d{8}$/.test(v)) return { allDay: true, value: `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` }
  const local = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T${v.slice(9, 11)}:${v.slice(11, 13)}:${v.slice(13, 15)}`
  if (v.endsWith('Z')) return { allDay: false, value: new Date(local + 'Z').toISOString() }
  return { allDay: false, value: new Date(wallToUtc(local, p.params.TZID || tz)).toISOString() }
}

export interface VEvent {
  uid: string
  recurrenceId: string | null
  props: Record<string, Prop>
}

export function parseIcs(ics: string): VEvent[] {
  const out: VEvent[] = []
  let cur: VEvent | null = null
  let depth = 0
  for (const line of unfold(ics)) {
    if (line === 'BEGIN:VEVENT') {
      cur = { uid: '', recurrenceId: null, props: {} }
      depth = 0
      continue
    }
    if (!cur) continue
    if (line.startsWith('BEGIN:')) depth++
    else if (line.startsWith('END:') && depth > 0) depth--
    else if (line === 'END:VEVENT') {
      out.push(cur)
      cur = null
    } else if (depth === 0) {
      const i = line.indexOf(':')
      if (i < 0) continue
      const [name, ...params] = line.slice(0, i).split(';')
      const p: Prop = { value: line.slice(i + 1), params: {} }
      for (const kv of params) {
        const [k, v = ''] = kv.split('=')
        p.params[k.toUpperCase()] = v.replace(/^"|"$/g, '')
      }
      const key = name.toUpperCase()
      cur.props[key] = p
      if (key === 'UID') cur.uid = p.value
      if (key === 'RECURRENCE-ID') cur.recurrenceId = p.value
    }
  }
  return out
}

export function veventToEvent(href: string, v: VEvent, tz: string): CalEvent | null {
  const start = v.props.DTSTART
  if (!start || v.props.STATUS?.value === 'CANCELLED') return null
  const s = icsTime(start, tz)
  let e: { allDay: boolean; value: string }
  if (v.props.DTEND) e = icsTime(v.props.DTEND, tz)
  else if (s.allDay) e = { allDay: true, value: addDays(s.value, 1) }
  else e = { allDay: false, value: s.value }
  return {
    id: v.recurrenceId ? `${href}#${v.recurrenceId}` : href,
    title: v.props.SUMMARY ? unescapeText(v.props.SUMMARY.value) : '(無標題)',
    description: v.props.DESCRIPTION ? unescapeText(v.props.DESCRIPTION.value) : '',
    allDay: s.allDay,
    start: s.value,
    end: e.value,
    recurring: !!v.recurrenceId || !!v.props.RRULE,
  }
}

const icsDate = (d: string) => d.replace(/-/g, '')
const icsInstant = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

export function buildIcs(uid: string, d: Draft): string {
  const fold = (line: string) => {
    const out: string[] = []
    let rest = line
    while (rest.length > 74) {
      out.push(rest.slice(0, 74))
      rest = ' ' + rest.slice(74)
    }
    out.push(rest)
    return out.join('\r\n')
  }
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mothership//Calendar sync//ZH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsInstant(new Date().toISOString())}`,
    d.allDay ? `DTSTART;VALUE=DATE:${icsDate(d.start)}` : `DTSTART:${icsInstant(d.start)}`,
    d.allDay ? `DTEND;VALUE=DATE:${icsDate(d.end)}` : `DTEND:${icsInstant(d.end)}`,
    fold(`SUMMARY:${escapeText(d.title)}`),
    ...(d.description ? [fold(`DESCRIPTION:${escapeText(d.description)}`)] : []),
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

// ---------- WebDAV plumbing ----------

/** Contents of every <tag> (any namespace prefix) in an XML string. */
function tags(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, 'g')
  return [...xml.matchAll(re)].map((m) => m[1])
}
const decodeXml = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

export function icloudProvider(username: string, password: string): Provider & {
  calendars(): Promise<{ id: string; name: string }[]>
} {
  const auth = 'Basic ' + btoa(unescape(encodeURIComponent(`${username}:${password}`)))
  // iCloud answers from per-account hosts (pNN-caldav.icloud.com) and redirects there. fetch drops the
  // Authorization header when a redirect changes host, so redirects are followed by hand and the login is
  // sent again, only ever to icloud.com hosts.
  // Where each response actually came from after redirects; relative hrefs in it resolve against this.
  const finalUrl = new WeakMap<Response, string>()
  const urlOf = (res: Response) => finalUrl.get(res) ?? ROOT + '/'
  const dav = async (url: string, method: string, body?: string, headers: Record<string, string> = {}) => {
    let target = url.startsWith('http') ? url : ROOT + url
    for (let hop = 0; hop < 5; hop++) {
      const res = await fetch(target, {
        method,
        redirect: 'manual',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/xml; charset=utf-8',
          'User-Agent': 'Mothership/1.0 (CalDAV)',
          ...headers,
        },
        body,
      })
      const next = res.headers.get('location')
      if (res.status >= 300 && res.status < 400 && next) {
        const to = new URL(next, target)
        if (to.protocol !== 'https:' || !/(^|\.)icloud\.com$/.test(to.hostname)) throw new Error('iCloud 轉址到不明的位置：' + to.host)
        target = to.toString()
        continue
      }
      if (res.status === 401 || res.status === 403) {
        const host = new URL(target).host
        throw new Error(
          `iCloud 拒絕登入（${res.status}，${host} ${method}）。請確認：Apple ID 是 account.apple.com 最上方顯示的那個 Email、App 專用密碼是剛產生且沒有撤銷的`,
        )
      }
      finalUrl.set(res, target)
      return res
    }
    throw new Error('iCloud 轉址太多次')
  }
  const absolute = (base: string, href: string) => new URL(href, base).toString()

  const home = (async () => {
    const r1 = await dav(ROOT + '/', 'PROPFIND', '<d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>', { Depth: '0' })
    const principal = decodeXml(tags(tags(await r1.text(), 'current-user-principal')[0] ?? '', 'href')[0] ?? '')
    if (!principal) throw new Error('找不到 iCloud 行事曆帳號')
    const r2 = await dav(
      absolute(urlOf(r1), principal),
      'PROPFIND',
      '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-home-set/></d:prop></d:propfind>',
      { Depth: '0' },
    )
    const homeHref = tags(tags(await r2.text(), 'calendar-home-set')[0] ?? '', 'href')[0]
    if (!homeHref) throw new Error('找不到 iCloud 行事曆')
    return absolute(urlOf(r2), decodeXml(homeHref))
  })()
  // Keep an unawaited rejection from surfacing before anyone asks for it.
  home.catch(() => {})

  const report = async (calendarUrl: string, from: string, to: string, tz: string) => {
    const range = `start="${icsInstant(wallToUtc(from + 'T00:00:00', tz))}" end="${icsInstant(wallToUtc(to + 'T23:59:59', tz))}"`
    const res = await dav(
      calendarUrl,
      'REPORT',
      `<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
        <d:prop><d:getetag/><c:calendar-data><c:expand ${range}/></c:calendar-data></d:prop>
        <c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range ${range}/></c:comp-filter></c:comp-filter></c:filter>
      </c:calendar-query>`,
      { Depth: '1' },
    )
    if (!res.ok && res.status !== 207) throw new Error(`iCloud 行事曆回應 ${res.status}`)
    return tags(await res.text(), 'response').map((r) => ({ href: decodeXml(tags(r, 'href')[0] ?? ''), data: decodeXml(tags(r, 'calendar-data')[0] ?? '') }))
  }

  const eventsOf = (href: string, data: string, tz: string) =>
    parseIcs(data)
      .map((v) => veventToEvent(href, v, tz))
      .filter((e): e is CalEvent => !!e)

  return {
    async calendars() {
      const base = await home
      const res = await dav(
        base,
        'PROPFIND',
        '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:displayname/><d:resourcetype/><c:supported-calendar-component-set/></d:prop></d:propfind>',
        { Depth: '1' },
      )
      return tags(await res.text(), 'response')
        .filter((r) => /calendar\b/.test(tags(r, 'resourcetype')[0] ?? '') && /VEVENT/.test(r))
        .map((r) => ({ id: absolute(base, decodeXml(tags(r, 'href')[0])), name: decodeXml(tags(r, 'displayname')[0] ?? '行事曆') }))
    },
    async list(calendarId, from, to, tz) {
      return (await report(calendarId, from, to, tz)).flatMap((r) => eventsOf(r.href, r.data, tz))
    },
    async get(calendarId, eventId, tz) {
      const [href, rid] = eventId.split('#')
      const res = await dav(absolute(calendarId, href), 'GET', undefined, { 'Content-Type': 'text/calendar' })
      if (res.status === 404 || res.status === 410) return null
      if (!res.ok) throw new Error(`iCloud 行事曆回應 ${res.status}`)
      const all = eventsOf(href, await res.text(), tz)
      // One occurrence of a repeating event: exists as long as its series does.
      return (rid ? all.find((e) => e.id === eventId) ?? all[0] : all.find((e) => e.id === href)) ?? null
    },
    async create(calendarId, draft, tz, cardId) {
      const uid = `mothership-${cardId}`
      const href = new URL(calendarId).pathname.replace(/\/?$/, '/') + uid + '.ics'
      const res = await dav(absolute(calendarId, href), 'PUT', buildIcs(uid, draft), { 'Content-Type': 'text/calendar; charset=utf-8' })
      if (!res.ok) throw new Error(`iCloud 新增行程失敗（${res.status}）`)
      return veventToEvent(href, parseIcs(buildIcs(uid, draft))[0], tz)!
    },
    async update(calendarId, eventId, draft, tz) {
      const [href, rid] = eventId.split('#')
      const url = absolute(calendarId, href)
      const cur = await dav(url, 'GET', undefined, { 'Content-Type': 'text/calendar' })
      if (cur.status === 404 || cur.status === 410) return null
      const text = await cur.text()
      if (rid || /^RRULE:/m.test(text)) {
        // Rewriting a repeating series from one card would change every occurrence; leave it as it is.
        return (await this.get(calendarId, eventId, tz)) ?? null
      }
      const uid = parseIcs(text)[0]?.uid || href.split('/').pop()!.replace(/\.ics$/, '')
      const res = await dav(url, 'PUT', buildIcs(uid, draft), { 'Content-Type': 'text/calendar; charset=utf-8' })
      if (!res.ok) throw new Error(`iCloud 更新行程失敗（${res.status}）`)
      return veventToEvent(href, parseIcs(buildIcs(uid, draft))[0], tz)
    },
    async remove(calendarId, eventId) {
      const [href, rid] = eventId.split('#')
      if (rid) return // deleting one occurrence would need an EXDATE edit of the series; not supported
      const res = await dav(absolute(calendarId, href), 'DELETE')
      if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`iCloud 刪除行程失敗（${res.status}）`)
    },
  }
}
