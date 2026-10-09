import { useEffect, useRef } from 'react'
import type { Action, InboxTodo } from './store'
import { supabase, usesSupabase } from './supabase'
import type { SyncStatus } from './sync'

/**
 * Todos from Beamup (thought-task-entry) arrive in the Supabase `inbox` table (see supabase/inbox.sql).
 * Each device claims rows by deleting them and reading back what it deleted, so a todo becomes a card
 * once even with several devices open. Only runs after the first cloud load, so hydrate can't drop it.
 */
export function useInbox(userId: string | undefined, status: SyncStatus, dispatch: (a: Action) => void) {
  const ready = !!userId && usesSupabase() && (status === 'synced' || status === 'saving')
  const dispatchRef = useRef(dispatch)
  useEffect(() => {
    dispatchRef.current = dispatch
  }, [dispatch])

  useEffect(() => {
    if (!ready || !supabase || !userId) return
    const sb = supabase
    let busy = false
    let again = false
    const claim = async () => {
      if (busy) return void (again = true)
      busy = true
      do {
        again = false
        const { data, error } = await sb.from('inbox').delete().eq('user_id', userId).select('id, payload')
        if (error || !data?.length) continue
        const items = data
          .sort((a, b) => Number(a.id) - Number(b.id))
          .map((r) => r.payload as InboxTodo)
        dispatchRef.current({ type: 'ingestInbox', items })
      } while (again)
      busy = false
    }
    const channel = sb
      .channel('inbox-' + userId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inbox', filter: `user_id=eq.${userId}` }, () => void claim())
      .subscribe()
    const onVisible = () => document.visibilityState === 'visible' && void claim()
    document.addEventListener('visibilitychange', onVisible)
    void claim()
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      void sb.removeChannel(channel)
    }
  }, [ready, userId])
}

/** "pm1." + base64url(JSON {u: supabase url, k: anon key, s: secret}); pasted into Beamup's settings. */
export function connectionCode(secret: string): string {
  const url = import.meta.env.VITE_SUPABASE_URL as string
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  const json = JSON.stringify({ u: url.replace(/\/+$/, ''), k: key, s: secret })
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)))
  return 'pm1.' + b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function newSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function loadInboxKey(userId: string): Promise<string | null> {
  const { data, error } = await supabase!.from('inbox_keys').select('key').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return (data?.key as string | undefined) ?? null
}

/** Creates the connection secret, or replaces it (which disconnects the old code). */
export async function rotateInboxKey(userId: string): Promise<string> {
  const key = newSecret()
  const { error } = await supabase!.from('inbox_keys').upsert({ user_id: userId, key })
  if (error) throw error
  return key
}
