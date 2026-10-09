// Typed entry point for the Beamup alien engine (the ported modules are plain JS under ts-nocheck).
import { ALIENS as RAW_ALIENS, character as rawCharacter } from './aliens'
import { drawAccessory as rawDrawAccessory, drawAlienPreview as rawDrawAlienPreview, mountMascot as rawMount, queueCheer } from './mascot'
import { ACCESSORIES as RAW_ACCESSORIES, MOOD_TEXT as RAW_MOOD_TEXT, energyNow, levelInfo, mood } from './pet'
import type { PetState } from '../types'

export interface Mascot {
  stop(): void
  feed(text: string): void
  play(name: string): void
  swap(id: string): void
}

export interface MascotOptions {
  alien?: string
  lines?: () => string[]
  mood?: () => string
  accessory?: () => string | null
  status?: HTMLElement | null
  counter?: HTMLElement | null
  onSwap?: (id: string) => void
}

export const mountMascot = rawMount as (stage: HTMLElement, opts: MascotOptions) => Mascot
export const drawAlienPreview = rawDrawAlienPreview as (canvas: HTMLCanvasElement, id: string, accessory?: string | null) => void
export const drawAccessory = rawDrawAccessory as (canvas: HTMLCanvasElement, id: string) => void
export const character = rawCharacter as (id: string) => { name: string; desc: string; intro: string }
export const ALIENS = RAW_ALIENS as { id: string; name: string; desc: string }[]
export const ACCESSORIES = RAW_ACCESSORIES as { id: string; name: string; hint: string; goal: number; stat: (p: PetState) => number }[]
export const MOOD_TEXT = RAW_MOOD_TEXT as Record<string, string>
export const petEnergy = energyNow as (pet: PetState) => number
export const petLevel = levelInfo as (xp: number) => { level: number; into: number; need: number; toNext: number }
export const petMood = mood as (energy: number) => 'happy' | 'ok' | 'hungry' | 'starving'

let live: Mascot | null = null

/** Track the alien currently on screen, so rewards can play right away. */
export function setLiveMascot(m: Mascot | null) {
  live = m
}
export function isLive(m: Mascot) {
  return live === m
}

/** Celebrate a reward: right away if the alien is on screen, otherwise the next time it shows up. */
export function cheer(text: string) {
  if (live && document.querySelector('.alien-stage canvas')) live.feed(text)
  else queueCheer(text)
}
