import { useEffect, useRef, useState } from 'react'
import type { AppState } from './types'
import type { Action } from './store'

/**
 * Cloud sync through the claude.ai artifact database.
 *
 * Everything lives in the viewer's private subtree `data/users/<id>/`, split into small documents
 * (each is capped at 256 KiB): `meta` (theme, members, board order, activity), one `board-<id>` per
 * board and one `list-<id>` per list holding that list's cards. Any device signed in to the same
 * claude.ai account sees the same documents, live.
 *
 * Merging is per document: a remote change is applied unless this device changed the same document
 * since the last sync, in which case the local version is kept and written back (last writer wins).
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
    },
  }
  for (const b of Object.values(s.boards)) docs['board-' + b.id] = { board: b }
  for (const l of Object.values(s.lists)) docs['list-' + l.id] = { list: l, cards: l.cardIds.map((id) => s.cards[id]).filter(Boolean) }
  return docs
}

export function fromDocs(docs: Record<string, Body>): AppState | null {
  const meta = docs.meta as Partial<AppState> | undefined
  if (!meta) return null
  const state = { ...meta, boards: {}, lists: {}, cards: {} } as AppState
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
  return state.boards[state.focusBoardId] ? state : null
}

const stringify = (docs: Record<string, Body>) => Object.fromEntries(Object.entries(docs).map(([k, v]) => [k, JSON.stringify(v)]))

export function useCloudSync(state: AppState, dispatch: (a: Action) => void) {
  const [status, setStatus] = useState<SyncStatus>(() => (typeof window !== 'undefined' && window.claude ? 'connecting' : 'local'))
  const [error, setError] = useState('')
  const stateRef = useRef(state)
  const col = useRef<ClaudeDbCollection | null>(null)
  // JSON of each document as last confirmed in the cloud.
  const synced = useRef<Record<string, string>>({})
  const ready = useRef(false)
  const flushing = useRef(false)
  const again = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

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
        const changed = Object.keys(local).filter((id) => local[id] !== synced.current[id])
        const removed = Object.keys(synced.current).filter((id) => !(id in local))
        if (!changed.length && !removed.length) break
        setStatus('saving')
        // One write at a time per document, as the store asks.
        for (const id of changed) {
          await col.current.doc(id).set(JSON.parse(local[id]))
          synced.current[id] = local[id]
        }
        for (const id of removed) {
          await col.current.doc(id).delete()
          delete synced.current[id]
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
      const claude = window.claude
      if (!claude) return
      const [db, user] = await Promise.all([claude.use('db'), claude.use('user')])
      const uid = user ? await user.id() : null
      if (cancelled) return
      if (!db || !uid) {
        setStatus('local')
        return
      }
      const c = db.collection('data/users/' + uid)
      col.current = c
      unsub = c.onSnapshot(
        (snap) => {
          const remote: Record<string, string> = {}
          for (const d of snap.docs) if (d.exists) remote[d.id] = JSON.stringify(d.data())

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
            const next = fromDocs(Object.fromEntries(Object.entries(remote).map(([k, v]) => [k, JSON.parse(v)])))
            if (next) dispatch({ type: 'hydrate', state: next })
            setStatus('synced')
            return
          }

          const local = stringify(toDocs(stateRef.current))
          const merged: Record<string, string> = {}
          for (const id of new Set([...Object.keys(remote), ...Object.keys(local), ...Object.keys(synced.current)])) {
            const localChanged = local[id] !== synced.current[id]
            const value = localChanged ? local[id] : remote[id]
            if (value !== undefined) merged[id] = value
          }
          synced.current = remote
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
