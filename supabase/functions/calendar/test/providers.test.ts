import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildIcs, parseIcs, veventToEvent, icloudProvider } from '../icloud.ts'
import { googleEventId, googleProvider } from '../google.ts'
import { microsoftProvider } from '../microsoft.ts'

const TZ = 'Asia/Taipei'
type Handler = (url: string, init: RequestInit) => Response | Promise<Response>
function mockFetch(handler: Handler) {
  const calls: { url: string; init: RequestInit }[] = []
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input)
    calls.push({ url, init })
    return handler(url, init)
  }) as typeof fetch
  return calls
}
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } })

test('iCalendar parse and build', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'UID:abc',
    'DTSTART;TZID=Asia/Taipei:20261010T140000',
    'DTEND;TZID=Asia/Taipei:20261010T153000',
    'SUMMARY:跟廠商開會\\, 帶樣品',
    'DESCRIPTION:第一行\\n第二行',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'DESCRIPTION:alarm',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const [v] = parseIcs(ics)
  const ev = veventToEvent('/cal/abc.ics', v, TZ)!
  assert.equal(ev.title, '跟廠商開會, 帶樣品')
  assert.equal(ev.description, '第一行\n第二行', 'VALARM description does not leak in')
  assert.equal(ev.start, '2026-10-10T06:00:00.000Z')
  assert.equal(ev.end, '2026-10-10T07:30:00.000Z')

  const built = buildIcs('u1', { title: '很長的標題'.repeat(20), description: 'a;b', allDay: true, start: '2026-10-10', end: '2026-10-11' })
  const back = veventToEvent('/x.ics', parseIcs(built)[0], TZ)!
  assert.equal(back.title, '很長的標題'.repeat(20))
  assert.equal(back.description, 'a;b')
  assert.equal(back.allDay, true)
  assert.equal(back.start, '2026-10-10')
})

test('iCloud: discover calendars, list with expanded occurrences', async () => {
  const calls = mockFetch((url, init) => {
    if (init.method === 'PROPFIND' && url === 'https://caldav.icloud.com/')
      return new Response('<d:multistatus xmlns:d="DAV:"><d:response><d:propstat><d:prop><d:current-user-principal><d:href>/123/principal/</d:href></d:current-user-principal></d:prop></d:propstat></d:response></d:multistatus>', { status: 207 })
    if (init.method === 'PROPFIND' && url.endsWith('/123/principal/'))
      return new Response('<multistatus xmlns="DAV:"><response><propstat><prop><calendar-home-set xmlns="urn:ietf:params:xml:ns:caldav"><href xmlns="DAV:">https://p01-caldav.icloud.com/123/calendars/</href></calendar-home-set></prop></propstat></response></multistatus>', { status: 207 })
    if (init.method === 'PROPFIND')
      return new Response(
        '<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/123/calendars/home/</d:href><d:propstat><d:prop><d:displayname>行事曆</d:displayname><d:resourcetype><d:collection/><c:calendar/></d:resourcetype><c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set></d:prop></d:propstat></d:response><d:response><d:href>/123/calendars/inbox/</d:href><d:propstat><d:prop><d:displayname>Inbox</d:displayname><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response></d:multistatus>',
        { status: 207 },
      )
    if (init.method === 'REPORT')
      return new Response(
        `<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/123/calendars/home/w.ics</d:href><d:propstat><d:prop><c:calendar-data>BEGIN:VCALENDAR
BEGIN:VEVENT
UID:w
RECURRENCE-ID:20261012T010000Z
DTSTART:20261012T010000Z
DTEND:20261012T020000Z
SUMMARY:週會 &amp; 例行
END:VEVENT
BEGIN:VEVENT
UID:w
RECURRENCE-ID:20261019T010000Z
DTSTART:20261019T010000Z
DTEND:20261019T020000Z
SUMMARY:週會 &amp; 例行
END:VEVENT
END:VCALENDAR</c:calendar-data></d:prop></d:propstat></d:response></d:multistatus>`,
        { status: 207 },
      )
    return new Response('', { status: 404 })
  })
  const p = icloudProvider('me@icloud.com', 'abcd-efgh-ijkl-mnop')
  const cals = await p.calendars()
  assert.deepEqual(cals, [{ id: 'https://p01-caldav.icloud.com/123/calendars/home/', name: '行事曆' }])
  const evs = await p.list(cals[0].id, '2026-10-10', '2026-12-31', TZ)
  assert.equal(evs.length, 2)
  assert.equal(evs[0].title, '週會 & 例行')
  assert.equal(evs[0].id, '/123/calendars/home/w.ics#20261012T010000Z')
  assert.equal(evs[0].recurring, true)
  assert.match(String((calls[0].init.headers as Record<string, string>).Authorization), /^Basic /)
})

test('Google: maps events, creates with a card-derived id, falls back to update on 409', async () => {
  assert.match(googleEventId('ab12cd34'), /^[a-v0-9]{5,1024}$/)
  const calls = mockFetch((url, init) => {
    if (url.includes('oauth2.googleapis.com')) return json({ access_token: 'at', expires_in: 3600 })
    if (url.includes('/events?'))
      return json({
        items: [
          { id: 'g1', summary: '午餐', start: { dateTime: '2026-10-10T12:00:00+08:00' }, end: { dateTime: '2026-10-10T13:00:00+08:00' } },
          { id: 'g2', status: 'cancelled' },
          { id: 'g3', summary: '國慶', start: { date: '2026-10-10' }, end: { date: '2026-10-11' }, recurringEventId: 'x' },
        ],
      })
    if (init.method === 'POST') return json({ error: { code: 409 } }, 409)
    if (init.method === 'PATCH') {
      const b = JSON.parse(String(init.body))
      return json({ id: url.split('/').pop(), summary: b.summary, description: b.description, start: b.start, end: b.end })
    }
    return json({}, 404)
  })
  const p = googleProvider({ clientId: 'id', clientSecret: 's' }, 'rt')
  const evs = await p.list('primary', '2026-10-10', '2026-10-20', TZ)
  assert.deepEqual(
    evs.map((e) => [e.id, e.title, e.allDay, e.start, e.recurring]),
    [
      ['g1', '午餐', false, '2026-10-10T04:00:00.000Z', false],
      ['g3', '國慶', true, '2026-10-10', true],
    ],
  )
  const created = await p.create('primary', { title: 'T', description: '', allDay: true, start: '2026-10-11', end: '2026-10-12' }, TZ, 'card1')
  assert.equal(created.id, googleEventId('card1'))
  assert.equal(created.start, '2026-10-11')
  assert.equal(calls.filter((c) => c.url.includes('oauth2')).length, 1, 'token reused')
})

test('Outlook: all-day and timed events, refresh token rotation', async () => {
  mockFetch((url, init) => {
    if (url.includes('/oauth2/v2.0/token')) return json({ access_token: 'at', expires_in: 3600, refresh_token: 'rt2' })
    if (url.includes('/calendarView'))
      return json({
        value: [
          { id: 'o1', subject: '部門會議', body: { content: '議程\r\n1' }, isAllDay: false, start: { dateTime: '2026-10-10T02:00:00.0000000', timeZone: 'UTC' }, end: { dateTime: '2026-10-10T03:00:00.0000000', timeZone: 'UTC' } },
          { id: 'o2', subject: '休假', isAllDay: true, start: { dateTime: '2026-10-12T00:00:00.0000000', timeZone: 'UTC' }, end: { dateTime: '2026-10-14T00:00:00.0000000', timeZone: 'UTC' } },
          { id: 'o3', subject: '取消', isCancelled: true, start: { dateTime: '2026-10-10T02:00:00.0000000' }, end: { dateTime: '2026-10-10T03:00:00.0000000' } },
        ],
      })
    if (init.method === 'POST') {
      const b = JSON.parse(String(init.body))
      assert.equal(b.transactionId, 'mothership-c1')
      return json({ id: 'new', subject: b.subject, isAllDay: b.isAllDay, start: b.start, end: b.end, body: { content: '' } })
    }
    return json({}, 404)
  })
  const p = microsoftProvider({ clientId: 'id', clientSecret: 's', tenant: 'common' }, 'rt1')
  const evs = await p.list('cal', '2026-10-10', '2026-10-20', TZ)
  assert.deepEqual(
    evs.map((e) => [e.id, e.allDay, e.start, e.end, e.description]),
    [
      ['o1', false, '2026-10-10T02:00:00.000Z', '2026-10-10T03:00:00.000Z', '議程\n1'],
      ['o2', true, '2026-10-12', '2026-10-14', ''],
    ],
  )
  const ev = await p.create('cal', { title: '新卡片', description: '', allDay: true, start: '2026-10-11', end: '2026-10-12' }, TZ, 'c1')
  assert.equal(ev.start, '2026-10-11')
  assert.equal(p.latestRefreshToken(), 'rt2')
})
