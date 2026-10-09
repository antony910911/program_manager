import { useEffect, useState } from 'react'
import { Monitor, Moon, Plus, RotateCcw, Sun, Trash2, X } from 'lucide-react'
import type { AppState, Theme } from '../types'
import type { Action } from '../store'
import { ACCENT_SWATCHES, FONT_NAMES, THEME_PRESETS, defaultTheme, isTheme } from '../theme'
import { ColorPicker, Segmented, Slider, Toggle } from './controls'
import { DataTransfer } from './DataTransfer'
import { BeamupConnect } from './BeamupConnect'

interface Props {
  state: AppState
  dispatch: (a: Action) => void
  onClose: () => void
  /** Signed-in Supabase user; enables the Beamup connection. */
  userId?: string
}

export function AppearancePanel({ state, dispatch, onClose, userId }: Props) {
  const t = state.theme
  const set = (patch: Partial<Theme>) => dispatch({ type: 'setTheme', patch })
  const [json, setJson] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [newMember, setNewMember] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <h3>外觀設定</h3>
          <button className="btn close-btn" onClick={onClose}>
            <X size={16} /> 關閉
          </button>
        </header>
        <div className="drawer-body">
          {userId && <BeamupConnect userId={userId} />}

          <section>
            <h4>主題預設</h4>
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
            <h4>模式</h4>
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
            <h4>主色</h4>
            <ColorPicker value={t.accent} swatches={ACCENT_SWATCHES} onChange={(accent) => set({ accent })} />
          </section>

          <section>
            <h4>字型</h4>
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

          <section>
            <h4>版面</h4>
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

          <section>
            <h4>卡片</h4>
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

          <section>
            <h4>成員與顏色</h4>
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

          <DataTransfer state={state} dispatch={dispatch} />

          <section>
            <h4>匯出 / 匯入主題</h4>
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

          <button className="btn wide" onClick={() => set(defaultTheme)}>
            <RotateCcw size={14} /> 還原預設外觀
          </button>
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
