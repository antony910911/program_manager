// Minimal typing for the claude.ai artifact runtime (window.claude), used by src/sync.ts.
// Outside claude.ai (npm run dev, a static host) window.claude is undefined and the app stays local-only.

interface ClaudeDbSnapshot {
  id: string
  exists: boolean
  data(): Record<string, unknown> | undefined
}

interface ClaudeDbQuerySnapshot {
  docs: ClaudeDbSnapshot[]
  empty: boolean
  metadata: { fromCache: boolean; hasPendingWrites: boolean }
}

interface ClaudeDbError {
  code: string
  message: string
}

interface ClaudeDbDoc {
  set(data: Record<string, unknown>): Promise<void>
  delete(): Promise<void>
  /**
   * Supabase only: saves `data` only if the stored document's `_rev` is still `expect` (undefined: the
   * document must not exist yet). Otherwise returns the stored document (null: none) to merge with.
   */
  setIf?(data: Record<string, unknown>, expect: number | undefined): Promise<{ ok: true } | { ok: false; current: Record<string, unknown> | null }>
}

interface ClaudeDbCollection {
  doc(id: string): ClaudeDbDoc
  onSnapshot(next: (snap: ClaudeDbQuerySnapshot) => void, error?: (e: ClaudeDbError) => void): () => void
}

interface ClaudeDb {
  collection(path: string): ClaudeDbCollection
}

interface ClaudeUser {
  id(): Promise<string | null>
}

interface Window {
  claude?: {
    use(name: 'db'): Promise<ClaudeDb | null>
    use(name: 'user'): Promise<ClaudeUser | null>
  }
}
