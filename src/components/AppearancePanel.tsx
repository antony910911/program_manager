import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Braces,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  HardDriveDownload,
  LayoutGrid,
  Monitor,
  Moon,
  Palette,
  Plus,
  RotateCcw,
  Sparkles,
  SquareStack,
  Sun,
  Trash2,
  Type,
  Users,
  X,
} from 'lucide-react'
import type { AppState, Theme } from '../types'
import type { Action } from '../store'
import { ACCENT_SWATCHES, FONT_NAMES, THEME_PRESETS, defaultTheme, isTheme } from '../theme'
import { ColorPicker, Segmented, Slider, Toggle } from './controls'
import { DataTransfer } from './DataTransfer'
import { BeamupConnect } from './BeamupConnect'
import { CalendarConnect } from './CalendarConnect'
import type { CalendarAccount } from '../calendar'

interface Props {
  state: AppState
  dispatch: (a: Action) => void
  onClose: () => void
  /** Signed-in Supabase user; enables the Beamup and calendar connections. */
  userId?: string
  calendar?: { accounts: CalendarAccount[] | null; error: string; syncNow: () => void }
}

type Page = 'theme' | 'text' | 'layout' | 'card' | 'calendar' | 'beamup' | 'members' | 'backup' | 'json'

const PAGE_TITLES: Record<Page, string> = {
  theme: '主題與顏色',
  text: '文字',
  layout: '版面',
  card: '卡片',
  calendar: '行事曆同步',
  beamup: 'Beamup',
  members: '成員',
  backup: '備份與搬家',
  json: '主題檔案',
}
const MODE_NAMES: Record<Theme['mode'], string> = { light: '淺色', dark: '深色', system: '跟隨系統' }
const CARD_STYLE_NAMES: Record<Theme['cardStyle'], string> = { shadow: '陰影', flat: '平面', outline: '線框', glass: '玻璃' }
const PROVIDER_SHORT: Record<CalendarAccount['provider'], string> = { google: 'Google', microsoft: 'Outlook', icloud: 'iCloud' }

/** A titled block of rows, like an iOS settings group. */
function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="settings-group">
      <div className="settings-group-title">{title}</div>
      <div className="settings-rows">{children}</div>
    </div>
  )
}

function Row({ icon, color, label, value, onClick }: { icon: ReactNode; color: string; label: string; value?: ReactNode; onClick: () => void }) {
  return (
    <button className="settings-row" onClick={onClick}>
      <span className="settings-icon" style={{ background: color }}>
        {icon}
      </span>
      <span className="settings-label">{label}</span>
      {value !== undefined && <span className="settings-value">{value}</span>}
      <ChevronRight size={16} className="settings-chevron" />
    </button>
  )
}

/** Settings drawer: a menu of grouped rows; each opens its own page. */
export function AppearancePanel({ state, dispatch, onClose, userId, calendar }: Props) {
  const t = state.theme
  const set = (patch: Partial<Theme>) => dispatch({ type: 'setTheme', patch })
  const [json, setJson] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [newMember, setNewMember] = useState('')
  const [page, setPage] = useState<Page | null>(null)

  // Escape goes back a page first, then closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (page) setPage(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, page])

  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          {page ? (
            <button className="settings-back" onClick={() => setPage(null)}>
              <ChevronLeft size={20} /> 設定
            </button>
          ) : (
            <span />
          )}
          <h3>{page ? PAGE_TITLES[page] : '設定'}</h3>
          <button className="btn close-btn" onClick={onClose} aria-label="關閉">
            <X size={16} />
          </button>
        </header>
        <div className="drawer-body" key={page ?? 'home'}>
          {page === null && (
            <div className="settings-home">
              <SettingsGroup title="外觀">
                <Row icon={<Palette size={16} />} color="#ff9500" label="主題與顏色" value={<><i className="dot" style={{ background: t.accent }} />{MODE_NAMES[t.mode]}</>} onClick={() => setPage('theme')} />
                <Row icon={<Type size={16} />} color="#5856d6" label="文字" value={`${FONT_NAMES[t.font]} · ${t.fontScale}%`} onClick={() => setPage('text')} />
                <Row icon={<LayoutGrid size={16} />} color="#34c759" label="版面" value={`圓角 ${t.radius} · 寬 ${t.listWidth}`} onClick={() => setPage('layout')} />
                <Row icon={<SquareStack size={16} />} color="#ff2d55" label="卡片" value={CARD_STYLE_NAMES[t.cardStyle]} onClick={() => setPage('card')} />
              </SettingsGroup>
              {userId && (
                <SettingsGroup title="連接">
                  {calendar && (
                    <Row
                      icon={<CalendarDays size={16} />}
                      color="#ff3b30"
                      label="行事曆同步"
                      value={calendar.accounts?.length ? calendar.accounts.map((a) => PROVIDER_SHORT[a.provider]).join('、') : '未連接'}
                      onClick={() => setPage('calendar')}
                    />
                  )}
                  <Row icon={<Sparkles size={16} />} color="#30b0c7" label="Beamup" value="連接碼" onClick={() => setPage('beamup')} />
                </SettingsGroup>
              )}
              <SettingsGroup title="資料">
                <Row icon={<Users size={16} />} color="#007aff" label="成員" value={`${state.members.length} 人`} onClick={() => setPage('members')} />
                <Row icon={<HardDriveDownload size={16} />} color="#8e8e93" label="備份與搬家" onClick={() => setPage('backup')} />
                <Row icon={<Braces size={16} />} color="#636366" label="主題檔案" value="匯出／匯入" onClick={() => setPage('json')} />
              </SettingsGroup>
            </div>
          )}
          {page === 'theme' && (
            <>
            <section>
              <div className="field-label">主題預設</div>
              <div className="preset-grid">
                {THEME_PRESETS.map((p) => {
                  const accent = p.theme.accent ?? t.accent
                  const dark = p.theme.mode === 'dark'
                  return (
                    <button key={p.name} className="preset" onClick={() => set({ ...defaultTheme, ...p.theme })}>
                      <span
                        className="preset-preview"
                        style={{ background: dark ? '#111827' : '#f1f5f9', borderRadius: Math.min(p.theme.radius ?? 12, 12) }}
                      >
                        <span style={{ background: accent }} />
                        <span style={{ background: dark ? '#374151' : '#fff' }} />
                        <span style={{ background: dark ? '#374151' : '#fff' }} />
                      </span>
                      {p.name}
                    </button>
                  )
                })}
              </div>
            </section>
            <section>
              <div className="field-label">模式</div>
              <Segmented
                value={t.mode}
                onChange={(mode) => set({ mode })}
                options={[
                  {
                    value: 'light',
                    label: (
                      <>
                        <Sun size={14} /> 淺色
                      </>
                    ),
                  },
                  {
                    value: 'dark',
                    label: (
                      <>
                        <Moon size={14} /> 深色
                      </>
                    ),
                  },
                  {
                    value: 'system',
                    label: (
                      <>
                        <Monitor size={14} /> 系統
                      </>
                    ),
                  },
                ]}
              />
            </section>
            <section>
              <div className="field-label">主色</div>
              <ColorPicker value={t.accent} swatches={ACCENT_SWATCHES} onChange={(accent) => set({ accent })} />
            </section>
            <button className="btn wide" onClick={() => set(defaultTheme)}>
              <RotateCcw size={14} /> 還原預設外觀
            </button>
            </>
          )}
          {page === 'text' && (
            <>
            <section>
              <Segmented
                value={t.font}
                onChange={(font) => set({ font })}
                options={(Object.keys(FONT_NAMES) as Theme['font'][]).map((f) => ({ value: f, label: FONT_NAMES[f] }))}
              />
              <Slider
                label="文字大小"
                value={t.fontScale}
                min={85}
                max={125}
                step={5}
                unit="%"
                onChange={(fontScale) => set({ fontScale })}
              />
            </section>
            </>
          )}
          {page === 'layout' && (
            <>
            <section>
              <Slider label="圓角" value={t.radius} min={10} max={28} unit="px" onChange={(radius) => set({ radius })} />
              <Slider
                label="清單寬度"
                value={t.listWidth}
                min={220}
                max={380}
                step={10}
                unit="px"
                onChange={(listWidth) => set({ listWidth })}
              />
              <Slider
                label="清單與卡片顏色飽和度"
                value={t.colorStrength}
                min={20}
                max={100}
                step={5}
                unit="%"
                onChange={(colorStrength) => set({ colorStrength })}
              />
              <Slider
                label="清單不透明度"
                value={t.listOpacity}
                min={0}
                max={100}
                step={5}
                unit="%"
                onChange={(listOpacity) => set({ listOpacity })}
              />
              <div className="field-label">密度</div>
              <Segmented
                value={t.density}
                onChange={(density) => set({ density })}
                options={[
                  { value: 'compact', label: '緊湊' },
                  { value: 'comfortable', label: '適中' },
                  { value: 'spacious', label: '寬鬆' },
                ]}
              />
              <Toggle label="毛玻璃效果" checked={t.blur} onChange={(blur) => set({ blur })} />
            </section>
            </>
          )}
          {page === 'card' && (
            <>
            <section>
              <div className="field-label">卡片樣式</div>
              <Segmented
                value={t.cardStyle}
                onChange={(cardStyle) => set({ cardStyle })}
                options={[
                  { value: 'shadow', label: '陰影' },
                  { value: 'flat', label: '平面' },
                  { value: 'outline', label: '線框' },
                  { value: 'glass', label: '玻璃' },
                ]}
              />
              <div className="field-label">標籤顯示</div>
              <Segmented
                value={t.labelStyle}
                onChange={(labelStyle) => set({ labelStyle })}
                options={[
                  { value: 'pill', label: '顯示文字' },
                  { value: 'bar', label: '色條' },
                ]}
              />
            </section>
            </>
          )}
          {page === 'calendar' && userId && calendar && <CalendarConnect {...calendar} />}
          {page === 'beamup' && userId && <BeamupConnect userId={userId} />}
          {page === 'members' && (
            <>
            <section>
              {state.members.map((m) => (
                <div key={m.id} className="row">
                  <input
                    type="color"
                    value={m.color}
                    onChange={(e) => dispatch({ type: 'updateMember', memberId: m.id, patch: { color: e.target.value } })}
                  />
                  <input
                    value={m.name}
                    onChange={(e) => dispatch({ type: 'updateMember', memberId: m.id, patch: { name: e.target.value } })}
                  />
                  <button
                    className="icon-btn"
                    disabled={m.id === state.currentMemberId}
                    title={m.id === state.currentMemberId ? '無法刪除自己' : '刪除成員'}
                    onClick={() => dispatch({ type: 'deleteMember', memberId: m.id })}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!newMember.trim()) return
                  dispatch({
                    type: 'addMember',
                    name: newMember.trim(),
                    color: ACCENT_SWATCHES[state.members.length % ACCENT_SWATCHES.length],
                  })
                  setNewMember('')
                }}
              >
                <input placeholder="新成員名稱" value={newMember} onChange={(e) => setNewMember(e.target.value)} />
                <button className="btn">
                  <Plus size={14} /> 新增
                </button>
              </form>
            </section>
            </>
          )}
          {page === 'backup' && <DataTransfer state={state} dispatch={dispatch} />}
          {page === 'json' && (
            <>
            <section>
              <div className="row">
                <button className="btn" onClick={() => setJson(JSON.stringify(t, null, 2))}>
                  匯出目前主題
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    try {
                      const parsed: unknown = JSON.parse(json)
                      if (!isTheme(parsed)) throw new Error()
                      set({ ...defaultTheme, ...parsed })
                      setJsonError('')
                    } catch {
                      setJsonError('JSON 格式不正確')
                    }
                  }}
                >
                  套用 JSON
                </button>
              </div>
              <textarea
                className="mono"
                rows={6}
                placeholder="貼上主題 JSON，或按「匯出」取得目前設定，複製分享給別人"
                value={json}
                onChange={(e) => setJson(e.target.value)}
              />
              {jsonError && <div className="error-text">{jsonError}</div>}
            </section>
            </>
          )}
        </div>
        <footer className="drawer-foot">
          <button className="btn primary wide" onClick={onClose}>
            完成
          </button>
        </footer>
      </aside>
    </div>
  )
}
