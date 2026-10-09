// Supabase Edge Function "calendar": two-way sync between Mothership cards and Google / Outlook / iCloud.
// Deployed by .github/workflows/supabase-functions.yml; see DEPLOY.md「連接行事曆」for the setup.
//
// Calendar sign-ins (refresh tokens, iCloud app-specific passwords) live in calendar_accounts, which only
// this function (service role) can read; the app never sees them.

import { createClient } from 'npm:@supabase/supabase-js@2'
import type { CardPush } from './events.ts'
import type { Account, Link, Provider, Store, SyncError, Change } from './sync.ts'
import { pullAccount, push } from './sync.ts'
import { googleAuthUrl, googleExchange, googleProvider } from './google.ts'
import { microsoftAuthUrl, microsoftExchange, microsoftProvider } from './microsoft.ts'
import { icloudProvider } from './icloud.ts'

const env = (k: string) => Deno.env.get(k) ?? ''
const google = env('GOOGLE_CLIENT_ID') && env('GOOGLE_CLIENT_SECRET') ? { clientId: env('GOOGLE_CLIENT_ID'), clientSecret: env('GOOGLE_CLIENT_SECRET') } : null
const microsoft =
  env('MS_CLIENT_ID') && env('MS_CLIENT_SECRET')
    ? { clientId: env('MS_CLIENT_ID'), clientSecret: env('MS_CLIENT_SECRET'), tenant: env('MS_TENANT') || 'common' }
    : null

const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

interface AccountRow extends Account {
  user_id: string
  provider: 'google' | 'microsoft' | 'icloud'
  label: string
  secret: { refreshToken?: string; username?: string; password?: string }
  calendar_name: string | null
  last_sync: string | null
  last_error: string | null
}

type FullProvider = Provider & { calendars(): Promise<{ id: string; name: string }[]>; latestRefreshToken?: () => string }

function providerFor(a: AccountRow): FullProvider {
  if (a.provider === 'google') {
    if (!google) throw new Error('伺服器還沒設定 Google 的連線資訊')
    return googleProvider(google, a.secret.refreshToken!)
  }
  if (a.provider === 'microsoft') {
    if (!microsoft) throw new Error('伺服器還沒設定 Microsoft 的連線資訊')
    return microsoftProvider(microsoft, a.secret.refreshToken!)
  }
  return icloudProvider(a.secret.username!, a.secret.password!)
}

function storeFor(userId: string): Store {
  return {
    async linksForAccount(accountId) {
      const { data, error } = await admin.from('calendar_links').select('*').eq('account_id', accountId)
      if (error) throw error
      return data as Link[]
    },
    async linkForCard(cardId) {
      const { data, error } = await admin.from('calendar_links').select('*').eq('user_id', userId).eq('card_id', cardId).maybeSingle()
      if (error) throw error
      return data as Link | null
    },
    async insertLink(link) {
      const { error } = await admin.from('calendar_links').insert({ ...link, user_id: userId })
      if (error && error.code !== '23505') throw error
      const { data } = await admin.from('calendar_links').select('*').eq('account_id', link.account_id).eq('event_id', link.event_id).single()
      return data as Link
    },
    async saveLink(link) {
      // A card links to one event: drop any older link of this card first.
      await admin.from('calendar_links').delete().eq('user_id', userId).eq('card_id', link.card_id).neq('event_id', link.event_id)
      const { error } = await admin.from('calendar_links').upsert({ ...link, user_id: userId })
      if (error) throw error
    },
    async deleteLink(accountId, eventId) {
      const { error } = await admin.from('calendar_links').delete().eq('account_id', accountId).eq('event_id', eventId)
      if (error) throw error
    },
  }
}

const publicAccount = (a: AccountRow) => ({
  id: a.id,
  provider: a.provider,
  label: a.label,
  calendarId: a.calendar_id,
  calendarName: a.calendar_name,
  isTarget: a.is_target,
  lastSync: a.last_sync,
  lastError: a.last_error,
})

async function accountsOf(userId: string): Promise<AccountRow[]> {
  const { data, error } = await admin.from('calendar_accounts').select('*').eq('user_id', userId).order('created_at')
  if (error) throw error
  return data as AccountRow[]
}

/** Microsoft hands out a new refresh token now and then; keep the newest. */
async function keepToken(a: AccountRow, p: FullProvider) {
  const latest = p.latestRefreshToken?.()
  if (latest && latest !== a.secret.refreshToken) {
    a.secret = { ...a.secret, refreshToken: latest }
    await admin.from('calendar_accounts').update({ secret: a.secret }).eq('id', a.id)
  }
}

/** Picks the main calendar so a new connection works right away; it can be changed in the app. */
function defaultCalendar(provider: AccountRow['provider'], cals: { id: string; name: string }[]) {
  if (provider === 'google') return cals.find((c) => c.name.endsWith('（主要）')) ?? cals[0]
  if (provider === 'microsoft') return cals.find((c) => c.name.endsWith('（預設）')) ?? cals[0]
  return cals.find((c) => /^(行事曆|Calendar|家庭|Home)$/i.test(c.name)) ?? cals[0]
}

async function connect(userId: string, body: Record<string, string>) {
  let row: Omit<AccountRow, 'id' | 'calendar_id' | 'calendar_name' | 'is_target' | 'last_sync' | 'last_error'>
  if (body.provider === 'google') {
    if (!google) throw new Error('伺服器還沒設定 Google 的連線資訊（GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET）')
    const r = await googleExchange(google, body.code, body.redirectUri)
    row = { user_id: userId, provider: 'google', label: r.label, secret: { refreshToken: r.refreshToken } }
  } else if (body.provider === 'microsoft') {
    if (!microsoft) throw new Error('伺服器還沒設定 Microsoft 的連線資訊（MS_CLIENT_ID / MS_CLIENT_SECRET）')
    const r = await microsoftExchange(microsoft, body.code, body.redirectUri)
    row = { user_id: userId, provider: 'microsoft', label: r.label, secret: { refreshToken: r.refreshToken } }
  } else if (body.provider === 'icloud') {
    const username = (body.username ?? '').trim()
    const password = (body.password ?? '').replace(/\s/g, '')
    if (!username || !password) throw new Error('請輸入 Apple ID 和 App 專用密碼')
    row = { user_id: userId, provider: 'icloud', label: username, secret: { username, password } }
  } else throw new Error('不支援的行事曆')

  const probe = providerFor(row as AccountRow)
  const cals = await probe.calendars()
  if (!cals.length) throw new Error('這個帳號沒有可以寫入的行事曆')
  const first = defaultCalendar(row.provider, cals)
  const existing = await accountsOf(userId)
  const { data, error } = await admin
    .from('calendar_accounts')
    .insert({ ...row, calendar_id: first.id, calendar_name: first.name, is_target: existing.length === 0 })
    .select('*')
    .single()
  if (error) throw error
  return { account: publicAccount(data as AccountRow), calendars: cals }
}

async function sync(userId: string, tz: string, upserts: CardPush[], deletes: string[]) {
  const accounts = await accountsOf(userId)
  const store = storeFor(userId)
  const providers = new Map<string, FullProvider>()
  const p = (a: Account) => {
    const row = a as AccountRow
    if (!providers.has(row.id)) providers.set(row.id, providerFor(row))
    return providers.get(row.id)!
  }
  const pushed = await push(accounts, p, store, tz, upserts, deletes)
  const changes: Change[] = []
  const errors: SyncError[] = [...pushed.errors]
  for (const a of accounts) {
    try {
      changes.push(...(await pullAccount(a, p(a), store, tz)))
      a.last_error = null
    } catch (e) {
      a.last_error = (e as Error).message
      errors.push({ accountId: a.id, message: a.last_error })
    }
    a.last_sync = new Date().toISOString()
    await admin.from('calendar_accounts').update({ last_sync: a.last_sync, last_error: a.last_error }).eq('id', a.id)
    if (providers.has(a.id)) await keepToken(a, providers.get(a.id)!)
  }
  return { done: pushed.done, changes, errors, accounts: accounts.map(publicAccount) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const body = await req.json()
    if (body.action === 'config')
      return reply({ google: !!google, microsoft: !!microsoft })

    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: auth } = await admin.auth.getUser(jwt)
    const userId = auth.user?.id
    if (!userId) return reply({ error: '請先登入' }, 401)

    switch (body.action) {
      case 'authUrl': {
        if (body.provider === 'google' && google) return reply({ url: googleAuthUrl(google, body.redirectUri, body.state) })
        if (body.provider === 'microsoft' && microsoft) return reply({ url: microsoftAuthUrl(microsoft, body.redirectUri, body.state) })
        return reply({ error: '伺服器還沒設定這個行事曆的連線資訊' }, 400)
      }
      case 'connect':
        return reply(await connect(userId, body))
      case 'status':
        return reply({ accounts: (await accountsOf(userId)).map(publicAccount) })
      case 'calendars': {
        const a = (await accountsOf(userId)).find((x) => x.id === body.accountId)
        if (!a) return reply({ error: '找不到這個行事曆帳號' }, 404)
        return reply({ calendars: await providerFor(a).calendars() })
      }
      case 'update': {
        const a = (await accountsOf(userId)).find((x) => x.id === body.accountId)
        if (!a) return reply({ error: '找不到這個行事曆帳號' }, 404)
        if (body.isTarget) await admin.from('calendar_accounts').update({ is_target: false }).eq('user_id', userId)
        const patch: Record<string, unknown> = {}
        if (body.isTarget !== undefined) patch.is_target = !!body.isTarget
        if (body.calendarId && body.calendarId !== a.calendar_id) {
          // Another calendar: start its pairing over; existing cards stay as they are.
          patch.calendar_id = body.calendarId
          patch.calendar_name = body.calendarName ?? null
          await admin.from('calendar_links').delete().eq('account_id', a.id)
        }
        await admin.from('calendar_accounts').update(patch).eq('id', a.id)
        return reply({ accounts: (await accountsOf(userId)).map(publicAccount) })
      }
      case 'disconnect': {
        await admin.from('calendar_accounts').delete().eq('user_id', userId).eq('id', body.accountId)
        const rest = await accountsOf(userId)
        if (rest.length && !rest.some((a) => a.is_target)) await admin.from('calendar_accounts').update({ is_target: true }).eq('id', rest[0].id)
        return reply({ accounts: (await accountsOf(userId)).map(publicAccount) })
      }
      case 'sync':
        return reply(await sync(userId, body.tz || 'Asia/Taipei', body.upserts ?? [], body.deletes ?? []))
      default:
        return reply({ error: 'unknown action' }, 400)
    }
  } catch (e) {
    return reply({ error: (e as Error).message ?? String(e) }, 500)
  }
})
