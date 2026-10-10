/**
 * Three-way merge of a stored document: `base` is the version both sides started from, `local` this
 * device's edit, `remote` what another writer saved meanwhile. Both sides' changes are kept; where both
 * changed the same field, this device's edit wins.
 *
 * Lists of ids (cardIds, listIds, boardOrder) and lists of items with an id (cards, trash, activity…)
 * merge by item: one side adding a card and the other moving a different card both survive. Without
 * this, saving one device's copy of a list would undo the other's change, e.g. a card moved in from
 * another list vanishing from both.
 */

type Json = unknown
type Obj = Record<string, Json>

const eq = (a: Json, b: Json) => a === b || JSON.stringify(a) === JSON.stringify(b)
const isObj = (v: Json): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

/** An item's identity inside an array, or undefined when the array isn't a set of identifiable items. */
function keyOf(v: Json): string | undefined {
  if (typeof v === 'string') return 's:' + v
  if (!isObj(v)) return undefined
  if (typeof v.id === 'string') return 'i:' + v.id
  // Trash items are identified by their card.
  if (isObj(v.card) && typeof v.card.id === 'string') return 'c:' + v.card.id
  return undefined
}

const keyed = (a: Json[]) => a.every((v) => keyOf(v) !== undefined)

function mergeArrays(base: Json[], local: Json[], remote: Json[]): Json[] {
  const b = new Map(base.map((v) => [keyOf(v)!, v]))
  const l = new Map(local.map((v) => [keyOf(v)!, v]))
  const out = remote
    .filter((v) => {
      const k = keyOf(v)!
      return !(b.has(k) && !l.has(k)) // removed here
    })
    .map((v) => {
      const k = keyOf(v)!
      return l.has(k) ? merge3(b.get(k), l.get(k), v) : v
    })
  // Added here: placed after the item it follows locally (or first).
  local.forEach((v, i) => {
    const k = keyOf(v)!
    if (b.has(k) || out.some((x) => keyOf(x) === k)) return
    let at = 0
    for (let j = i - 1; j >= 0; j--) {
      const prev = out.findIndex((x) => keyOf(x) === keyOf(local[j]))
      if (prev >= 0) {
        at = prev + 1
        break
      }
    }
    out.splice(at, 0, v)
  })
  // Reordered here (e.g. a card dragged within the list): follow this device's order for shared items.
  if (!eq(base.map(keyOf), local.map(keyOf))) {
    const order = new Map(local.map((v, i) => [keyOf(v)!, i]))
    const shared = out.filter((v) => order.has(keyOf(v)!)).sort((x, y) => order.get(keyOf(x)!)! - order.get(keyOf(y)!)!)
    let n = 0
    return out.map((v) => (order.has(keyOf(v)!) ? shared[n++] : v))
  }
  return out
}

export function merge3(base: Json, local: Json, remote: Json): Json {
  if (eq(local, base)) return remote
  if (eq(remote, base) || eq(local, remote)) return local
  if (isObj(local) && isObj(remote)) {
    const b = isObj(base) ? base : {}
    const out: Obj = {}
    for (const k of new Set([...Object.keys(remote), ...Object.keys(local)])) {
      const v = merge3(b[k], local[k], remote[k])
      if (v !== undefined) out[k] = v
    }
    return out
  }
  if (Array.isArray(local) && Array.isArray(remote) && keyed(local) && keyed(remote)) {
    const b = Array.isArray(base) && keyed(base) ? base : []
    return mergeArrays(b, local, remote)
  }
  return local
}

/** Merges a stored document (as JSON text, without `_rev`); a list's cards are kept in step with its cardIds. */
export function mergeDoc(id: string, base: string | undefined, local: string, remote: string): string {
  const merged = merge3(base === undefined ? undefined : JSON.parse(base), JSON.parse(local), JSON.parse(remote)) as Obj
  if (id.startsWith('list-') && isObj(merged.list) && Array.isArray(merged.list.cardIds) && Array.isArray(merged.cards)) {
    const cards = new Map((merged.cards as Obj[]).map((c) => [c.id as string, c]))
    const cardIds = (merged.list.cardIds as string[]).filter((c) => cards.has(c))
    merged.list = { ...merged.list, cardIds }
    merged.cards = cardIds.map((c) => cards.get(c))
  }
  return JSON.stringify(merged)
}
