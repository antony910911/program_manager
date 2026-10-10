import { createClient } from '@supabase/supabase-js'

/**
 * Supabase backend for the self-hosted site (GitHub Pages / Vercel).
 *
 * Configured at build time with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. The anon key is meant
 * to be public: row level security (see supabase/schema.sql) limits every user to their own rows.
 * Without these variables the app runs as before (claude.ai cloud, or this browser only).
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase = url && key ? createClient(url, key) : null

/** The claude.ai artifact runtime takes precedence when the page runs there. */
export const usesSupabase = () => !!supabase && !window.claude

const TABLE = 'user_docs'

function toDbError(e: { message?: string; code?: string; status?: number } | null): ClaudeDbError {
  const msg = e?.message ?? ''
  if (e?.status === 413 || /too large|payload/i.test(msg)) return { code: 'invalid_argument', message: msg }
  return { code: 'unavailable', message: msg }
}

/**
 * The signed-in user's documents, exposed with the same shape as the artifact database collection
 * so sync.ts can use either. Live updates come from Supabase Realtime, with a full reload whenever
 * the tab becomes visible again to cover anything missed while the device slept.
 */
export function supabaseCollection(userId: string): ClaudeDbCollection {
  const sb = supabase!
  return {
    doc: (id) => ({
      async set(data) {
        const { error } = await sb.from(TABLE).upsert({ user_id: userId, doc_id: id, data, updated_at: new Date().toISOString() })
        if (error) throw toDbError(error)
      },
      async delete() {
        const { error } = await sb.from(TABLE).delete().eq('user_id', userId).eq('doc_id', id)
        if (error) throw toDbError(error)
      },
      async setIf(data, expect) {
        const updated_at = new Date().toISOString()
        const current = async () => {
          const { data: row, error } = await sb.from(TABLE).select('data').eq('user_id', userId).eq('doc_id', id).maybeSingle()
          if (error) throw toDbError(error)
          return (row?.data as Record<string, unknown> | undefined) ?? null
        }
        if (expect === undefined) {
          const { error } = await sb.from(TABLE).insert({ user_id: userId, doc_id: id, data, updated_at })
          if (!error) return { ok: true }
          if (error.code !== '23505') throw toDbError(error)
          return { ok: false, current: await current() }
        }
        if (expect === 0) {
          // Documents saved before revisions existed have no _rev at all.
          const now = await current()
          if (now && typeof now._rev === 'number' && now._rev !== 0) return { ok: false, current: now }
          await this.set(data)
          return { ok: true }
        }
        const { data: rows, error } = await sb
          .from(TABLE)
          .update({ data, updated_at })
          .eq('user_id', userId)
          .eq('doc_id', id)
          .eq('data->>_rev', String(expect))
          .select('doc_id')
        if (error) throw toDbError(error)
        return rows.length ? { ok: true } : { ok: false, current: await current() }
      },
    }),
    onSnapshot(next, onError) {
      const docs = new Map<string, Record<string, unknown>>()
      let loaded = false
      let stopped = false

      const emit = () => {
        if (stopped || !loaded) return
        next({
          docs: [...docs].map(([id, data]) => ({ id, exists: true, data: () => data })),
          empty: docs.size === 0,
          metadata: { fromCache: false, hasPendingWrites: false },
        })
      }

      const reload = async () => {
        const fresh = new Map<string, Record<string, unknown>>()
        for (let from = 0; ; from += 1000) {
          const { data, error } = await sb
            .from(TABLE)
            .select('doc_id, data')
            .eq('user_id', userId)
            .range(from, from + 999)
          if (error) {
            if (!loaded) onError?.(toDbError(error))
            return
          }
          for (const row of data) fresh.set(row.doc_id as string, row.data as Record<string, unknown>)
          if (data.length < 1000) break
        }
        docs.clear()
        for (const [k, v] of fresh) docs.set(k, v)
        loaded = true
        emit()
      }

      const channel = sb
        .channel('user-docs-' + userId)
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: `user_id=eq.${userId}` }, (payload) => {
          if (payload.eventType === 'DELETE') {
            // Delete events carry only the primary key and are not filtered server-side.
            const old = payload.old as { user_id?: string; doc_id?: string }
            if (old.user_id !== userId || !old.doc_id) return
            docs.delete(old.doc_id)
          } else {
            const row = payload.new as { doc_id: string; data: Record<string, unknown> }
            docs.set(row.doc_id, row.data)
          }
          emit()
        })
        .subscribe()

      const onVisible = () => document.visibilityState === 'visible' && void reload()
      document.addEventListener('visibilitychange', onVisible)
      void reload()

      return () => {
        stopped = true
        document.removeEventListener('visibilitychange', onVisible)
        void sb.removeChannel(channel)
      }
    },
  }
}
