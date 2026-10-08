import { useState } from 'react'
import { Upload } from 'lucide-react'
import type { BoardBackground } from '../types'
import { BACKGROUND_PRESETS, backgroundCss, defaultBackground } from '../theme'
import { BOARD_COLORS } from '../store'
import { ColorPicker, Segmented, Slider } from './controls'

/** Downscale an uploaded image so it fits in browser storage and in one synced document (256 KiB). */
function fileToDataUrl(file: File, maxSize = 1280): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(img.src)
      resolve(canvas.toDataURL('image/jpeg', 0.72))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export function BackgroundEditor({ value, onChange }: { value: BoardBackground; onChange: (patch: Partial<BoardBackground>) => void }) {
  const [error, setError] = useState('')
  return (
    <div className="bg-editor">
      <div className="bg-presets">
        {BACKGROUND_PRESETS.map((p) => {
          const bg = { ...defaultBackground('#000'), ...p.bg }
          return (
            <button
              key={p.name}
              className="bg-preset"
              title={p.name}
              style={{ background: backgroundCss(bg) }}
              onClick={() => onChange(p.bg)}
            />
          )
        })}
      </div>
      <Segmented
        value={value.type}
        onChange={(type) => onChange({ type })}
        options={[
          { value: 'color', label: '純色' },
          { value: 'gradient', label: '漸層' },
          { value: 'image', label: '圖片' },
        ]}
      />
      <div className="field-label">{value.type === 'gradient' ? '起始色' : '底色'}</div>
      <ColorPicker value={value.color} swatches={BOARD_COLORS} onChange={(color) => onChange({ color })} />
      {value.type === 'gradient' && (
        <>
          <div className="field-label">結束色</div>
          <ColorPicker value={value.color2} swatches={BOARD_COLORS} onChange={(color2) => onChange({ color2 })} />
          <Slider label="角度" value={value.angle} min={0} max={360} step={5} unit="°" onChange={(angle) => onChange({ angle })} />
        </>
      )}
      {value.type === 'image' && (
        <>
          <div className="field-label">圖片網址</div>
          <input
            className="full"
            placeholder="https://…"
            defaultValue={value.image.startsWith('data:') ? '' : value.image}
            onBlur={(e) => onChange({ image: e.target.value.trim() })}
          />
          <label className="btn upload">
            <Upload size={14} /> 上傳圖片
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                try {
                  onChange({ image: await fileToDataUrl(file) })
                  setError('')
                } catch {
                  setError('無法讀取這張圖片')
                }
              }}
            />
          </label>
          {error && <div className="error-text">{error}</div>}
        </>
      )}
    </div>
  )
}
