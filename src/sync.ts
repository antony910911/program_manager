import { useEffect, useRef, useState } from 'react'
import type { AppState } from './types'
import type { Action } from './store'
import { supabase, supabaseCollection, usesSupabase } from './supabase'

/**
 * Cloud sync through the claude.ai artifact database, or Supabase on the self-hosted site (see supabase.ts).
 *
 * Everything lives in the viewer's private subtree `data/users/<id>/`, split into small documents
 * (each is capped at 256 KiB): `meta` (theme, members, board order, activity), one `board-<id>` per
 * board and one `list-<id>` per list holding that list's cards. Any device signed in to the same
 * account sees the same documents, live.
 *
 * Merging is per document: a remote change is applied unless this device changed the same document
 * since the last sync, in which case the local version is kept and written back (last writer wins).
 *
 * Each stored document carries a revision number `_rev`, one more than the newest revision of it the
 * writer had seen. A snapshot holding an older revision than the one this device last wrote or saw is
 * stale (read before our write landed, or a late echo of an earlier write) and is ignored; otherwise it
 * would undo the edit, e.g. a renamed list jumping back to its old name.
 */

export type SyncStatus = 'local' | 'connecting' | 'synced' | 'saving' | 'error'

type Body = Record<string, unknown>

export function toDocs(s: AppState): Record<string, Body> {
  const docs: Record<string, Body> = {
    meta: {
      version: 1,
      theme: s.theme,
      focusBoardId: s.focusBoardId,
      boardOrder: s.boardOrder,
      members: s.members,
      currentMemberId: s.currentMemberId,
      activity: s.activity.slice(0, 100),
      pet: s.pet,
    },
  }
  // Its own document so a full trash never pushes `meta` past the size cap.
  docs.trash = { items: s.trash }
  for (const b of Object.values(s.boards)) docs['board-' + b.id] = { board: b }
  for (const l of Object.values(s.lists)) docs['list-' + l.id] = { list: l, cards: l.cardIds.map((id) => s.cards[id]).filter(Boolean) }
  return docs
}

export function fromDocs(docs: Record<string, Body>): AppState | null {
  const meta = docs.meta as Partial<AppState> | undefined
  if (!meta) return null
  const state = { ...meta, boards: {}, lists: {}, cards: {}, trash: (docs.trash?.items as AppState['trash']) ?? [] } as AppState
  for (const [id, body] of Object.entries(docs)) {
    if (id.startsWith('board-')) {
      const b = body.board as AppState['boards'][string]
      state.boards[b.id] = b
    } else if (id.startsWith('list-')) {
      const l = body.list as AppState['lists'][string]
      state.lists[l.id] = l
      for (const c of body.cards as AppState['cards'][string][]) state.cards[c.id] = c
    }
  }
  // A card saved in two lists (a move whose second write hadn't landed, see cardsFirst) stays in its own list.
  const seen = new Map<string, number>()
  for (const l of Object.values(state.lists)) for (const c of l.cardIds) seen.set(c, (seen.get(c) ?? 0) + 1)
  for (const l of Object.values(state.lists))
    if (l.cardIds.some((c) => seen.get(c)! > 1 && state.cards[c]?.listId !== l.id))
      state.lists[l.id] = { ...l, cardIds: l.cardIds.filter((c) => seen.get(c)! < 2 || state.cards[c]?.listId === l.id) }
  return state.boards[state.focusBoardId] ? state : null
}

/**
 * Saving order: lists that gained a card go before the rest. A move writes two lists; if the page is
 * suspended between them (switching apps right after a drop), the card is briefly in both, never in neither.
 */
function cardsFirst(ids: string[], local: Record<string, string>, synced: Record<string, string>): string[] {
  const cardsOf = (json: string | undefined) => {
    if (!json) return new Set<string>()
    const body = JSON.parse(json) as { cards?: { id: string }[] }
    return new Set((body.cards ?? []).map((c) => c.id))
  }
  const gains = (id: string) => {
    if (!id.startsWith('list-')) return false
    const before = cardsOf(synced[id])
    return [...cardsOf(local[id])].some((c) => !before.has(c))
  }
  return [...ids.filter(gains), ...ids.filter((id) => !gains(id))]
}

const stringify = (docs: Record<string, Body>) => Object.fromEntries(Object.entries(docs).map(([k, v]) => [k, JSON.stringify(v)]))

/** Splits a stored document into its content (as compared with local docs) and its revision. */
function unwrap(data: Body): { json: string; rev: number } {
  const { _rev, ...body } = data
  return { json: JSON.stringify(body), rev: typeof _rev === 'number' ? _rev : 0 }
}

/** A doc missing from a snapshot this soon after this device created it is a read from before the write. */
const CREATE_GRACE_MS = 2 * 60 * 1000

/** The cloud the app syncs to: claude.ai's artifact database, or Supabase on the self-hosted site. */
async function connectBackend(): Promise<ClaudeDbCollection | null> {
  const claude = window.claude
  if (claude) {
    const [db, user] = await Promise.all([claude.use('db'), claude.use('user')])
    const uid = user ? await user.id() : null
    return db && uid ? db.collection('data/users/' + uid) : null
  }
  if (supabase) {
    const { data } = await supabase.auth.getSession()
    return data.session ? supabaseCollection(data.session.user.id) : null
  }
  return null
}

export function useCloudSync(state: AppState, dispatch: (a: Action) => void) {
  const [status, setStatus] = useState<SyncStatus>(() => (window.claude || usesSupabase() ? 'connecting' : 'local'))
  const [error, setError] = useState('')
  const stateRef = useRef(state)
  const col = useRef<ClaudeDbCollection | null>(null)
  // JSON of each document as last confirmed in the cloud.
  const synced = useRef<Record<string, string>>({})
  const ready = useRef(false)
  const flushing = useRef(false)
  const again = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Revision of each document as last written or seen, and when this device created a document.
  const revs = useRef<Record<string, number>>({})
  const created = useRef<Record<string, number>>({})

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const flush = async () => {
    if (!col.current || !ready.current) return
    if (flushing.current) {
      again.current = true
      return
    }
    flushing.current = true
    try {
      do {
        again.current = false
        const local = stringify(toDocs(stateRef.current))
        const changed = cardsFirst(
          Object.keys(local).filter((id) => local[id] !== synced.current[id]),
          local,
          synced.current,
        )
        const removed = Object.keys(synced.current).filter((id) => !(id in local))
        if (!changed.length && !removed.length) break
        setStatus('saving')
        // One write at a time per document, as the store asks.
        for (const id of changed) {
          const rev = (revs.current[id] ?? 0) + 1
          if (synced.current[id] === undefined) created.current[id] = Date.now()
          await col.current.doc(id).set({ ...JSON.parse(local[id]), _rev: rev })
          synced.current[id] = local[id]
          revs.current[id] = rev
        }
        for (const id of removed) {
          await col.current.doc(id).delete()
          delete synced.current[id]
          delete created.current[id]
        }
      } while (again.current)
      setStatus('synced')
      setError('')
    } catch (e) {
      const err = e as ClaudeDbError
      setStatus('error')
      setError(
        err.code === 'invalid_argument'
          ? '有一份資料太大，無法同步（可能是背景圖片或清單內卡片過多）。'
          : err.code === 'quota_exceeded'
            ? '雲端空間已滿。'
            : '暫時無法連線到雲端，稍後會再試。',
      )
      if (err.code !== 'invalid_argument' && err.code !== 'quota_exceeded') setTimeout(() => void flush(), 5000)
    } finally {
      flushing.current = false
    }
  }

  // Connect once.
  useEffect(() => {
    let unsub: (() => void) | undefined
    let cancelled = false
    void (async () => {
      const c = await connectBackend()
      if (cancelled) return
      if (!c) {
        setStatus('local')
        return
      }
      col.current = c
      unsub = c.onSnapshot(
        (snap) => {
          const remote: Record<string, string> = {}
          const remoteRev: Record<string, number> = {}
          for (const d of snap.docs)
            if (d.exists) {
              const { json, rev } = unwrap(d.data() as Body)
              remote[d.id] = json
              remoteRev[d.id] = rev
            }

          if (!ready.current) {
            // A cached empty answer may not be the truth yet; wait for the server.
            if (snap.empty && snap.metadata.fromCache) return
            ready.current = true
            if (snap.empty) {
              // First use on any device: upload what this device has.
              synced.current = {}
              void flush()
              return
            }
            // The cloud copy wins over whatever this device had stored locally.
            synced.current = remote
            revs.current = { ...remoteRev }
            const next = fromDocs(Object.fromEntries(Object.entries(remote).map(([k, v]) => [k, JSON.parse(v)])))
            if (next) dispatch({ type: 'hydrate', state: next })
            setStatus('synced')
            return
          }

          const local = stringify(toDocs(stateRef.current))
          const merged: Record<string, string> = {}
          const confirmed: Record<string, string> = {}
          for (const id of new Set([...Object.keys(remote), ...Object.keys(local), ...Object.keys(synced.current)])) {
            const localChanged = local[id] !== synced.current[id]
            const known = revs.current[id] ?? 0
            // Older than what this device last wrote or saw: keep ours (and still count it as confirmed).
            const stale =
              remote[id] === undefined
                ? synced.current[id] !== undefined && Date.now() - (created.current[id] ?? 0) < CREATE_GRACE_MS
                : remote[id] !== synced.current[id] && remoteRev[id] < known
            const value = localChanged || stale ? local[id] : remote[id]
            if (value !== undefined) merged[id] = value
            const base = stale ? synced.current[id] : remote[id]
            if (base !== undefined) confirmed[id] = base
            if (!stale && remote[id] !== undefined) revs.current[id] = Math.max(known, remoteRev[id])
          }
          synced.current = confirmed
          const changedFromLocal =
            Object.keys(merged).some((id) => merged[id] !== local[id]) || Object.keys(local).some((id) => !(id in merged))
          if (changedFromLocal) {
            const next = fromDocs(Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, JSON.parse(v)])))
            if (next) dispatch({ type: 'hydrate', state: next })
          }
          void flush()
        },
        () => {
          setStatus('error')
          setError('雲端同步中斷了，重新整理頁面可以重新連線。')
        },
      )
    })()
    return () => {
      cancelled = true
      unsub?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Leaving the app (switching to Beamup, locking the phone) saves right away: the page may be suspended
  // before the usual short delay is up.
  useEffect(() => {
    const now = () => {
      clearTimeout(timer.current)
      void flush()
    }
    const onHide = () => document.visibilityState === 'hidden' && now()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', now)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', now)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Save shortly after each change.
  useEffect(() => {
    if (!ready.current) return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), 600)
    return () => clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return { status, error }
}
