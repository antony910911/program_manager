// The app's stored documents (user_docs), edited on the server so calendars and Beamup sync while the app is
// closed. Mirrors what the app's reducer does for the same changes (src/store.ts: calendarApply, calendarSynced,
// ingestInbox); kept small and plain so it runs in the Edge runtime and in Node tests.
//
// Documents: `meta` (focusBoardId…), `board-<id>` {board}, `list-<id>` {list, cards}, `trash` {items}.
// Each stored document carries `_rev`; a write bumps it so open apps take it as the newer version.

import { calendarHash } from './cardhash.ts'
import type { CardPush } from './events.ts'
import { localDate, localTime } from './events.ts'
import type { Change } from './sync.ts'

// deno-lint-ignore no-explicit-any
type Json = any

export interface Model {
  docs: Map<string, { data: Json; rev: number }>
  dirty: Set<string>
}

const CALENDAR_LIST = '行事曆'
const uid = () => Math.random().toString(36).slice(2, 10)

export function loadModel(rows: { doc_id: string; data: Json }[]): Model {
  const docs = new Map<string, { data: Json; rev: number }>()
  for (const r of rows) {
    const { _rev, ...data } = r.data ?? {}
    docs.set(r.doc_id, { data, rev: typeof _rev === 'number' ? _rev : 0 })
  }
  return { docs, dirty: new Set() }
}

/** Changed documents, ready to store (revision bumped). */
export function dirtyDocs(m: Model): { doc_id: string; data: Json }[] {
  return [...m.dirty].map((id) => {
    const d = m.docs.get(id)!
    return { doc_id: id, data: { ...d.data, _rev: d.rev + 1 } }
  })
}

const touch = (m: Model, id: string) => m.dirty.add(id)
const get = (m: Model, id: string) => m.docs.get(id)?.data

function lists(m: Model): { docId: string; data: Json }[] {
  return [...m.docs].filter(([id]) => id.startsWith('list-')).map(([docId, d]) => ({ docId, data: d.data }))
}

function findCard(m: Model, cardId: string): { docId: string; data: Json; index: number } | null {
  for (const l of lists(m)) {
    const index = (l.data.cards as Json[]).findIndex((c) => c.id === cardId)
    if (index >= 0) return { ...l, index }
  }
  return null
}

function trashItems(m: Model): Json[] {
  return (get(m, 'trash')?.items as Json[]) ?? []
}

export const cardIds = (m: Model) => new Set(lists(m).flatMap((l) => (l.data.cards as Json[]).map((c) => c.id as string)))
export const trashedIds = (m: Model) => new Set(trashItems(m).map((t) => t.card.id as string))

/** Cards to write to (or remove from) the calendar, as the app computes them. */
export function pendingWork(m: Model) {
  const upserts: CardPush[] = []
  const deletes: string[] = []
  const hashes: Record<string, string | null> = {}
  for (const l of lists(m))
    for (const c of l.data.cards as Json[]) {
      const want = calendarHash(c)
      if (want === (c.calHash ?? null)) continue
      hashes[c.id] = want
      if (want)
        upserts.push({ cardId: c.id, title: c.title, description: c.description, startDate: c.startDate, dueDate: c.dueDate, completed: c.completed, time: c.time ?? null })
      else deletes.push(c.id)
    }
  for (const t of trashItems(m))
    if (t.card.calHash) {
      hashes[t.card.id] = null
      deletes.push(t.card.id)
    }
  return { upserts, deletes, hashes }
}

export function markSynced(m: Model, hashes: Record<string, string | null>) {
  for (const [id, h] of Object.entries(hashes)) {
    const found = findCard(m, id)
    if (found) {
      found.data.cards[found.index] = { ...found.data.cards[found.index], calHash: h }
      touch(m, found.docId)
    }
    if (h === null) {
      const items = trashItems(m)
      const i = items.findIndex((t) => t.card.id === id)
      if (i >= 0 && items[i].card.calHash) {
        items[i] = { ...items[i], card: { ...items[i].card, calHash: null } }
        touch(m, 'trash')
      }
    }
  }
}

function focusBoardId(m: Model): string | null {
  return get(m, 'meta')?.focusBoardId ?? null
}

function boardTitleOf(m: Model, listId: string): string {
  for (const [id, d] of m.docs) if (id.startsWith('board-') && (d.data.board.listIds as string[]).includes(listId)) return d.data.board.title
  return ''
}

/** A focus-board list by title, created at the end of the top lists if missing. */
function focusList(m: Model, title: string, color: string | null, create: boolean): string | null {
  const fb = focusBoardId(m)
  const board = fb && get(m, 'board-' + fb)?.board
  if (!board) return null
  const existing = (board.listIds as string[]).find((id) => get(m, 'list-' + id)?.list.title === title)
  if (existing || !create) return existing ?? null
  const id = uid()
  m.docs.set('list-' + id, { data: { list: { id, title, cardIds: [], color }, cards: [] }, rev: 0 })
  board.listIds = [...board.listIds, id]
  touch(m, 'list-' + id)
  touch(m, 'board-' + fb)
  return id
}

function newCard(listId: string, fields: Json): Json {
  return {
    id: uid(),
    listId,
    homeBoardId: null,
    homeListId: null,
    title: '',
    description: '',
    labelIds: [],
    memberIds: [],
    startDate: null,
    dueDate: null,
    completed: false,
    checklist: [],
    comments: [],
    customFields: {},
    cover: null,
    archived: false,
    createdAt: new Date().toISOString(),
    ...fields,
  }
}

function addCard(m: Model, listId: string, card: Json) {
  const doc = get(m, 'list-' + listId)
  doc.cards = [...doc.cards, { ...card, listId }]
  doc.list = { ...doc.list, cardIds: [...doc.list.cardIds, card.id] }
  touch(m, 'list-' + listId)
}

function patchCard(m: Model, cardId: string, patch: Json): Json | null {
  const found = findCard(m, cardId)
  if (!found) return null
  const before = found.data.cards[found.index]
  const after = { ...before, ...patch }
  if (patch.completed !== undefined && patch.completed !== before.completed) after.completedAt = patch.completed ? patch.today : null
  delete after.today
  found.data.cards[found.index] = after
  touch(m, found.docId)
  return after
}

/** Into the trash, as the app does when a card is deleted. */
function trashCard(m: Model, cardId: string, keepCalendar: boolean) {
  const found = findCard(m, cardId)
  if (!found) return
  const card = found.data.cards[found.index]
  found.data.cards.splice(found.index, 1)
  found.data.list = { ...found.data.list, cardIds: found.data.list.cardIds.filter((id: string) => id !== cardId) }
  touch(m, found.docId)
  const trash = get(m, 'trash') ?? (m.docs.set('trash', { data: { items: [] }, rev: 0 }), get(m, 'trash'))
  trash.items = [
    { card: keepCalendar ? card : { ...card, calHash: null }, listTitle: found.data.list.title, boardTitle: boardTitleOf(m, found.data.list.id), deletedAt: new Date().toISOString() },
    ...trash.items,
  ]
  touch(m, 'trash')
}

/** Changes pulled from the calendars, applied like the app's calendarApply. */
export function applyChanges(m: Model, changes: Change[], tz: string) {
  const today = localDate(new Date().toISOString(), tz)
  const trashed = trashedIds(m)
  for (const ch of changes) {
    if (ch.type === 'delete') {
      // Deleted on the calendar: into the trash, without deleting it on the calendar again.
      trashCard(m, ch.cardId, false)
      continue
    }
    const fields = { title: ch.title, description: ch.description, startDate: ch.startDate, dueDate: ch.dueDate, completed: ch.completed, time: ch.time }
    const updated = patchCard(m, ch.cardId, { ...fields, today })
    if (updated) {
      patchCard(m, ch.cardId, { calHash: calendarHash(updated) })
      continue
    }
    if (trashed.has(ch.cardId)) continue // deleted here while edited there: stays deleted
    const listId = focusList(m, CALENDAR_LIST, '#a78bfa', true)
    if (!listId) continue
    const card = newCard(listId, { ...fields, id: ch.cardId, completedAt: ch.completed ? today : null })
    addCard(m, listId, { ...card, calHash: calendarHash(card) })
  }
}

/** Beamup items waiting in the inbox, applied like the app's ingestInbox (without the alien's rewards). */
export function ingestInbox(m: Model, items: Json[], tz: string) {
  const today = localDate(new Date().toISOString(), tz)
  const all = () => lists(m).flatMap((l) => l.data.cards as Json[])
  for (const t of items) {
    if (!t || typeof t.id !== 'string') continue
    if (String(t.type).startsWith('event.')) {
      const sourceId = 'ev:' + t.id
      const existing = all().find((c) => c.sourceId === sourceId)
      if (t.type === 'event.deleted') {
        if (existing) trashCard(m, existing.id, true)
        continue
      }
      const start = new Date(t.start ?? '')
      let end = new Date(t.end ?? '')
      if (typeof t.title !== 'string' || isNaN(start.getTime())) continue
      if (isNaN(end.getTime()) || end < start) end = start
      const last = new Date(Math.max(start.getTime(), end.getTime() - (t.allDay ? 86400000 : 1)))
      const first = localDate(start.toISOString(), tz)
      const due = localDate(last.toISOString(), tz)
      const fields = {
        title: t.title,
        description: String(t.notes ?? '').trim(),
        startDate: first !== due ? first : null,
        dueDate: due,
        time: t.allDay ? null : `${localTime(start.toISOString(), tz)}–${localTime(end.toISOString(), tz)}`,
      }
      if (existing) patchCard(m, existing.id, { ...fields, archived: false })
      else {
        const listId = focusList(m, CALENDAR_LIST, '#a78bfa', true)
        if (listId) addCard(m, listId, newCard(listId, { ...fields, sourceId }))
      }
      continue
    }
    if (typeof t.title !== 'string') continue
    const existing = all().find((c) => c.sourceId === t.id)
    const description = [String(t.note ?? '').trim(), t.tags?.length ? t.tags.map((x: string) => '#' + x).join(' ') : ''].filter(Boolean).join('\n\n')
    const due = typeof t.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.due) ? t.due : null
    if (existing) {
      patchCard(m, existing.id, t.type === 'todo.deleted' ? { archived: true } : { title: t.title, description, dueDate: due, completed: !!t.done, archived: false, today })
      continue
    }
    if (t.type === 'todo.deleted') continue
    const listId =
      (t.priority === 'high' ? focusList(m, '急件', null, false) : null) ?? focusList(m, '待辦', null, false) ?? focusList(m, '待辦', '#fbbf24', true)
    if (listId) addCard(m, listId, newCard(listId, { title: t.title, description, dueDate: due, completed: !!t.done, completedAt: t.done ? today : null, sourceId: t.id }))
  }
}

