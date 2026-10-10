// What a card puts on the calendar, fingerprinted; when it changes the card is written to the calendar again.
// Shared by the app (src/store.ts) and the calendar function, so both agree on which cards need writing.

export interface HashableCard {
  title: string
  description: string
  startDate: string | null
  dueDate: string | null
  completed: boolean
  archived: boolean
  time?: string | null
}

export function calendarHash(c: HashableCard): string | null {
  if (c.archived || !(c.startDate || c.dueDate)) return null
  // The time joins in only when set, so cards without one keep the fingerprint they already have.
  const s = JSON.stringify([c.title, c.description, c.startDate, c.dueDate, c.completed, ...(c.time ? [c.time] : [])])
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(36) + s.length.toString(36)
}
