import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { LogIn, Mail, SquareKanban } from 'lucide-react'
import { supabase, usesSupabase } from '../supabase'
import { Segmented } from './controls'

/**
 * On the self-hosted site (Supabase configured), require sign-in before the app mounts, so cloud
 * sync starts with the user's own data. Elsewhere (claude.ai, local dev) render the app directly.
 */
export function AuthGate({ children }: { children: (account: { id: string; email: string; signOut: () => void } | null) => ReactNode }) {
  const enabled = usesSupabase()
  const [session, setSession] = useState<Session | null>(null)
  const [checked, setChecked] = useState(!enabled)

  useEffect(() => {
    if (!enabled || !supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecked(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [enabled])

  if (!enabled) return <>{children(null)}</>
  if (!checked) return <div className="auth-page muted">載入中…</div>
  if (!session) return <LoginScreen />
  // Remount the app per user, so sync and local state never mix two accounts.
  return (
    <div key={session.user.id} style={{ display: 'contents' }}>
      {children({ id: session.user.id, email: session.user.email ?? '', signOut: () => void supabase!.auth.signOut() })}
    </div>
  )
}

function LoginScreen() {
  const [mode, setMode] = useState<'signin' | 'signup' | 'link'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const redirect = window.location.origin + window.location.pathname

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMessage(null)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirect } })
        if (error) throw error
        if (!data.session) setMessage({ kind: 'ok', text: `已寄確認信到 ${email}，點信裡的連結後就能登入。` })
      } else {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } })
        if (error) throw error
        setMessage({ kind: 'ok', text: `已寄登入連結到 ${email}，在這台裝置打開信裡的連結即可登入。` })
      }
    } catch (err) {
      const text = (err as Error).message
      setMessage({
        kind: 'error',
        text: /invalid login/i.test(text)
          ? 'Email 或密碼不對。'
          : /not confirmed/i.test(text)
            ? '這個帳號還沒確認，請先點確認信裡的連結。'
            : /already registered/i.test(text)
              ? '這個 Email 已經註冊過了，請改用「登入」。'
              : /password/i.test(text)
                ? '密碼至少要 6 個字元。'
                : `無法完成：${text}`,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand">
          <span className="brand-mark">
            <SquareKanban size={18} />
          </span>
          Program Manager
        </div>
        <p className="muted">登入後，你的看板會在手機、電腦、平板之間同步。</p>
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m)
            setMessage(null)
          }}
          options={[
            { value: 'signin', label: '登入' },
            { value: 'signup', label: '註冊' },
            { value: 'link', label: 'Email 連結' },
          ]}
        />
        <label className="auth-field">
          Email
          <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode !== 'link' && (
          <label className="auth-field">
            密碼
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        <button className="btn primary wide" disabled={busy}>
          {mode === 'link' ? <Mail size={15} /> : <LogIn size={15} />}
          {busy ? '處理中…' : mode === 'signin' ? '登入' : mode === 'signup' ? '建立帳號' : '寄登入連結'}
        </button>
        {mode === 'link' && <p className="muted small">忘記密碼也可以用這個方式登入。</p>}
        {message && <p className={message.kind === 'error' ? 'error-text' : 'ok-text'}>{message.text}</p>}
      </form>
    </main>
  )
}
