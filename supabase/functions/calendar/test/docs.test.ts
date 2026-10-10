// Run: npm run test:calendar
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calendarHash } from '../cardhash.ts'
import { applyChanges, dirtyDocs, ingestInbox, loadModel, markSynced, pendingWork } from '../docs.ts'

const TZ = 'Asia/Taipei'

function card(id: string, fields: Record<string, unknown> = {}) {
  return { id, listId: 'l1', title: id, description: '', startDate: null, dueDate: null, completed: false, archived: false, ...fields }
}

function model(cards: Record<string, unknown>[], extra: { doc_id: string; data: unknown }[] = []) {
  return loadModel([
    { doc_id: 'meta', data: { focusBoardId: 'f', _rev: 3 } },
    { doc_id: 'board-f', data: { board: { id: 'f', title: '上層', listIds: ['l1'] }, _rev: 2 } },
    { doc_id: 'list-l1', data: { list: { id: 'l1', title: '待辦', cardIds: cards.map((c) => c.id), color: null }, cards, _rev: 5 } },
    ...extra,
  ])
}

const listDoc = (m: ReturnType<typeof model>, id: string) => m.docs.get(id)!.data

test('pendingWork finds changed dated cards, undated ones and trashed ones', () => {
  const synced = card('a', { dueDate: '2026-10-12' })
  const m = model(
    [card('new', { dueDate: '2026-10-11' }), { ...synced, calHash: calendarHash(synced) }, card('plain'), card('cleared', { calHash: 'old' })],
    [{ doc_id: 'trash', data: { items: [{ card: card('gone', { calHash: 'x' }) }, { card: card('never') }] } }],
  )
  const w = pendingWork(m)
  assert.deepEqual(w.upserts.map((u) => u.cardId), ['new'])
  assert.deepEqual(w.deletes.sort(), ['cleared', 'gone'])
  assert.equal(w.hashes.new, calendarHash(card('new', { dueDate: '2026-10-11' })))

  markSynced(m, w.hashes)
  assert.deepEqual(pendingWork(m), { upserts: [], deletes: [], hashes: {} })
  const docs = dirtyDocs(m)
  assert.deepEqual(docs.map((d) => d.doc_id).sort(), ['list-l1', 'trash'])
  assert.equal(docs.find((d) => d.doc_id === 'list-l1')!.data._rev, 6)
})

test('applyChanges updates, creates in 行事曆 and trashes', () => {
  const m = model([card('a', { dueDate: '2026-10-12' }), card('b', { dueDate: '2026-10-13' })])
  const base = { accountId: 'acc', description: '', startDate: null, completed: false, time: null }
  applyChanges(
    m,
    [
      { type: 'upsert', cardId: 'a', isNew: false, ...base, title: 'A 改', dueDate: '2026-10-14', completed: true },
      { type: 'upsert', cardId: 'ev1', isNew: true, ...base, title: '看牙', dueDate: '2026-10-20', time: '09:00–10:00' },
      { type: 'delete', cardId: 'b' },
    ],
    TZ,
  )
  const l1 = listDoc(m, 'list-l1')
  const a = l1.cards.find((c: { id: string }) => c.id === 'a')
  assert.equal(a.title, 'A 改')
  assert.ok(a.completedAt)
  assert.equal(a.calHash, calendarHash(a))
  assert.deepEqual(l1.list.cardIds, ['a'])

  const board = listDoc(m, 'board-f').board
  assert.equal(board.listIds.length, 2)
  const cal = listDoc(m, 'list-' + board.listIds[1])
  assert.equal(cal.list.title, '行事曆')
  assert.equal(cal.cards[0].id, 'ev1')
  assert.equal(cal.cards[0].time, '09:00–10:00')
  assert.equal(cal.cards[0].calHash, calendarHash(cal.cards[0]))

  const trash = listDoc(m, 'trash').items
  assert.equal(trash[0].card.id, 'b')
  assert.equal(trash[0].card.calHash, null)
  // Nothing goes back to the calendar for these.
  assert.deepEqual(pendingWork(m), { upserts: [], deletes: [], hashes: {} })
})

test('a calendar edit to a card deleted here stays deleted', () => {
  const m = model([], [{ doc_id: 'trash', data: { items: [{ card: card('x', { calHash: 'h' }) }] } }])
  applyChanges(m, [{ type: 'upsert', cardId: 'x', isNew: false, accountId: 'acc', title: 'x', description: '', startDate: null, dueDate: '2026-10-12', completed: false, time: null }], TZ)
  assert.equal(listDoc(m, 'board-f').board.listIds.length, 1)
})

test('ingestInbox brings in Beamup todos and events', () => {
  const m = model([])
  ingestInbox(
    m,
    [
      { type: 'todo.created', id: 't1', title: '買牛奶', note: '兩瓶', tags: ['家'], due: '2026-10-11' },
      { type: 'event.created', id: 'e1', title: '開會', start: '2026-10-12T02:00:00Z', end: '2026-10-12T03:30:00Z', allDay: false },
      { type: 'event.created', id: 'e2', title: '旅行', start: '2026-10-20', end: '2026-10-23', allDay: true },
    ],
    TZ,
  )
  const todo = listDoc(m, 'list-l1').cards[0]
  assert.equal(todo.title, '買牛奶')
  assert.equal(todo.description, '兩瓶\n\n#家')
  assert.equal(todo.dueDate, '2026-10-11')

  const board = listDoc(m, 'board-f').board
  const cal = listDoc(m, 'list-' + board.listIds[1]).cards
  assert.deepEqual(
    cal.map((c: Record<string, unknown>) => [c.title, c.startDate, c.dueDate, c.time]),
    [
      ['開會', null, '2026-10-12', '10:00–11:30'],
      ['旅行', '2026-10-20', '2026-10-22', null],
    ],
  )
  // New dated cards are now waiting to go to the calendar.
  assert.equal(pendingWork(m).upserts.length, 3)

  ingestInbox(m, [{ type: 'todo.updated', id: 't1', title: '買牛奶', done: true }, { type: 'event.deleted', id: 'e1' }], TZ)
  assert.equal(listDoc(m, 'list-l1').cards[0].completed, true)
  assert.ok(listDoc(m, 'list-l1').cards[0].completedAt)
  assert.equal(listDoc(m, 'trash').items[0].card.title, '開會')
})
