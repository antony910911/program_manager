/**
 * A short, readable record of what cloud sync did on this device (設定 › 同步紀錄), for tracking down
 * cases like a moved card jumping back. Kept in memory only; it starts empty when the app opens.
 */
const MAX = 120
const entries: string[] = []
export const SYNC_LOG_EVENT = 'mothership-sync-log'

const two = (n: number) => String(n).padStart(2, '0')

export function logSync(text: string) {
  const d = new Date()
  entries.unshift(`${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')} ${text}`)
  entries.length = Math.min(entries.length, MAX)
  window.dispatchEvent(new Event(SYNC_LOG_EVENT))
}

export const syncLog = () => [...entries]

/** A document as a person reads it: a list by its title and cards, anything else by its id. */
export function describeDoc(id: string, json: string | undefined, rev?: number): string {
  const r = rev === undefined ? '' : ` r${rev}`
  if (json === undefined) return `${id}${r}（無）`
  if (!id.startsWith('list-')) return `${id}${r}`
  try {
    const body = JSON.parse(json) as { list?: { title?: string }; cards?: { title?: string }[] }
    const cards = (body.cards ?? []).map((c) => String(c.title ?? '').slice(0, 8))
    return `「${body.list?.title ?? id}」${r} [${cards.join('、')}]`
  } catch {
    return `${id}${r}`
  }
}
