import type { BoardBackground, Theme } from './types'

export const defaultTheme: Theme = {
  mode: 'system',
  accent: '#6366f1',
  font: 'sans',
  fontScale: 100,
  radius: 18,
  density: 'comfortable',
  cardStyle: 'shadow',
  listWidth: 280,
  listOpacity: 92,
  labelStyle: 'pill',
  blur: true,
  colorStrength: 80,
  rev: 3,
}

export const THEME_PRESETS: { name: string; theme: Partial<Theme> }[] = [
  { name: '靛藍（預設）', theme: { ...defaultTheme } },
  { name: 'Trello 經典', theme: { accent: '#0c66e4', radius: 12, cardStyle: 'shadow', labelStyle: 'bar', listOpacity: 100, font: 'sans' } },
  { name: '午夜', theme: { mode: 'dark', accent: '#a78bfa', radius: 14, cardStyle: 'glass', listOpacity: 55, blur: true } },
  { name: '森林', theme: { accent: '#16a34a', radius: 10, cardStyle: 'outline', listOpacity: 88, font: 'rounded' } },
  { name: '日落', theme: { accent: '#f97316', radius: 18, cardStyle: 'shadow', listOpacity: 80, font: 'rounded' } },
  {
    name: '極簡',
    theme: { mode: 'light', accent: '#18181b', radius: 12, cardStyle: 'outline', listOpacity: 100, blur: false, font: 'sans' },
  },
  { name: '紙本', theme: { mode: 'light', accent: '#b45309', radius: 12, cardStyle: 'flat', listOpacity: 96, font: 'serif' } },
  { name: '終端機', theme: { mode: 'dark', accent: '#22c55e', radius: 12, cardStyle: 'outline', listOpacity: 70, font: 'mono' } },
]

export const ACCENT_SWATCHES = [
  '#6366f1',
  '#0c66e4',
  '#0891b2',
  '#16a34a',
  '#ca8a04',
  '#f97316',
  '#e11d48',
  '#db2777',
  '#9333ea',
  '#18181b',
]

export const BACKGROUND_PRESETS: { name: string; bg: Partial<BoardBackground> }[] = [
  { name: '海洋', bg: { type: 'gradient', color: '#0c66e4', color2: '#09326c', angle: 135 } },
  { name: '極光', bg: { type: 'gradient', color: '#22d3ee', color2: '#a855f7', angle: 135 } },
  { name: '日落', bg: { type: 'gradient', color: '#f97316', color2: '#db2777', angle: 135 } },
  { name: '森林', bg: { type: 'gradient', color: '#16a34a', color2: '#065f46', angle: 160 } },
  { name: '薰衣草', bg: { type: 'gradient', color: '#c4b5fd', color2: '#6366f1', angle: 120 } },
  { name: '桃子', bg: { type: 'gradient', color: '#fdba74', color2: '#fb7185', angle: 110 } },
  { name: '夜空', bg: { type: 'gradient', color: '#1e1b4b', color2: '#0f172a', angle: 180 } },
  { name: '石墨', bg: { type: 'gradient', color: '#475569', color2: '#1e293b', angle: 145 } },
  { name: '薄荷', bg: { type: 'gradient', color: '#5eead4', color2: '#0ea5e9', angle: 135 } },
  { name: '櫻花', bg: { type: 'gradient', color: '#fbcfe8', color2: '#f472b6', angle: 135 } },
]

/**
 * Palette for list and card colors. Lists and cards never show these at full strength: CSS mixes
 * them with white (or the dark surface in dark mode), so every color, custom ones included,
 * comes out as a soft pastel with readable text. `softPreview` shows the light-mode result.
 */
export const SOFT_COLORS = ['#60a5fa', '#38bdf8', '#2dd4bf', '#4ade80', '#facc15', '#fb923c', '#f87171', '#f472b6', '#a78bfa', '#94a3b8']
export const COVER_COLORS = SOFT_COLORS
/** Share of the chosen color in a list or card, in light and dark mode (the rest is the surface). */
export function tintPercents(strength: number) {
  return { list: strength * 0.7, card: strength, listDark: strength * 0.4, cardDark: strength * 0.55 }
}
export const softPreview = (color: string, kind: 'list' | 'card', strength: number) => shade(color, 1 - tintPercents(strength)[kind] / 100)

export function defaultBackground(color: string): BoardBackground {
  return { type: 'gradient', color, color2: shade(color, -0.35), angle: 135, image: '' }
}

export function backgroundCss(bg: BoardBackground): string {
  if (bg.type === 'image' && bg.image) return `center / cover no-repeat url("${bg.image.replace(/"/g, '%22')}"), ${bg.color}`
  if (bg.type === 'gradient') return `linear-gradient(${bg.angle}deg, ${bg.color}, ${bg.color2})`
  return bg.color
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '')
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Lighten (amount > 0) or darken (amount < 0) a hex color. */
export function shade(hex: string, amount: number): string {
  const rgb = hexToRgb(hex).map((c) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount)))
  return '#' + rgb.map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('')
}

/** Black or white, whichever reads better on top of `hex`. */
export function readableOn(hex: string): string {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.4 ? '#111827' : '#ffffff'
}

const FONTS: Record<Theme['font'], string> = {
  sans: "'Inter', 'Noto Sans TC', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang TC', 'Microsoft JhengHei', sans-serif",
  rounded: "'Nunito', 'M PLUS Rounded 1c', 'Noto Sans TC', ui-rounded, sans-serif",
  serif: "'Noto Serif TC', 'Source Serif 4', Georgia, serif",
  mono: "'JetBrains Mono', 'Noto Sans Mono', ui-monospace, Menlo, monospace",
}

export const FONT_NAMES: Record<Theme['font'], string> = { sans: '現代黑體', rounded: '圓體', serif: '明體', mono: '等寬' }

const DENSITY = { compact: [6, 6], comfortable: [10, 8], spacious: [14, 12] } as const

/** CSS custom properties for the whole app, derived from the theme. */
export function themeVars(t: Theme): Record<string, string> {
  const [pad, gap] = DENSITY[t.density]
  return {
    '--accent': t.accent,
    '--accent-hover': shade(t.accent, -0.12),
    '--accent-soft': `color-mix(in srgb, ${t.accent} 14%, transparent)`,
    '--on-accent': readableOn(t.accent),
    '--font': FONTS[t.font],
    '--font-size': `${(14 * t.fontScale) / 100}px`,
    '--radius': `${t.radius}px`,
    '--radius-sm': `${Math.max(3, Math.round(t.radius * 0.75))}px`,
    '--pad': `${pad}px`,
    '--gap': `${gap}px`,
    '--list-w': `${t.listWidth}px`,
    '--list-alpha': `${t.listOpacity}%`,
    '--blur': t.blur ? '14px' : '0px',
    ...(() => {
      const p = tintPercents(t.colorStrength)
      return {
        '--tint-list-light': `${p.list}%`,
        '--tint-card-light': `${p.card}%`,
        '--tint-list-dark': `${p.listDark}%`,
        '--tint-card-dark': `${p.cardDark}%`,
      }
    })(),
  }
}

export function isTheme(v: unknown): v is Partial<Theme> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export const LIST_COLORS = SOFT_COLORS
