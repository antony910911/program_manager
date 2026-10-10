import { useEffect, useReducer } from 'react'
import type { AppState, Board, BoardBackground, Card, Filter, ID, List, Member, PetState, Theme, TrashItem } from './types'
import { gain as petGain, visit as petVisit } from './alien/pet'
import { BACKGROUND_PRESETS, COVER_COLORS, defaultBackground, defaultTheme } from './theme'

const STORAGE_KEY = 'program-manager:v1'

export const uid = () => Math.random().toString(36).slice(2, 10)
/** Format a Date as local YYYY-MM-DD (toISOString would shift by the UTC offset). */
export function ymd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const parseYmd = (date: string) => new Date(date + 'T00:00:00')
export const today = () => ymd(new Date())

export function addDays(date: string, days: number): string {
  const d = parseYmd(date)
  d.setDate(d.getDate() + days)
  return ymd(d)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86400000)
}

export const LABEL_COLORS = ['#61bd4f', '#f2d600', '#ff9f1a', '#eb5a46', '#c377e0', '#0079bf', '#00c2e0', '#ff78cb']
export const BOARD_COLORS = ['#0079bf', '#d29034', '#519839', '#b04632', '#89609e', '#cd5a91', '#4bbf6b', '#00aecc']

/** Initial top lists of split mode; like every list they can be renamed, added or removed. */
export const FOCUS_LISTS: { title: string; color: string }[] = [
  { title: '待辦', color: '#fbbf24' },
  { title: '進行中', color: '#60a5fa' },
  { title: '急件', color: '#f87171' },
]

/** List templates offered when creating a board. */
export const BOARD_TEMPLATES: { name: string; lists: string[] }[] = [
  { name: '空白（自己新增清單）', lists: [] },
  { name: '年度專案（每個專案一個清單）', lists: ['專案 A', '專案 B', '專案 C'] },
  { name: '待辦／進行中／完成', lists: ['待辦', '進行中', '完成'] },
]

function newList(title: string, color: string | null = null): List {
  return { id: uid(), title, cardIds: [], color }
}

function newFocusBoard(): { board: Board; lists: List[] } {
  const lists = FOCUS_LISTS.map((l) => newList(l.title, l.color))
  const board: Board = {
    id: uid(),
    title: '雙層模式',
    color: '#334155',
    background: { ...defaultBackground('#334155'), ...BACKGROUND_PRESETS[7].bg },
    listIds: lists.map((l) => l.id),
    labels: [
      { id: uid(), name: '重要', color: LABEL_COLORS[3] },
      { id: uid(), name: '等待回覆', color: LABEL_COLORS[1] },
      { id: uid(), name: '個人', color: LABEL_COLORS[5] },
    ],
    customFields: [],
  }
  return { board, lists }
}

function newCard(listId: ID, title: string, extra: Partial<Card> = {}): Card {
  return {
    id: uid(),
    listId,
    homeBoardId: null,
    homeListId: null,
    title,
    description: '',
    labelIds: [],
    memberIds: [],
    startDate: null,
    dueDate: null,
    completed: false,
    checklist: [],
    comments: [],
    customFields: {},
    cover: null,
    archived: false,
    createdAt: new Date().toISOString(),
    ...extra,
  }
}

function seed(): AppState {
  const t = today()
  const year = new Date().getFullYear()
  const members = [
    { id: 'm1', name: '我', color: '#0079bf' },
    { id: 'm2', name: 'Alice', color: '#eb5a46' },
    { id: 'm3', name: 'Bob', color: '#61bd4f' },
  ]
  const labels = [
    { id: 'l1', name: '設計', color: LABEL_COLORS[4] },
    { id: 'l2', name: '開發', color: LABEL_COLORS[0] },
    { id: 'l3', name: '待確認', color: LABEL_COLORS[1] },
    { id: 'l4', name: '高優先', color: LABEL_COLORS[3] },
  ]
  // A yearly board: one list per project.
  const lists: List[] = [
    newList('官網改版', '#a78bfa'),
    newList('行動 App', '#60a5fa'),
    newList('年度行銷活動', '#fb923c'),
    newList('內部系統升級', '#4ade80'),
  ]
  const [web, app, mkt, sys] = lists.map((l) => l.id)
  const focus = newFocusBoard()
  const [todo, doing, urgent] = focus.lists.map((l) => l.id)
  const cards: Card[] = [
    newCard(web, '首頁視覺提案', { cover: COVER_COLORS[4], labelIds: ['l1'], memberIds: ['m2'], startDate: t, dueDate: addDays(t, 5) }),
    newCard(web, '產品頁文案', { labelIds: ['l3'], startDate: addDays(t, 3), dueDate: addDays(t, 10) }),
    newCard(app, '登入流程重做', {
      labelIds: ['l2', 'l4'],
      memberIds: ['m1'],
      startDate: addDays(t, -4),
      dueDate: addDays(t, 2),
      description: '改成手機號碼 + 簡訊驗證碼登入。',
      checklist: [
        { id: uid(), text: '流程圖', done: true },
        { id: uid(), text: 'API 串接', done: false },
        { id: uid(), text: '測試', done: false },
      ],
    }),
    newCard(app, '推播通知設定頁', { labelIds: ['l1'], memberIds: ['m3'], startDate: addDays(t, 6), dueDate: addDays(t, 14) }),
    newCard(mkt, '春季活動企劃', { labelIds: ['l3'], memberIds: ['m1', 'm2'], startDate: addDays(t, -8), dueDate: addDays(t, 20) }),
    newCard(sys, '資料庫備份機制', {
      labelIds: ['l2'],
      memberIds: ['m3'],
      startDate: addDays(t, -14),
      dueDate: addDays(t, -9),
      completed: true,
    }),
    // Already pulled up into the split-mode lists.
    newCard(urgent, '客戶回報：App 無法登入', { cover: COVER_COLORS[3], labelIds: ['l4'], memberIds: ['m1'], dueDate: t }),
    newCard(doing, '活動主視覺確認', { labelIds: ['l1'], memberIds: ['m2'], dueDate: addDays(t, 2) }),
    newCard(todo, '整理本週會議記錄', { dueDate: addDays(t, 1) }),
  ]
  const boardId = uid()
  // The two pulled-up cards came from these projects; the meeting notes belong to none.
  const pulledFrom: (ID | undefined)[] = [app, mkt]
  const allLists = [...lists, ...focus.lists]
  cards.forEach((c, i) => {
    allLists.find((l) => l.id === c.listId)!.cardIds.push(c.id)
    const homeListId = lists.some((l) => l.id === c.listId) ? c.listId : pulledFrom[i - 6]
    if (homeListId) Object.assign(c, { homeBoardId: boardId, homeListId })
  })

  const board: Board = {
    id: boardId,
    title: `${year} 年度專案`,
    color: BOARD_COLORS[0],
    background: { ...defaultBackground(BOARD_COLORS[0]), ...BACKGROUND_PRESETS[1].bg },
    listIds: lists.map((l) => l.id),
    labels,
    customFields: [
      { id: 'cf1', name: '預算（萬）', type: 'number', options: [] },
      { id: 'cf2', name: '優先級', type: 'select', options: ['P0', 'P1', 'P2'] },
    ],
  }
  return {
    theme: defaultTheme,
    focusBoardId: focus.board.id,
    boards: { [board.id]: board, [focus.board.id]: focus.board },
    boardOrder: [board.id],
    lists: Object.fromEntries(allLists.map((l) => [l.id, l])),
    cards: Object.fromEntries(cards.map((c) => [c.id, c])),
    members,
    currentMemberId: 'm1',
    activity: [],
    trash: [],
    pet: newPet(),
  }
}

export function newPet(): PetState {
  return {
    alien: 'blip',
    xp: 0,
    energy: 60,
    energyAt: null,
    streak: 0,
    best: 0,
    lastDay: null,
    days: [],
    stats: { todosAdded: 0, todosDone: 0, notes: 0, events: 0 },
    unlocked: [],
    equipped: null,
    lastEvent: null,
  }
}

export type Action =
  | { type: 'addBoard'; title: string; background: BoardBackground; lists: string[] }
  | { type: 'setBoardBackground'; boardId: ID; patch: Partial<BoardBackground> }
  | { type: 'setTheme'; patch: Partial<Theme> }
  | { type: 'addMember'; name: string; color: string }
  | { type: 'updateMember'; memberId: ID; patch: Partial<Member> }
  | { type: 'deleteMember'; memberId: ID }
  | { type: 'renameBoard'; boardId: ID; title: string }
  | { type: 'deleteBoard'; boardId: ID }
  | { type: 'addList'; boardId: ID; title: string }
  | { type: 'renameList'; listId: ID; title: string }
  | { type: 'setListColor'; listId: ID; color: string | null }
  | { type: 'deleteList'; boardId: ID; listId: ID }
  | { type: 'moveList'; listId: ID; toBoardId: ID; toIndex: number }
  | { type: 'addCard'; listId: ID; title: string }
  | { type: 'updateCard'; cardId: ID; patch: Partial<Card> }
  | { type: 'moveCard'; cardId: ID; toListId: ID; toIndex: number }
  | { type: 'deleteCard'; cardId: ID }
  | { type: 'addComment'; cardId: ID; text: string }
  | { type: 'upsertLabel'; boardId: ID; label: { id?: ID; name: string; color: string } }
  | { type: 'deleteLabel'; boardId: ID; labelId: ID }
  | { type: 'addCustomField'; boardId: ID; name: string; fieldType: 'text' | 'number' | 'select'; options: string[] }
  | { type: 'deleteCustomField'; boardId: ID; fieldId: ID }
  | { type: 'reset' }
  | { type: 'petVisit' }
  | { type: 'setAlien'; alien: string }
  | { type: 'equip'; accessory: string | null }
  | { type: 'restoreTrash'; cardId: ID }
  /** Changes pulled from the connected calendars (see calendar.ts). */
  | { type: 'calendarApply'; changes: CalendarChange[] }
  /** Cards whose calendar write went through, with the fingerprint now on the calendar (null = removed). */
  | { type: 'calendarSynced'; hashes: Record<ID, string | null> }
  /** Delete one trashed card for good, or empty the trash when cardId is omitted. */
  | { type: 'purgeTrash'; cardId?: ID }
  /** Todos sent over from Beamup (see inbox.ts). */
  | { type: 'ingestInbox'; items: (InboxTodo | InboxEvent)[] }
  /** Replace everything with state loaded from the cloud. */
  | { type: 'hydrate'; state: AppState }

export function boardOfList(s: AppState, listId: ID): ID | undefined {
  return Object.keys(s.boards).find((b) => s.boards[b].listIds.includes(listId))
}

/** The project a card belongs to (null for cards created directly in a focus list). */
function projectOf(s: AppState, listId: ID): ID | null {
  const b = boardOfList(s, listId)
  return b && b !== s.focusBoardId ? b : null
}

/** Board whose labels and custom fields apply to a card. */
export function cardBoard(s: AppState, card: Card): Board {
  return s.boards[card.homeBoardId ?? ''] ?? s.boards[boardOfList(s, card.listId) ?? ''] ?? s.boards[s.focusBoardId]
}

function log(s: AppState, boardId: ID | undefined, text: string): AppState {
  if (!boardId) return s
  const entry = { id: uid(), boardId, text, at: new Date().toISOString() }
  return { ...s, activity: [entry, ...s.activity].slice(0, 200) }
}

function baseReducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'addBoard': {
      const id = uid()
      const lists: List[] = a.lists.map((title) => newList(title))
      const board: Board = {
        id,
        title: a.title,
        color: a.background.color,
        background: a.background,
        listIds: lists.map((l) => l.id),
        labels: LABEL_COLORS.slice(0, 4).map((color) => ({ id: uid(), name: '', color })),
        customFields: [],
      }
      return {
        ...s,
        boards: { ...s.boards, [id]: board },
        boardOrder: [...s.boardOrder, id],
        lists: { ...s.lists, ...Object.fromEntries(lists.map((l) => [l.id, l])) },
      }
    }
    case 'setBoardBackground': {
      const board = s.boards[a.boardId]
      const background = { ...board.background, ...a.patch }
      return { ...s, boards: { ...s.boards, [a.boardId]: { ...board, background, color: background.color } } }
    }
    case 'setTheme':
      return { ...s, theme: { ...s.theme, ...a.patch } }
    case 'addMember':
      return { ...s, members: [...s.members, { id: uid(), name: a.name, color: a.color }] }
    case 'updateMember':
      return { ...s, members: s.members.map((m) => (m.id === a.memberId ? { ...m, ...a.patch } : m)) }
    case 'deleteMember': {
      if (a.memberId === s.currentMemberId) return s
      const cards = Object.fromEntries(
        Object.entries(s.cards).map(([id, c]) => [id, { ...c, memberIds: c.memberIds.filter((m) => m !== a.memberId) }]),
      )
      return { ...s, cards, members: s.members.filter((m) => m.id !== a.memberId) }
    }
    case 'renameBoard':
      return { ...s, boards: { ...s.boards, [a.boardId]: { ...s.boards[a.boardId], title: a.title } } }
    case 'deleteBoard': {
      if (a.boardId === s.focusBoardId) return s
      const board = s.boards[a.boardId]
      const lists = { ...s.lists }
      const cards = { ...s.cards }
      // Cards of this project parked in the focus lists stay, detached from the project.
      for (const [id, c] of Object.entries(cards)) if (c.homeBoardId === a.boardId) cards[id] = { ...c, homeBoardId: null }
      const trashed: TrashItem[] = []
      for (const lid of board.listIds) {
        for (const cid of lists[lid].cardIds) {
          trashed.push(trashItem(cards[cid], lists[lid].title, board.title))
          delete cards[cid]
        }
        delete lists[lid]
      }
      const boards = { ...s.boards }
      delete boards[a.boardId]
      return {
        ...s,
        trash: [...trashed, ...s.trash],
        boards,
        lists,
        cards,
        boardOrder: s.boardOrder.filter((b) => b !== a.boardId),
        activity: s.activity.filter((e) => e.boardId !== a.boardId),
      }
    }
    case 'addList': {
      const list = newList(a.title)
      const board = s.boards[a.boardId]
      return log(
        {
          ...s,
          lists: { ...s.lists, [list.id]: list },
          boards: { ...s.boards, [a.boardId]: { ...board, listIds: [...board.listIds, list.id] } },
        },
        a.boardId,
        `新增清單「${a.title}」`,
      )
    }
    case 'renameList':
      return { ...s, lists: { ...s.lists, [a.listId]: { ...s.lists[a.listId], title: a.title } } }
    case 'setListColor':
      return { ...s, lists: { ...s.lists, [a.listId]: { ...s.lists[a.listId], color: a.color } } }
    case 'deleteList': {
      const board = s.boards[a.boardId]
      const lists = { ...s.lists }
      const cards = { ...s.cards }
      const title = lists[a.listId].title
      const trashed = lists[a.listId].cardIds.map((cid) => trashItem(cards[cid], title, board.title))
      for (const cid of lists[a.listId].cardIds) delete cards[cid]
      delete lists[a.listId]
      return log(
        {
          ...s,
          trash: [...trashed, ...s.trash],
          lists,
          cards,
          boards: { ...s.boards, [a.boardId]: { ...board, listIds: board.listIds.filter((l) => l !== a.listId) } },
        },
        a.boardId,
        `刪除清單「${title}」`,
      )
    }
    case 'moveList': {
      const list = s.lists[a.listId]
      const fromId = boardOfList(s, a.listId)
      if (!fromId) return s
      const boards = { ...s.boards, [fromId]: { ...s.boards[fromId], listIds: s.boards[fromId].listIds.filter((l) => l !== a.listId) } }
      const to = boards[a.toBoardId]
      const ids = [...to.listIds]
      ids.splice(Math.min(a.toIndex, ids.length), 0, a.listId)
      boards[a.toBoardId] = { ...to, listIds: ids }
      if (fromId === a.toBoardId) return { ...s, boards }
      // Lists moved into a project make their cards part of it; lists moved up keep their cards' projects.
      const cards = { ...s.cards }
      if (a.toBoardId !== s.focusBoardId)
        for (const cid of list.cardIds) cards[cid] = { ...cards[cid], homeBoardId: a.toBoardId, homeListId: a.listId }
      return log({ ...s, boards, cards }, a.toBoardId, `將清單「${list.title}」從「${s.boards[fromId].title}」移入`)
    }
    case 'addCard': {
      const project = projectOf(s, a.listId)
      const card = newCard(a.listId, a.title, { homeBoardId: project, homeListId: project ? a.listId : null })
      const list = s.lists[a.listId]
      return log(
        {
          ...s,
          cards: { ...s.cards, [card.id]: card },
          lists: { ...s.lists, [a.listId]: { ...list, cardIds: [...list.cardIds, card.id] } },
        },
        boardOfList(s, a.listId),
        `新增卡片「${a.title}」到「${list.title}」`,
      )
    }
    case 'updateCard': {
      const card = s.cards[a.cardId]
      return { ...s, cards: { ...s.cards, [a.cardId]: { ...card, ...a.patch, ...completion(card, a.patch.completed) } } }
    }
    case 'moveCard': {
      const card = s.cards[a.cardId]
      const from = s.lists[card.listId]
      const lists = { ...s.lists, [from.id]: { ...from, cardIds: from.cardIds.filter((c) => c !== a.cardId) } }
      const to = lists[a.toListId]
      const ids = [...to.cardIds]
      ids.splice(Math.min(a.toIndex, ids.length), 0, a.cardId)
      lists[a.toListId] = { ...to, cardIds: ids }
      const project = projectOf(s, a.toListId)
      const homeBoardId = project ?? card.homeBoardId
      const homeListId = project ? a.toListId : card.homeListId
      const next = { ...s, lists, cards: { ...s.cards, [a.cardId]: { ...card, listId: a.toListId, homeBoardId, homeListId } } }
      return from.id === a.toListId
        ? next
        : log(next, homeBoardId ?? s.focusBoardId, `將「${card.title}」從「${from.title}」移到「${to.title}」`)
    }
    case 'deleteCard': {
      const card = s.cards[a.cardId]
      const list = s.lists[card.listId]
      const cards = { ...s.cards }
      delete cards[a.cardId]
      const boardTitle = s.boards[card.homeBoardId ?? boardOfList(s, list.id) ?? '']?.title ?? ''
      return log(
        {
          ...s,
          cards,
          lists: { ...s.lists, [list.id]: { ...list, cardIds: list.cardIds.filter((c) => c !== a.cardId) } },
          trash: [trashItem(card, list.title, boardTitle), ...s.trash],
        },
        boardOfList(s, list.id),
        `刪除卡片「${card.title}」`,
      )
    }
    case 'addComment': {
      const card = s.cards[a.cardId]
      const comment = { id: uid(), memberId: s.currentMemberId, text: a.text, createdAt: new Date().toISOString() }
      return { ...s, cards: { ...s.cards, [a.cardId]: { ...card, comments: [...card.comments, comment] } } }
    }
    case 'upsertLabel': {
      const board = s.boards[a.boardId]
      const { id, ...rest } = a.label
      const labels = id ? board.labels.map((l) => (l.id === id ? { ...l, ...rest } : l)) : [...board.labels, { id: uid(), ...rest }]
      return { ...s, boards: { ...s.boards, [a.boardId]: { ...board, labels } } }
    }
    case 'deleteLabel': {
      const board = s.boards[a.boardId]
      const cards = Object.fromEntries(
        Object.entries(s.cards).map(([id, c]) => [id, { ...c, labelIds: c.labelIds.filter((l) => l !== a.labelId) }]),
      )
      return {
        ...s,
        cards,
        boards: { ...s.boards, [a.boardId]: { ...board, labels: board.labels.filter((l) => l.id !== a.labelId) } },
      }
    }
    case 'addCustomField': {
      const board = s.boards[a.boardId]
      const field = { id: uid(), name: a.name, type: a.fieldType, options: a.options }
      return { ...s, boards: { ...s.boards, [a.boardId]: { ...board, customFields: [...board.customFields, field] } } }
    }
    case 'deleteCustomField': {
      const board = s.boards[a.boardId]
      return {
        ...s,
        boards: {
          ...s.boards,
          [a.boardId]: { ...board, customFields: board.customFields.filter((f) => f.id !== a.fieldId) },
        },
      }
    }
    case 'reset':
      return { ...seed(), theme: s.theme, pet: s.pet }
    case 'petVisit': {
      const pet = structuredClone(s.pet)
      const r = petVisit(pet)
      if (!r.firstToday) return s
      return { ...s, pet: { ...pet, lastEvent: rewardLine(r, r.streak > 1 ? `連續 ${r.streak} 天見面了！` : '今天也來看我了！') } }
    }
    case 'setAlien':
      return { ...s, pet: { ...s.pet, alien: a.alien } }
    case 'equip':
      return { ...s, pet: { ...s.pet, equipped: a.accessory } }
    case 'restoreTrash': {
      const item = s.trash.find((t) => t.card.id === a.cardId)
      if (!item) return s
      const rest = s.trash.filter((t) => t !== item)
      // Back to its list if that still exists, otherwise to the top 待辦 list.
      const listId = s.lists[item.card.listId] ? item.card.listId : inboxList(s, 'normal')
      if (!listId) return s
      const card: Card = {
        ...item.card,
        listId,
        homeBoardId: item.card.homeBoardId && s.boards[item.card.homeBoardId] ? item.card.homeBoardId : projectOf(s, listId),
        homeListId: item.card.homeListId && s.lists[item.card.homeListId] ? item.card.homeListId : null,
      }
      const list = s.lists[listId]
      return log(
        {
          ...s,
          trash: rest,
          cards: { ...s.cards, [card.id]: card },
          lists: { ...s.lists, [listId]: { ...list, cardIds: [...list.cardIds, card.id] } },
        },
        boardOfList(s, listId),
        `從垃圾桶救回「${card.title}」到「${list.title}」`,
      )
    }
    case 'calendarApply':
      return a.changes.reduce(applyCalendarChange, s)
    case 'calendarSynced': {
      const cards = { ...s.cards }
      for (const [id, h] of Object.entries(a.hashes)) if (cards[id]) cards[id] = { ...cards[id], calHash: h }
      const trash = s.trash.map((t) => (t.card.id in a.hashes && a.hashes[t.card.id] === null ? { ...t, card: { ...t.card, calHash: null } } : t))
      return { ...s, cards, trash }
    }
    case 'purgeTrash':
      return { ...s, trash: a.cardId ? s.trash.filter((t) => t.card.id !== a.cardId) : [] }
    case 'ingestInbox':
      return a.items.reduce((acc: AppState, item) => (String(item?.type).startsWith('event.') ? ingestEvent(acc, item as InboxEvent) : ingestTodo(acc, item as InboxTodo)), s)
    case 'hydrate':
      return migrate(a.state)
  }
}

export const TRASH_DAYS = 30

/** A change from a calendar, as the calendar function reports it. */
export type CalendarChange =
  | {
      type: 'upsert'
      cardId: ID
      isNew: boolean
      title: string
      description: string
      completed: boolean
      startDate: string | null
      dueDate: string
      time: string | null
    }
  | { type: 'delete'; cardId: ID }

/** What a card puts on the calendar (shared with the calendar function, which syncs while the app is closed). */
import { calendarHash } from '../supabase/functions/calendar/cardhash.ts'
export { calendarHash }

const CALENDAR_LIST = '行事曆'

function applyCalendarChange(s: AppState, ch: CalendarChange): AppState {
  const card = s.cards[ch.cardId]
  if (ch.type === 'delete') {
    if (!card) return s
    // Deleted on the calendar: into the trash, without deleting it on the calendar again.
    const next = baseReducer({ ...s, cards: { ...s.cards, [card.id]: { ...card, calHash: null } } }, { type: 'deleteCard', cardId: card.id })
    return { ...next, trash: next.trash.map((t) => (t.card.id === card.id ? { ...t, card: { ...t.card, calHash: null } } : t)) }
  }
  const fields = {
    title: ch.title,
    description: ch.description,
    startDate: ch.startDate,
    dueDate: ch.dueDate,
    completed: ch.completed,
    time: ch.time,
  }
  if (card) {
    const updated = { ...card, ...fields, ...completion(card, ch.completed) }
    return { ...s, cards: { ...s.cards, [card.id]: { ...updated, calHash: calendarHash(updated) } } }
  }
  // A card deleted here while its event was edited there stays deleted.
  if (s.trash.some((t) => t.card.id === ch.cardId)) return s
  const created = newCard('', ch.title, { ...fields, id: ch.cardId, completedAt: ch.completed ? today() : null })
  const added = addToCalendarList(s, created, `從行事曆收到「${ch.title}」`)
  // Already on the calendar: mark it as written so it isn't sent back.
  return { ...added, cards: { ...added.cards, [created.id]: { ...added.cards[created.id], calHash: calendarHash(added.cards[created.id]) } } }
}

/** Adds a card to the top 行事曆 list, creating that list the first time. */
function addToCalendarList(s: AppState, card: Card, activity: string): AppState {
  let next = s
  let listId = next.boards[next.focusBoardId].listIds.find((id) => next.lists[id].title === CALENDAR_LIST)
  if (!listId) {
    next = baseReducer(next, { type: 'addList', boardId: next.focusBoardId, title: CALENDAR_LIST })
    listId = next.boards[next.focusBoardId].listIds.at(-1)!
    next = { ...next, lists: { ...next.lists, [listId]: { ...next.lists[listId], color: '#a78bfa' } } }
  }
  const list = next.lists[listId]
  return log(
    {
      ...next,
      cards: { ...next.cards, [card.id]: { ...card, listId } },
      lists: { ...next.lists, [listId]: { ...list, cardIds: [...list.cardIds, card.id] } },
    },
    next.focusBoardId,
    activity,
  )
}

function trashItem(card: Card, listTitle: string, boardTitle: string): TrashItem {
  return { card, listTitle, boardTitle, deletedAt: new Date().toISOString() }
}

/** Records the day a card is checked off, and forgets it when unchecked. */
function completion(card: Card, completed: boolean | undefined): Partial<Card> {
  if (completed === undefined || completed === card.completed) return {}
  return { completedAt: completed ? today() : null }
}

/** A todo as Beamup sends it (see thought_task_entry js/sync/todo.js). */
export interface InboxTodo {
  type: 'todo.created' | 'todo.updated' | 'todo.deleted'
  id: string
  title: string
  note?: string
  due?: string | null
  priority?: 'low' | 'normal' | 'high'
  tags?: string[]
  done?: boolean
}

/** An event (行程) as Beamup sends it in Mothership mode: instants in ISO, end exclusive for all-day ones. */
export interface InboxEvent {
  type: 'event.created' | 'event.updated' | 'event.deleted'
  id: string
  title: string
  notes?: string
  allDay?: boolean
  start?: string
  end?: string
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const hhmm = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`

/** A Beamup event becomes a card in the 行事曆 list, carrying its time; calendar sync puts it on the calendar. */
function ingestEvent(s: AppState, e: InboxEvent): AppState {
  if (!e || typeof e.id !== 'string') return s
  const sourceId = 'ev:' + e.id
  const existing = Object.values(s.cards).find((c) => c.sourceId === sourceId)
  if (e.type === 'event.deleted') return existing ? baseReducer(s, { type: 'deleteCard', cardId: existing.id }) : s
  const start = new Date(e.start ?? '')
  let end = new Date(e.end ?? '')
  if (typeof e.title !== 'string' || isNaN(start.getTime())) return s
  if (isNaN(end.getTime()) || end < start) end = start
  // All-day events end at midnight after their last day; timed ones may end exactly at midnight too.
  const last = new Date(Math.max(start.getTime(), end.getTime() - (e.allDay ? 86400000 : 1)))
  const first = ymd(start)
  const due = ymd(last)
  const fields: Partial<Card> = {
    title: e.title,
    description: (e.notes ?? '').trim(),
    startDate: first !== due ? first : null,
    dueDate: due,
    time: e.allDay ? null : `${hhmm(start)}–${hhmm(end)}`,
  }
  if (existing) return { ...s, cards: { ...s.cards, [existing.id]: { ...existing, ...fields, archived: false } } }
  return addToCalendarList(s, newCard('', e.title, { ...fields, sourceId }), `從 Beamup 收到行程「${e.title}」`)
}

/** The split-mode list a Beamup todo lands in: 急件 for high priority, otherwise 待辦 (or the first top list). */
function inboxList(s: AppState, priority: InboxTodo['priority']): ID {
  const ids = s.boards[s.focusBoardId].listIds
  const named = (t: string) => ids.find((id) => s.lists[id].title.trim() === t)
  return (priority === 'high' ? named('急件') : undefined) ?? named('待辦') ?? ids[0]
}

function ingestTodo(s: AppState, t: InboxTodo): AppState {
  if (!t || typeof t.id !== 'string' || typeof t.title !== 'string') return s
  const existing = Object.values(s.cards).find((c) => c.sourceId === t.id)
  const description = [t.note?.trim(), t.tags?.length ? t.tags.map((x) => '#' + x).join(' ') : '']
    .filter(Boolean)
    .join('\n\n')
  const due = typeof t.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.due) ? t.due : null
  if (existing) {
    // Deleting in Beamup archives the card rather than removing it: it may have been worked on here.
    const patch: Partial<Card> =
      t.type === 'todo.deleted'
        ? { archived: true }
        : { title: t.title, description, dueDate: due, completed: !!t.done, archived: false, ...completion(existing, !!t.done) }
    return { ...s, cards: { ...s.cards, [existing.id]: { ...existing, ...patch } } }
  }
  if (t.type === 'todo.deleted') return s
  let next = s
  if (!s.boards[s.focusBoardId].listIds.length) next = baseReducer(s, { type: 'addList', boardId: s.focusBoardId, title: '待辦' })
  const listId = inboxList(next, t.priority)
  const list = next.lists[listId]
  const card = newCard(listId, t.title, { description, dueDate: due, completed: !!t.done, completedAt: t.done ? today() : null, sourceId: t.id })
  return log(
    {
      ...next,
      cards: { ...next.cards, [card.id]: card },
      lists: { ...next.lists, [listId]: { ...list, cardIds: [...list.cardIds, card.id] } },
    },
    next.focusBoardId,
    `從 Beamup 收到「${t.title}」`,
  )
}

/** Fill in fields added after data was first saved. */
type PetKind = 'todo.add' | 'todo.done' | 'note.add' | 'event.add'

/** Which care reward (if any) an action earns the alien, and what it says about it. */
function rewardFor(prev: AppState, next: AppState, a: Action): { kind: PetKind; text: string } | null {
  switch (a.type) {
    case 'addCard':
      return { kind: 'todo.add', text: `收到新卡片「${a.title}」` }
    case 'addComment':
      return { kind: 'note.add', text: '謝謝你的留言～' }
    case 'ingestInbox': {
      const n = a.items.filter((t) => t?.type === 'todo.created').length
      if (n) return { kind: 'todo.add', text: n > 1 ? `Beamup 送來 ${n} 件待辦！` : '收到 Beamup 的待辦！' }
      return a.items.some((t) => t?.type === 'event.created') ? { kind: 'event.add', text: '收到 Beamup 的行程！' } : null
    }
    case 'updateCard': {
      const before = prev.cards[a.cardId]
      const after = next.cards[a.cardId]
      if (!before || !after) return null
      if (after.completed && !before.completed) return { kind: 'todo.done', text: `完成「${after.title}」了！` }
      const done = (c: Card) => c.checklist.filter((i) => i.done).length
      if (done(after) > done(before)) return { kind: 'todo.done', text: '又勾掉一項，好棒！' }
      if (after.dueDate && !before.dueDate) return { kind: 'event.add', text: '記下到期日了' }
      return null
    }
    default:
      return null
  }
}

function rewardLine(r: { levelUp?: number | null; unlocked?: { name: string }[] }, text: string) {
  if (r.unlocked?.length) text = `解鎖了${r.unlocked.map((x) => x.name).join('、')}！`
  else if (r.levelUp) text = `升到 Lv.${r.levelUp} 了！`
  return { text, at: Date.now() }
}

export function reducer(s: AppState, a: Action): AppState {
  const next = baseReducer(s, a)
  const reward = next === s ? null : rewardFor(s, next, a)
  if (!reward) return next
  const pet = structuredClone(next.pet)
  const r = petGain(pet, reward.kind)
  return { ...next, pet: { ...pet, lastEvent: rewardLine(r, reward.text) } }
}

function migrate(s: AppState): AppState {
  const boards = Object.fromEntries(
    Object.entries(s.boards).map(([id, b]) => [id, { ...b, background: b.background ?? defaultBackground(b.color) }]),
  )
  // `fixed` came from an earlier version where the split-mode lists could not be edited.
  const lists = Object.fromEntries(
    Object.entries(s.lists).map(([id, l]) => {
      const { fixed: _fixed, ...rest } = l as List & { fixed?: boolean }
      return [id, { ...rest, color: l.color ?? null }]
    }),
  )
  let focusBoardId = s.focusBoardId
  if (!focusBoardId || !boards[focusBoardId]) {
    const focus = newFocusBoard()
    focusBoardId = focus.board.id
    boards[focusBoardId] = focus.board
    for (const l of focus.lists) lists[l.id] = l
  }
  const listBoard: Record<ID, ID> = {}
  for (const b of Object.values(boards)) for (const l of b.listIds) listBoard[l] = b.id
  const cards = Object.fromEntries(
    Object.entries(s.cards).map(([id, c]) => {
      const owner = listBoard[c.listId]
      const homeBoardId = c.homeBoardId !== undefined ? c.homeBoardId : owner && owner !== focusBoardId ? owner : null
      const homeListId = c.homeListId !== undefined ? c.homeListId : homeBoardId && owner === homeBoardId ? c.listId : null
      return [id, { ...c, cover: c.cover ?? null, homeBoardId, homeListId }]
    }),
  )
  const theme = { ...defaultTheme, ...s.theme }
  if ((s.theme?.rev ?? 0) < 3) {
    // Cards and lists are always rounded rectangles now; lift saved themes to the new minimum.
    theme.radius = Math.max(theme.radius, 18)
    theme.rev = 3
  }
  if ((s.theme?.rev ?? 0) < 4) {
    // The top 待辦 list used to default to gray; give it the livelier amber unless it was recolored.
    for (const id of boards[focusBoardId].listIds)
      if (lists[id].color === '#94a3b8' && lists[id].title === '待辦') lists[id] = { ...lists[id], color: '#fbbf24' }
    theme.rev = 4
  }
  // Deleted cards stay in the trash for TRASH_DAYS.
  const cutoff = Date.now() - TRASH_DAYS * 86400000
  const trash = (s.trash ?? []).filter((t) => Date.parse(t.deletedAt) > cutoff)
  return { ...s, focusBoardId, boards, lists, cards, theme, trash, pet: { ...newPet(), ...s.pet } }
}

function load(key: string): AppState {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return migrate(JSON.parse(raw) as AppState)
  } catch {
    // ignore corrupted or unavailable storage
  }
  return seed()
}

/** `userId` keeps each signed-in account's local copy separate on a shared browser. */
export function useAppStore(userId?: string) {
  const key = userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY
  const [state, dispatch] = useReducer(reducer, key, load)
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch {
      // storage full or unavailable; keep working in memory
    }
  }, [state, key])
  return [state, dispatch] as const
}

/** Cards of a board in list order, excluding archived ones. */
/** Cards of a board in list order (plus its cards parked in the focus lists), excluding archived ones. */
export function boardCards(s: AppState, boardId: ID): Card[] {
  const own = s.boards[boardId].listIds.flatMap((lid) => s.lists[lid].cardIds.map((cid) => s.cards[cid]))
  const parked =
    boardId === s.focusBoardId
      ? []
      : s.boards[s.focusBoardId].listIds
          .flatMap((lid) => s.lists[lid].cardIds.map((cid) => s.cards[cid]))
          .filter((c) => c.homeBoardId === boardId)
  return [...own, ...parked].filter((c) => !c.archived)
}

export function isOverdue(c: Card): boolean {
  return !!c.dueDate && !c.completed && c.dueDate < today()
}

export function matchesFilter(c: Card, f: Filter): boolean {
  if (f.text && !(c.title + ' ' + c.description).toLowerCase().includes(f.text.toLowerCase())) return false
  if (f.labelIds.length && !f.labelIds.some((l) => c.labelIds.includes(l))) return false
  if (f.memberIds.length && !f.memberIds.some((m) => c.memberIds.includes(m))) return false
  if (f.due === 'overdue' && !isOverdue(c)) return false
  if (f.due === 'none' && c.dueDate) return false
  if (f.due === 'week') {
    if (!c.dueDate) return false
    const t = today()
    if (c.dueDate < t || c.dueDate > addDays(t, 7)) return false
  }
  return true
}

export const emptyFilter: Filter = { text: '', labelIds: [], memberIds: [], due: 'all' }

export function formatDate(d: string): string {
  const date = parseYmd(d)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

/** Local calendar day of an ISO timestamp. */
export const dayOf = (iso: string) => ymd(new Date(iso))

/**
 * When a done card was finished. Cards checked off before completion dates were recorded fall back to
 * their due date, then their creation day; `exact` says whether the date is the recorded one.
 */
export function doneDate(c: Card): { date: string; exact: boolean } {
  if (c.completedAt) return { date: c.completedAt, exact: true }
  return { date: c.dueDate ?? dayOf(c.createdAt), exact: false }
}

/** Every card that belongs to a board (its own lists, plus its cards parked in the focus lists), archived ones included. */
export function allBoardCards(s: AppState, boardId: ID): Card[] {
  return Object.values(s.cards).filter((c) =>
    boardId === s.focusBoardId
      ? s.boards[boardId].listIds.includes(c.listId) && !c.homeBoardId
      : s.boards[boardId].listIds.includes(c.listId) || c.homeBoardId === boardId,
  )
}
