// Run: npm run test:calendar
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { CalEvent, Draft } from '../events.ts'
import { addDays, shiftInstant, todayIn, toCardFields, wallToUtc } from '../events.ts'
import type { Account, Link, Provider, Store } from '../sync.ts'
import { pullAccount, push } from '../sync.ts'

const TZ = 'Asia/Taipei'
const today = todayIn(TZ)

function fakeCalendar() {
  const events = new Map<string, CalEvent>()
  let n = 0
  const calls: string[] = []
  const fromDraft = (id: string, d: Draft): CalEvent => ({ id, title: d.title, description: d.description, allDay: d.allDay, start: d.start, end: d.end, recurring: false })
  const provider: Provider = {
    async list(_c, from, to) {
      calls.push('list')
      return [...events.values()].filter((e) => {
        const s = e.allDay ? e.start : e.start.slice(0, 10)
        return s >= from && s <= to
      })
    },
    async get(_c, id) {
      calls.push('get ' + id)
      return events.get(id) ?? null
    },
    async create(_c, d) {
      const ev = fromDraft('e' + ++n, d)
      events.set(ev.id, ev)
      calls.push('create ' + ev.id)
      return ev
    },
    async update(_c, id, d) {
      if (!events.has(id)) return null
      const ev = fromDraft(id, d)
      events.set(id, ev)
      calls.push('update ' + id)
      return ev
    },
    async remove(_c, id) {
      events.delete(id)
      calls.push('remove ' + id)
    },
  }
  return { events, provider, calls }
}

function memoryStore(): Store & { links: Map<string, Link> } {
  const links = new Map<string, Link>()
  const key = (a: string, e: string) => a + '|' + e
  return {
    links,
    async linksForAccount(a) {
      return [...links.values()].filter((l) => l.account_id === a)
    },
    async linkForCard(c) {
      return [...links.values()].find((l) => l.card_id === c) ?? null
    },
    async insertLink(l) {
      const k = key(l.account_id, l.event_id)
      if (!links.has(k)) links.set(k, l)
      return links.get(k)!
    },
    async saveLink(l) {
      for (const [k, v] of links) if (v.card_id === l.card_id && v.event_id !== l.event_id) links.delete(k)
      links.set(key(l.account_id, l.event_id), l)
    },
    async deleteLink(a, e) {
      links.delete(key(a, e))
    },
  }
}

const acct: Account = { id: 'A', calendar_id: 'cal', is_target: true }

test('time zone helpers', () => {
  assert.equal(wallToUtc('2026-10-10T14:00:00', 'Asia/Taipei'), '2026-10-10T06:00:00Z')
  // Across the US DST change the wall-clock time stays put.
  const before = wallToUtc('2026-10-30T09:00:00', 'America/New_York')
  assert.equal(before, '2026-10-30T13:00:00Z')
  assert.equal(shiftInstant(before, 3, 'America/New_York'), '2026-11-02T14:00:00Z')
})

test('event → card fields', () => {
  const timed: CalEvent = { id: 'x', title: '✓ 開會', description: 'd', allDay: false, start: '2026-10-10T06:00:00.000Z', end: '2026-10-10T07:30:00.000Z', recurring: false }
  assert.deepEqual(toCardFields(timed, TZ), { title: '開會', description: 'd', completed: true, startDate: null, dueDate: '2026-10-10', time: '14:00–15:30' })
  const multi: CalEvent = { id: 'y', title: '出差', description: '', allDay: true, start: '2026-10-10', end: '2026-10-13', recurring: false }
  assert.deepEqual(toCardFields(multi, TZ), { title: '出差', description: '', completed: false, startDate: '2026-10-10', dueDate: '2026-10-12', time: null })
})

test('pull imports, skips unchanged, follows edits, moves and deletes', async () => {
  const { events, provider } = fakeCalendar()
  const store = memoryStore()
  events.set('m1', { id: 'm1', title: '週會', description: '', allDay: false, start: wallToUtc(addDays(today, 1) + 'T10:00:00', TZ), end: wallToUtc(addDays(today, 1) + 'T11:00:00', TZ), recurring: false })
  events.set('m2', { id: 'm2', title: '交報告', description: '', allDay: true, start: addDays(today, 3), end: addDays(today, 4), recurring: false })

  const first = await pullAccount(acct, provider, store, TZ)
  assert.equal(first.length, 2)
  assert.ok(first.every((c) => c.type === 'upsert' && c.isNew))
  const meeting = first.find((c) => c.type === 'upsert' && c.title === '週會')!
  assert.equal(meeting.type === 'upsert' && meeting.time, '10:00–11:00')

  assert.deepEqual(await pullAccount(acct, provider, store, TZ), [], 'nothing changed')

  events.set('m2', { ...events.get('m2')!, title: '交期末報告' })
  const edited = await pullAccount(acct, provider, store, TZ)
  assert.equal(edited.length, 1)
  assert.equal(edited[0].type === 'upsert' && edited[0].title, '交期末報告')

  // Moved far ahead: out of the window, but still exists → update, not delete.
  events.set('m2', { ...events.get('m2')!, start: addDays(today, 200), end: addDays(today, 201) })
  const moved = await pullAccount(acct, provider, store, TZ)
  assert.equal(moved.length, 1)
  assert.equal(moved[0].type === 'upsert' && moved[0].dueDate, addDays(today, 200))

  events.delete('m1')
  const gone = await pullAccount(acct, provider, store, TZ)
  assert.deepEqual(gone, [{ type: 'delete', cardId: meeting.cardId }])
})

test('push creates, updates, completes and deletes; our own writes do not come back', async () => {
  const { events, provider, calls } = fakeCalendar()
  const store = memoryStore()
  const card = { cardId: 'c1', title: '寫企劃', description: '草稿', startDate: null, dueDate: addDays(today, 2), completed: false }
  let r = await push([acct], () => provider, store, TZ, [card], [])
  assert.deepEqual(r, { done: ['c1'], errors: [] })
  const ev = [...events.values()][0]
  assert.equal(ev.allDay, true)
  assert.equal(ev.start, addDays(today, 2))
  assert.deepEqual(await pullAccount(acct, provider, store, TZ), [], 'own create is not echoed')

  r = await push([acct], () => provider, store, TZ, [{ ...card, completed: true, dueDate: addDays(today, 5) }], [])
  assert.equal(events.get(ev.id)!.title, '✓ 寫企劃')
  assert.equal(events.get(ev.id)!.start, addDays(today, 5))
  assert.deepEqual(await pullAccount(acct, provider, store, TZ), [], 'own update is not echoed')

  await push([acct], () => provider, store, TZ, [], ['c1'])
  assert.equal(events.size, 0)
  assert.equal(store.links.size, 0)
  assert.ok(calls.includes('remove ' + ev.id))
})

test('moving a card keeps a timed event at its hours', async () => {
  const { events, provider } = fakeCalendar()
  const store = memoryStore()
  const day = addDays(today, 1)
  events.set('t1', { id: 't1', title: '面試', description: '', allDay: false, start: wallToUtc(day + 'T15:00:00', TZ), end: wallToUtc(day + 'T16:00:00', TZ), recurring: false })
  const [c] = await pullAccount(acct, provider, store, TZ)
  await push([acct], () => provider, store, TZ, [{ cardId: c.cardId, title: '面試', description: '', startDate: null, dueDate: addDays(day, 2), completed: false }], [])
  const moved = events.get('t1')!
  assert.equal(moved.allDay, false)
  assert.equal(moved.start, wallToUtc(addDays(day, 2) + 'T15:00:00', TZ))
  assert.equal(moved.end, wallToUtc(addDays(day, 2) + 'T16:00:00', TZ))
})

test('an event deleted on the calendar is recreated if the card is edited afterwards', async () => {
  const { events, provider } = fakeCalendar()
  const store = memoryStore()
  const card = { cardId: 'c9', title: 'A', description: '', startDate: null, dueDate: addDays(today, 1), completed: false }
  await push([acct], () => provider, store, TZ, [card], [])
  events.clear()
  await push([acct], () => provider, store, TZ, [{ ...card, title: 'B' }], [])
  assert.equal([...events.values()][0].title, 'B')
})

test('new cards go to the target account', async () => {
  const a = fakeCalendar()
  const b = fakeCalendar()
  const store = memoryStore()
  const accounts: Account[] = [
    { id: 'A', calendar_id: 'x', is_target: false },
    { id: 'B', calendar_id: 'y', is_target: true },
  ]
  await push(accounts, (acc) => (acc.id === 'A' ? a.provider : b.provider), store, TZ, [{ cardId: 'n', title: 'N', description: '', startDate: null, dueDate: today, completed: false }], [])
  assert.equal(a.events.size, 0)
  assert.equal(b.events.size, 1)
})

test('a card with a time (from a Beamup event) becomes a timed event, and follows time changes', async () => {
  const { events, provider } = fakeCalendar()
  const store = memoryStore()
  const day = addDays(today, 1)
  const card = { cardId: 'b1', title: '跟廠商開會', description: '@會議室', startDate: null, dueDate: day, completed: false, time: '14:00–15:30' }
  await push([acct], () => provider, store, TZ, [card], [])
  const ev = [...events.values()][0]
  assert.equal(ev.allDay, false)
  assert.equal(ev.start, wallToUtc(day + 'T14:00:00', TZ))
  assert.equal(ev.end, wallToUtc(day + 'T15:30:00', TZ))
  assert.deepEqual(await pullAccount(acct, provider, store, TZ), [], 'not echoed')
  await push([acct], () => provider, store, TZ, [{ ...card, time: '16:00–17:00' }], [])
  assert.equal(events.get(ev.id)!.start, wallToUtc(day + 'T16:00:00', TZ))
  // Ending at midnight rolls to the next day.
  await push([acct], () => provider, store, TZ, [{ ...card, time: '23:00–00:00' }], [])
  assert.equal(events.get(ev.id)!.end, wallToUtc(addDays(day, 1) + 'T00:00:00', TZ))
})
