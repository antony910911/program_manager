import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} type="button" className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
}) {
  return (
    <label className="slider">
      <span className="slider-head">
        {label}
        <span className="muted">
          {value}
          {unit}
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

/** Swatch row plus a free color picker and hex field. */
export function ColorPicker({
  value,
  swatches,
  onChange,
  preview,
}: {
  value: string
  swatches: string[]
  onChange: (v: string) => void
  /** How a swatch color will actually look once applied (e.g. softened list colors). */
  preview?: (c: string) => string
}) {
  return (
    <div className="color-picker">
      <div className="swatches">
        {swatches.map((c) => (
          <button
            key={c}
            type="button"
            className={c.toLowerCase() === value.toLowerCase() ? 'swatch on' : 'swatch'}
            style={{ background: preview ? preview(c) : c }}
            onClick={() => onChange(c)}
            title={c}
          />
        ))}
      </div>
      <div className="row">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <input
          className="hex-input"
          defaultValue={value}
          key={value}
          onBlur={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </div>
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" />
    </label>
  )
}

/** Destructive button that asks for a second click instead of a browser confirm() dialog. */
export function ConfirmButton({
  className,
  confirmText,
  onConfirm,
  children,
}: {
  className?: string
  confirmText: string
  onConfirm: () => void
  children: ReactNode
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button
      type="button"
      className={(className ?? '') + (armed ? ' armed' : '')}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      onBlur={() => setArmed(false)}
    >
      {armed ? confirmText : children}
    </button>
  )
}
