import { useEffect, useRef, useState } from 'react'
import { Flame, X } from 'lucide-react'
import type { AppState, Card } from '../types'
import type { Action } from '../store'
import { isOverdue, today } from '../store'
import {
  ACCESSORIES,
  ALIENS,
  MOOD_TEXT,
  character,
  drawAccessory,
  drawAlienPreview,
  isLive,
  mountMascot,
  petEnergy as energyNow,
  petLevel as levelInfo,
  petMood as mood,
  setLiveMascot,
} from '../alien'
import type { Mascot } from '../alien'

const WEEK = ['日', '一', '二', '三', '四', '五', '六']

function openCards(state: AppState): Card[] {
  return Object.values(state.cards).filter((c) => !c.archived && !c.completed)
}

/** What the alien can bring up about your boards. */
function contextLines(state: AppState): string[] {
  const open = openCards(state)
  const t = today()
  const lines: string[] = []
  const overdue = open.filter(isOverdue).length
  const dueToday = open.filter((c) => c.dueDate === t).length
  if (overdue) lines.push(`有 ${overdue} 張卡片逾期了！`)
  if (dueToday) lines.push(`今天有 ${dueToday} 張卡片到期`)
  const urgent = state.boards[state.focusBoardId].listIds.map((id) => state.lists[id]).find((l) => l.title.includes('急'))
  const urgentCount = urgent ? urgent.cardIds.filter((id) => !state.cards[id].archived && !state.cards[id].completed).length : 0
  if (urgentCount) lines.push(`「${urgent!.title}」裡還有 ${urgentCount} 張`)
  lines.push(open.length ? `還有 ${open.length} 張卡片沒完成，加油！` : '卡片都完成了，好厲害！')
  return lines
}

export function AlienHero({ state, dispatch, greeting }: { state: AppState; dispatch: (a: Action) => void; greeting: string }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLSpanElement>(null)
  const counterRef = useRef<HTMLSpanElement>(null)
  const stateRef = useRef(state)
  const [picker, setPicker] = useState(false)
  const mascotRef = useRef<Mascot | null>(null)
  const pet = state.pet

  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Mount the canvas once; it reads live data through the callbacks.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const m = mountMascot(stage, {
      alien: stateRef.current.pet.alien,
      status: statusRef.current,
      counter: counterRef.current,
      mood: () => mood(energyNow(stateRef.current.pet)),
      accessory: () => stateRef.current.pet.equipped,
      lines: () => [`${greeting}！${contextLines(stateRef.current)[0]}`, ...contextLines(stateRef.current)],
    })
    setLiveMascot(m)
    mascotRef.current = m
    return () => {
      m.stop()
      stage.replaceChildren()
      if (isLive(m)) setLiveMascot(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const energy = energyNow(pet)
  const lv = levelInfo(pet.xp)
  const now = new Date()
  const open = openCards(state)
  const def = character(pet.alien)

  return (
    <section className="alien-hero">
      <div className="alien-hero-text">
        <p className="eyebrow">
          {now.getMonth() + 1}月{now.getDate()}日 星期{WEEK[now.getDay()]}
        </p>
        <h1>{greeting}！</h1>
        <p className="muted">
          {open.length ? `還有 ${open.length} 張卡片沒完成。` : '所有卡片都完成了。'}完成卡片、勾待辦清單、寫留言，都會餵 {def.name}{' '}
          一顆星星。
        </p>
        <div className="pet-stats">
          <span className="pet-lv">Lv.{lv.level}</span>
          <span className="pet-bar xp" title={`經驗值：再 ${lv.toNext} 點升級`}>
            <i style={{ width: `${(lv.into / lv.need) * 100}%` }} />
          </span>
          <span className={'pet-bar energy ' + mood(energy)} title={`能量 ${energy}`}>
            <i style={{ width: `${energy}%` }} />
          </span>
          <span className="pet-mood">{MOOD_TEXT[mood(energy)]}</span>
          <span className="pet-streak" title="連續天數">
            <Flame size={14} />
            {pet.streak}
          </span>
        </div>
      </div>

      <div className="alien-stage-card">
        <div className="alien-stage" ref={stageRef} />
        <div className="alien-cap">
          <button className="alien-switch" onClick={() => setPicker(true)} title="換外星人、戴配件">
            <b>{def.name}</b> ▾
          </button>
          <span ref={statusRef} className="muted" />
          <span ref={counterRef} className="muted pokes" />
        </div>
      </div>

      {picker && (
        <AlienPicker
          state={state}
          onClose={() => setPicker(false)}
          onAlien={(id) => {
            dispatch({ type: 'setAlien', alien: id })
            mascotRef.current?.swap(id)
          }}
          onEquip={(id) => dispatch({ type: 'equip', accessory: id })}
        />
      )}
    </section>
  )
}

function AlienPicker({
  state,
  onClose,
  onAlien,
  onEquip,
}: {
  state: AppState
  onClose: () => void
  onAlien: (id: string) => void
  onEquip: (id: string | null) => void
}) {
  const pet = state.pet
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    root.current
      ?.querySelectorAll<HTMLCanvasElement>('canvas[data-alien]')
      .forEach((c) => drawAlienPreview(c, c.dataset.alien!, pet.equipped))
    root.current?.querySelectorAll<HTMLCanvasElement>('canvas[data-acc]').forEach((c) => drawAccessory(c, c.dataset.acc!))
  }, [pet.alien, pet.equipped])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal narrow alien-picker" ref={root} onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close btn close-btn" onClick={onClose}>
          <X size={16} /> 關閉
        </button>
        <h3>選一隻外星人</h3>
        <div className="alien-grid">
          {ALIENS.map((a) => (
            <button key={a.id} className={'alien-card' + (a.id === pet.alien ? ' on' : '')} onClick={() => onAlien(a.id)}>
              <canvas data-alien={a.id} width={16} height={16} />
              <b>{a.name}</b>
              <small>{a.desc}</small>
            </button>
          ))}
        </div>
        <h4>配件</h4>
        <div className="acc-grid">
          <button className={'acc-card' + (!pet.equipped ? ' on' : '')} onClick={() => onEquip(null)}>
            <span className="acc-none">—</span>
            <small>不戴</small>
          </button>
          {ACCESSORIES.map((acc) => {
            const unlocked = pet.unlocked.includes(acc.id)
            return (
              <button
                key={acc.id}
                className={'acc-card' + (pet.equipped === acc.id ? ' on' : '') + (unlocked ? '' : ' locked')}
                disabled={!unlocked}
                onClick={() => onEquip(acc.id)}
                title={unlocked ? acc.name : `${acc.hint}（${Math.min(acc.stat(pet), acc.goal)}/${acc.goal}）`}
              >
                <canvas data-acc={acc.id} />
                <small>{unlocked ? acc.name : acc.hint}</small>
              </button>
            )
          })}
        </div>
        <p className="muted small">戳他會有反應，連戳會頭暈；長按是摸摸頭；點空地他會走過去。完成卡片會讓他吃星星、升級、解鎖配件。</p>
      </div>
    </div>
  )
}
