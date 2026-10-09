// Provider-neutral calendar events and the date math shared by every provider.
// Plain TypeScript with no imports, so it runs both in the Supabase Edge runtime (Deno) and in Node tests.

/** A calendar event as every provider reports it. */
export interface CalEvent {
  id: string
  title: string
  description: string
  allDay: boolean
  /** All-day: YYYY-MM-DD, end exclusive. Timed: ISO instants in UTC. */
  start: string
  end: string
  recurring: boolean
}

/** What a card asks the calendar to show. */
export interface Draft {
  title: string
  description: string
  allDay: boolean
  start: string
  end: string
}

/** The card fields a calendar event maps to (dates are in the user's time zone). */
export interface CardFields {
  title: string
  description: string
  completed: boolean
  startDate: string | null
  dueDate: string
  /** "14:00–15:30" for timed events, shown on the card; null for all-day events. */
  time: string | null
}

/** A card as the app sends it to be written to a calendar. */
export interface CardPush {
  cardId: string
  title: string
  description: string
  startDate: string | null
  dueDate: string | null
  completed: boolean
  /** "14:00–15:30" when the card has a time of day (e.g. from a Beamup event); single-day cards only. */
  time?: string | null
}

export const DONE_MARK = '✓ '

const pad = (n: number) => String(n).padStart(2, '0')

export function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000)
}

/** Wall-clock parts of an instant in a time zone. */
function wall(iso: string, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(iso))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), min: get('minute'), s: get('second') }
}

export function localDate(iso: string, tz: string): string {
  const w = wall(iso, tz)
  return `${w.y}-${pad(w.m)}-${pad(w.d)}`
}

export function localTime(iso: string, tz: string): string {
  const w = wall(iso, tz)
  return `${pad(w.h)}:${pad(w.min)}`
}

/** UTC instant of a wall-clock time ("2026-10-10T14:00:00") in a time zone. */
export function wallToUtc(local: string, tz: string): string {
  const [date, time = '00:00:00'] = local.split('T')
  const [y, m, d] = date.split('-').map(Number)
  const [h, min, s = 0] = time.split(':').map(Number)
  const target = Date.UTC(y, m - 1, d, h, min, s)
  let guess = target
  for (let i = 0; i < 3; i++) {
    const w = wall(new Date(guess).toISOString(), tz)
    const shown = Date.UTC(w.y, w.m - 1, w.d, w.h, w.min, w.s)
    guess += target - shown
  }
  return new Date(guess).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/** Same wall-clock time, `days` later (DST-safe). */
export function shiftInstant(iso: string, days: number, tz: string): string {
  if (!days) return iso
  const w = wall(iso, tz)
  const date = addDays(`${w.y}-${pad(w.m)}-${pad(w.d)}`, days)
  return wallToUtc(`${date}T${pad(w.h)}:${pad(w.min)}:${pad(w.s)}`, tz)
}

export function toCardFields(ev: CalEvent, tz: string): CardFields {
  let first: string, last: string, time: string | null
  if (ev.allDay) {
    first = ev.start
    last = ev.end > ev.start ? addDays(ev.end, -1) : ev.start
    time = null
  } else {
    first = localDate(ev.start, tz)
    // An event ending exactly at midnight belongs to the day before.
    last = localDate(new Date(Math.max(Date.parse(ev.start), Date.parse(ev.end) - 1)).toISOString(), tz)
    time = `${localTime(ev.start, tz)}–${localTime(ev.end, tz)}`
  }
  const done = ev.title.startsWith(DONE_MARK) || ev.title.startsWith('✓')
  return {
    title: done ? ev.title.replace(/^✓\s*/, '') || ev.title : ev.title,
    description: ev.description,
    completed: done,
    startDate: first !== last ? first : null,
    dueDate: last,
    time,
  }
}

/** A short, stable fingerprint, so an unchanged event (including our own writes coming back) is skipped. */
export function fingerprint(value: unknown): string {
  const s = JSON.stringify(value)
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36) + s.length.toString(36)
}

export const eventHash = (ev: CalEvent, tz: string) => fingerprint(toCardFields(ev, tz))

/** Dates a card puts on the calendar: first day and last day (inclusive). */
export function cardSpan(c: Pick<CardPush, 'startDate' | 'dueDate'>): [string, string] | null {
  const first = c.startDate ?? c.dueDate
  const last = c.dueDate ?? c.startDate
  if (!first || !last) return null
  return first <= last ? [first, last] : [last, first]
}

/**
 * The event a card should become. A new card is an all-day event; an existing timed event keeps its
 * times and moves by as many days as the card's dates moved.
 */
export function draftFor(card: CardPush, tz: string, current?: { ev: CalEvent; cardStart: string; cardDue: string }): Draft | null {
  const span = cardSpan(card)
  if (!span) return null
  const title = (card.completed ? DONE_MARK : '') + card.title
  // A single-day card with a time of day is a timed event at that time, in the user's time zone.
  const m = span[0] === span[1] ? /^(\d{2}):(\d{2})[–-](\d{2}):(\d{2})$/.exec(card.time ?? '') : null
  if (m) {
    const start = wallToUtc(`${span[0]}T${m[1]}:${m[2]}:00`, tz)
    let end = wallToUtc(`${span[0]}T${m[3]}:${m[4]}:00`, tz)
    if (end <= start) end = wallToUtc(`${addDays(span[0], 1)}T${m[3]}:${m[4]}:00`, tz)
    return { title, description: card.description, allDay: false, start, end }
  }
  if (current && !current.ev.allDay) {
    return {
      title,
      description: card.description,
      allDay: false,
      start: shiftInstant(current.ev.start, daysBetween(current.cardStart, span[0]), tz),
      end: shiftInstant(current.ev.end, daysBetween(current.cardDue, span[1]), tz),
    }
  }
  return { title, description: card.description, allDay: true, start: span[0], end: addDays(span[1], 1) }
}

/** Today in the user's time zone. */
export const todayIn = (tz: string) => localDate(new Date().toISOString(), tz)

/** How far ahead calendar events are brought in as cards. */
export const WINDOW_DAYS = 90
