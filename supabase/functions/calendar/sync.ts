// Two-way sync between cards and calendar events, independent of the provider and of the database.
//
// Each linked card/event pair is a row in calendar_links holding a fingerprint of the event as last seen.
// pull: list the events from today to WINDOW_DAYS ahead; unknown events become new cards, events whose
//   fingerprint changed update their card, and linked events that vanished from the window are looked up
//   one by one: gone means the card is deleted, otherwise it moved and is updated.
// push: cards the app changed are written to their event (or a new event in the account marked as the
//   target); the event the provider returns is fingerprinted, so the next pull skips our own write.

import type { CalEvent, CardFields, CardPush, Draft } from './events.ts'
import { WINDOW_DAYS, addDays, cardSpan, draftFor, eventHash, localDate, toCardFields, todayIn } from './events.ts'

export interface Provider {
  list(calendarId: string, from: string, to: string, tz: string): Promise<CalEvent[]>
  get(calendarId: string, eventId: string, tz: string): Promise<CalEvent | null>
  create(calendarId: string, draft: Draft, tz: string, cardId: string): Promise<CalEvent>
  /** Null when the event no longer exists. */
  update(calendarId: string, eventId: string, draft: Draft, tz: string): Promise<CalEvent | null>
  remove(calendarId: string, eventId: string): Promise<void>
}

export interface Account {
  id: string
  calendar_id: string | null
  is_target: boolean
}

export interface Link {
  account_id: string
  event_id: string
  card_id: string
  hash: string
  /** The card's dates as last synced, to tell how far a card was moved. */
  card_start: string
  card_due: string
  /** The event's own timing, so timed events keep their hours when a card moves. */
  all_day: boolean
  ev_start: string
  ev_end: string
  /** First day of the event in the user's time zone, to tell "moved out of the window" from "deleted". */
  start_date: string
  recurring: boolean
}

export interface Store {
  linksForAccount(accountId: string): Promise<Link[]>
  linkForCard(cardId: string): Promise<Link | null>
  /** Inserts unless the event is already linked (another device pulled it first); returns the stored link. */
  insertLink(link: Link): Promise<Link>
  saveLink(link: Link): Promise<void>
  deleteLink(accountId: string, eventId: string): Promise<void>
}

export type Change =
  | ({ type: 'upsert'; cardId: string; accountId: string; isNew: boolean } & CardFields)
  | { type: 'delete'; cardId: string }

export interface SyncError {
  accountId?: string
  cardId?: string
  message: string
}

const randomId = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('')
}

function linkFor(accountId: string, cardId: string, ev: CalEvent, tz: string): Link {
  const f = toCardFields(ev, tz)
  return {
    account_id: accountId,
    event_id: ev.id,
    card_id: cardId,
    hash: eventHash(ev, tz),
    card_start: f.startDate ?? f.dueDate,
    card_due: f.dueDate,
    all_day: ev.allDay,
    ev_start: ev.start,
    ev_end: ev.end,
    start_date: ev.allDay ? ev.start : localDate(ev.start, tz),
    recurring: ev.recurring,
  }
}

export async function pullAccount(account: Account, provider: Provider, store: Store, tz: string): Promise<Change[]> {
  if (!account.calendar_id) return []
  const cal = account.calendar_id
  const from = todayIn(tz)
  const to = addDays(from, WINDOW_DAYS)
  const events = await provider.list(cal, from, to, tz)
  const links = await store.linksForAccount(account.id)
  const byEvent = new Map(links.map((l) => [l.event_id, l]))
  const changes: Change[] = []
  const seen = new Set<string>()

  const changed = async (ev: CalEvent, link: Link) => {
    const next = linkFor(account.id, link.card_id, ev, tz)
    if (next.hash === link.hash) return
    await store.saveLink(next)
    changes.push({ type: 'upsert', cardId: link.card_id, accountId: account.id, isNew: false, ...toCardFields(ev, tz) })
  }

  for (const ev of events) {
    seen.add(ev.id)
    const link = byEvent.get(ev.id)
    if (link) {
      await changed(ev, link)
    } else {
      const stored = await store.insertLink(linkFor(account.id, randomId(), ev, tz))
      changes.push({ type: 'upsert', cardId: stored.card_id, accountId: account.id, isNew: true, ...toCardFields(ev, tz) })
    }
  }

  for (const link of links) {
    if (seen.has(link.event_id) || link.start_date < from || link.start_date > to) continue
    const ev = await provider.get(cal, link.event_id, tz)
    if (ev) await changed(ev, link)
    else {
      await store.deleteLink(account.id, link.event_id)
      changes.push({ type: 'delete', cardId: link.card_id })
    }
  }
  return changes
}

export async function push(
  accounts: Account[],
  providerFor: (account: Account) => Provider,
  store: Store,
  tz: string,
  upserts: CardPush[],
  deletes: string[],
): Promise<{ done: string[]; errors: SyncError[] }> {
  const ready = accounts.filter((a) => a.calendar_id)
  const target = ready.find((a) => a.is_target) ?? ready[0]
  const done: string[] = []
  const errors: SyncError[] = []

  for (const card of upserts) {
    try {
      if (!cardSpan(card)) continue
      const link = await store.linkForCard(card.cardId)
      const owner = link && ready.find((a) => a.id === link.account_id)
      let ev: CalEvent | null = null
      if (link && owner) {
        const current = {
          ev: { id: link.event_id, title: '', description: '', allDay: link.all_day, start: link.ev_start, end: link.ev_end, recurring: link.recurring },
          cardStart: link.card_start,
          cardDue: link.card_due,
        }
        ev = await providerFor(owner).update(owner.calendar_id!, link.event_id, draftFor(card, tz, current)!, tz)
        if (ev) await store.saveLink(linkFor(owner.id, card.cardId, ev, tz))
        else await store.deleteLink(owner.id, link.event_id)
      }
      if (!ev) {
        if (!target) continue
        if (link && !owner) await store.deleteLink(link.account_id, link.event_id)
        ev = await providerFor(target).create(target.calendar_id!, draftFor(card, tz)!, tz, card.cardId)
        await store.saveLink(linkFor(target.id, card.cardId, ev, tz))
      }
      done.push(card.cardId)
    } catch (e) {
      errors.push({ cardId: card.cardId, message: (e as Error).message })
    }
  }

  for (const cardId of deletes) {
    try {
      const link = await store.linkForCard(cardId)
      const owner = link && ready.find((a) => a.id === link.account_id)
      if (link && owner) await providerFor(owner).remove(owner.calendar_id!, link.event_id)
      if (link) await store.deleteLink(link.account_id, link.event_id)
      done.push(cardId)
    } catch (e) {
      errors.push({ cardId, message: (e as Error).message })
    }
  }
  return { done, errors }
}
