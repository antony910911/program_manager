import { useEffect, useRef, useState } from 'react'
import { Check, Flame, Lock, X } from 'lucide-react'
import type { AppState, Card } from '../types'
import type { Action } from '../store'
import { isOverdue, today } from '../store'
import {
  ACCESSORIES,
  ALIENS,
  GAINS,
  MOOD_TEXT,
  character,
  drawAccessory,
  drawAlienPreview,
  isLive,
  mountMascot,
  petEnergy as energyNow,
  petLevel as levelInfo,
  petMood as mood,
  pokeCount,
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
          <button className="alien-switch" onClick={() => setPicker(true)} title="外星人小屋：換外星人、戴配件">
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

const DAY_MS = 86_400_000
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** The alien's house (as in Beamup): how it's doing, the days you came, what it has eaten, who to be, what to wear. */
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
  const def = character(pet.alien)
  const lv = levelInfo(pet.xp)
  const energy = energyNow(pet)
  const moodNow = mood(energy)
  const pokes = pokeCount()

  useEffect(() => {
    root.current
      ?.querySelectorAll<HTMLCanvasElement>('canvas[data-alien]')
      .forEach((c) => drawAlienPreview(c, c.dataset.alien!, c.dataset.wear === 'none' ? null : pet.equipped))
    root.current?.querySelectorAll<HTMLCanvasElement>('canvas[data-acc]').forEach((c) => drawAccessory(c, c.dataset.acc!))
  }, [pet.alien, pet.equipped])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // The last five weeks, a row per week starting on Monday (the house is open for a moment; today won't change).
  const [now] = useState(() => new Date())
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) - 28)
  const came = new Set(pet.days)
  const days = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(start.getTime() + i * DAY_MS + 3_600_000) // + 1h: safe across DST changes
    const key = ymd(d)
    return { key, label: `${d.getMonth() + 1}/${d.getDate()}`, on: came.has(key), today: key === ymd(now), future: d > now }
  })

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal narrow alien-house" ref={root} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label={`${def.name} 的小屋`}>
        <header className="house-head">
          <h3>
            <span className="pixel-name">{def.name}</span> 的小屋
          </h3>
          <button className="btn close-btn" onClick={onClose}>
            <X size={16} /> 關閉
          </button>
        </header>

        <section className="house-hero">
          <canvas data-alien={pet.alien} width={16} height={16} />
          <div className="house-meters">
            <div className="meter-row">
              <b>Lv.{lv.level}</b>
              <small>再 {lv.toNext} 點經驗升級</small>
            </div>
            <div className="meter xp" role="progressbar" aria-label="經驗值" aria-valuenow={lv.into} aria-valuemax={lv.need}>
              <i style={{ width: `${(lv.into / lv.need) * 100}%` }} />
            </div>
            <div className="meter-row">
              <span>能量 {energy}</span>
              <small>{MOOD_TEXT[moodNow]}</small>
            </div>
            <div className={'meter energy ' + moodNow} role="progressbar" aria-label="能量" aria-valuenow={energy} aria-valuemax={100}>
              <i style={{ width: `${energy}%` }} />
            </div>
          </div>
        </section>

        <h4>連續使用</h4>
        <section className="house-card streak">
          <div className="streak-top">
            <div className="streak-num">
              <Flame size={20} />
              <b>{pet.streak}</b>
              <span>天</span>
            </div>
            <small>
              最長紀錄 {pet.best} 天
              <br />
              每天打開一次就算
            </small>
          </div>
          <p className="dots-summary">
            <span>
              最近 5 週來了 <b>{days.filter((d) => d.on).length}</b> 天
            </span>
            <span className="dots-legend">
              <i className="on" aria-hidden="true" /> 有來
              <i className="today" aria-hidden="true" /> 今天
            </span>
          </p>
          <div className="dots-head" aria-hidden="true">
            {'一二三四五六日'.split('').map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="dots" aria-hidden="true">
            {days.map((d) => (
              <i key={d.key} className={[d.on && 'on', d.today && 'today', d.future && 'future'].filter(Boolean).join(' ')} title={d.label}>
                {d.on && <Check size={11} strokeWidth={3} />}
              </i>
            ))}
          </div>
        </section>

        <h4>成績</h4>
        <p className="muted stat-note">從有外星人開始一路累計，刪掉卡片或取消完成不會扣回去，所以跟看板上現有的卡片數不一樣。</p>
        <div className="stat-grid">
          <div>
            <b>{pet.stats.todosDone}</b>
            <small>勾掉的卡片和項目</small>
          </div>
          <div>
            <b>{pet.stats.todosAdded}</b>
            <small>新增過的卡片</small>
          </div>
          <div>
            <b>{pet.stats.notes}</b>
            <small>寫過的留言</small>
          </div>
          <div>
            <b>{pokes}</b>
            <small>被戳（這支裝置）</small>
          </div>
        </div>

        <h4>換一隻外星人</h4>
        <div className="alien-grid">
          {ALIENS.map((a) => (
            <button key={a.id} className={'alien-card' + (a.id === pet.alien ? ' on' : '')} onClick={() => onAlien(a.id)} aria-pressed={a.id === pet.alien}>
              {a.id === pet.alien && (
                <span className="pick-badge">
                  <Check size={12} /> 目前
                </span>
              )}
              <canvas data-alien={a.id} width={16} height={16} />
              <b>{a.name}</b>
              <small>{a.desc}</small>
            </button>
          ))}
        </div>

        <h4>配件</h4>
        <div className="acc-grid">
          {ACCESSORIES.map((acc) => {
            const unlocked = pet.unlocked.includes(acc.id)
            const wearing = pet.equipped === acc.id
            const have = Math.min(acc.stat(pet), acc.goal)
            return (
              <button
                key={acc.id}
                className={'acc-card' + (wearing ? ' on' : '') + (unlocked ? '' : ' locked')}
                aria-disabled={!unlocked}
                aria-pressed={wearing}
                onClick={() => unlocked && onEquip(wearing ? null : acc.id)}
              >
                {wearing && (
                  <span className="pick-badge">
                    <Check size={12} /> 戴著
                  </span>
                )}
                <canvas data-acc={acc.id} />
                <b>{acc.name}</b>
                {unlocked ? (
                  <small>{wearing ? '點一下拿下' : '點一下戴上'}</small>
                ) : (
                  <>
                    <small>
                      <Lock size={11} /> {acc.hint}
                    </small>
                    <span className="meter mini" role="progressbar" aria-label={`${acc.name}解鎖進度`} aria-valuenow={have} aria-valuemax={acc.goal}>
                      <i style={{ width: `${(have / acc.goal) * 100}%` }} />
                    </span>
                    <small className="acc-progress">
                      {have}/{acc.goal}
                    </small>
                  </>
                )}
              </button>
            )
          })}
        </div>

        <h4>怎麼餵 {def.name}</h4>
        <ul className="feed-list">
          {Object.values(GAINS).map((g) => (
            <li key={g.label}>
              <span>{g.label}</span>
              <small>
                能量 +{g.energy}・經驗 +{g.xp}
              </small>
            </li>
          ))}
        </ul>
        <p className="muted small">
          能量每小時少 1 點，太久沒來 {def.name} 會餓到垂頭喪氣。在首頁戳他會有反應，連戳會頭暈；長按是摸摸頭；點空地他會走過去。
        </p>
      </div>
    </div>
  )
}
