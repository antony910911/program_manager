import { useEffect, useReducer } from 'react'
import type { AppState, Board, BoardBackground, Card, Filter, ID, List, Member, Theme } from './types'
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

function newCard(listId: ID, title: string, extra: Partial<Card> = {}): Card {
  return {
    id: uid(),
    listId,
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
  const members = [
    { id: 'm1', name: '我', color: '#0079bf' },
    { id: 'm2', name: 'Alice', color: '#eb5a46' },
    { id: 'm3', name: 'Bob', color: '#61bd4f' },
  ]
  const labels = [
    { id: 'l1', name: '功能', color: LABEL_COLORS[0] },
    { id: 'l2', name: '設計', color: LABEL_COLORS[4] },
    { id: 'l3', name: 'Bug', color: LABEL_COLORS[3] },
    { id: 'l4', name: '高優先', color: LABEL_COLORS[2] },
  ]
  const lists: List[] = [
    { id: uid(), title: '待辦', cardIds: [] },
    { id: uid(), title: '進行中', cardIds: [] },
    { id: uid(), title: '審核中', cardIds: [] },
    { id: uid(), title: '完成', cardIds: [] },
  ]
  const cards: Card[] = [
    newCard(lists[0].id, '設計登入頁面', {
      cover: COVER_COLORS[4],
      labelIds: ['l2'],
      memberIds: ['m2'],
      startDate: t,
      dueDate: addDays(t, 5),
    }),
    newCard(lists[0].id, '撰寫 API 文件', { labelIds: ['l1'], startDate: addDays(t, 3), dueDate: addDays(t, 10) }),
    newCard(lists[1].id, '實作拖曳排序', {
      labelIds: ['l1', 'l4'],
      memberIds: ['m1'],
      startDate: addDays(t, -4),
      dueDate: addDays(t, 2),
      description: '支援卡片在清單之間拖曳，以及清單本身的排序。',
      checklist: [
        { id: uid(), text: '卡片拖曳', done: true },
        { id: uid(), text: '清單拖曳', done: false },
        { id: uid(), text: '觸控裝置支援', done: false },
      ],
    }),
    newCard(lists[1].id, '修正日期時區問題', {
      cover: COVER_COLORS[3],
      labelIds: ['l3'],
      memberIds: ['m3'],
      startDate: addDays(t, -6),
      dueDate: addDays(t, -1),
    }),
    newCard(lists[2].id, '行事曆檢視', { labelIds: ['l1'], memberIds: ['m1', 'm2'], startDate: addDays(t, -8), dueDate: t }),
    newCard(lists[3].id, '建立專案骨架', {
      labelIds: ['l1'],
      memberIds: ['m1'],
      startDate: addDays(t, -14),
      dueDate: addDays(t, -9),
      completed: true,
    }),
  ]
  for (const c of cards) lists.find((l) => l.id === c.listId)!.cardIds.push(c.id)

  const board: Board = {
    id: uid(),
    title: '產品開發',
    color: BOARD_COLORS[0],
    background: { ...defaultBackground(BOARD_COLORS[0]), ...BACKGROUND_PRESETS[1].bg },
    listIds: lists.map((l) => l.id),
    labels,
    customFields: [
      { id: 'cf1', name: '估計點數', type: 'number', options: [] },
      { id: 'cf2', name: '優先級', type: 'select', options: ['P0', 'P1', 'P2'] },
    ],
  }
  return {
    theme: defaultTheme,
    boards: { [board.id]: board },
    boardOrder: [board.id],
    lists: Object.fromEntries(lists.map((l) => [l.id, l])),
    cards: Object.fromEntries(cards.map((c) => [c.id, c])),
    members,
    currentMemberId: 'm1',
    activity: [],
  }
}

export type Action =
  | { type: 'addBoard'; title: string; background: BoardBackground }
  | { type: 'setBoardBackground'; boardId: ID; patch: Partial<BoardBackground> }
  | { type: 'setTheme'; patch: Partial<Theme> }
  | { type: 'addMember'; name: string; color: string }
  | { type: 'updateMember'; memberId: ID; patch: Partial<Member> }
  | { type: 'deleteMember'; memberId: ID }
  | { type: 'renameBoard'; boardId: ID; title: string }
  | { type: 'deleteBoard'; boardId: ID }
  | { type: 'addList'; boardId: ID; title: string }
  | { type: 'renameList'; listId: ID; title: string }
  | { type: 'deleteList'; boardId: ID; listId: ID }
  | { type: 'moveList'; boardId: ID; listId: ID; toIndex: number }
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

function boardOfList(s: AppState, listId: ID): ID | undefined {
  return s.boardOrder.find((b) => s.boards[b].listIds.includes(listId))
}

function log(s: AppState, boardId: ID | undefined, text: string): AppState {
  if (!boardId) return s
  const entry = { id: uid(), boardId, text, at: new Date().toISOString() }
  return { ...s, activity: [entry, ...s.activity].slice(0, 200) }
}

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'addBoard': {
      const id = uid()
      const lists: List[] = ['待辦', '進行中', '完成'].map((title) => ({ id: uid(), title, cardIds: [] }))
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
      const board = s.boards[a.boardId]
      const lists = { ...s.lists }
      const cards = { ...s.cards }
      for (const lid of board.listIds) {
        for (const cid of lists[lid].cardIds) delete cards[cid]
        delete lists[lid]
      }
      const boards = { ...s.boards }
      delete boards[a.boardId]
      return {
        ...s,
        boards,
        lists,
        cards,
        boardOrder: s.boardOrder.filter((b) => b !== a.boardId),
        activity: s.activity.filter((e) => e.boardId !== a.boardId),
      }
    }
    case 'addList': {
      const list: List = { id: uid(), title: a.title, cardIds: [] }
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
    case 'deleteList': {
      const board = s.boards[a.boardId]
      const lists = { ...s.lists }
      const cards = { ...s.cards }
      const title = lists[a.listId].title
      for (const cid of lists[a.listId].cardIds) delete cards[cid]
      delete lists[a.listId]
      return log(
        {
          ...s,
          lists,
          cards,
          boards: { ...s.boards, [a.boardId]: { ...board, listIds: board.listIds.filter((l) => l !== a.listId) } },
        },
        a.boardId,
        `刪除清單「${title}」`,
      )
    }
    case 'moveList': {
      const board = s.boards[a.boardId]
      const ids = board.listIds.filter((l) => l !== a.listId)
      ids.splice(a.toIndex, 0, a.listId)
      return { ...s, boards: { ...s.boards, [a.boardId]: { ...board, listIds: ids } } }
    }
    case 'addCard': {
      const card = newCard(a.listId, a.title)
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
    case 'updateCard':
      return { ...s, cards: { ...s.cards, [a.cardId]: { ...s.cards[a.cardId], ...a.patch } } }
    case 'moveCard': {
      const card = s.cards[a.cardId]
      const from = s.lists[card.listId]
      const lists = { ...s.lists, [from.id]: { ...from, cardIds: from.cardIds.filter((c) => c !== a.cardId) } }
      const to = lists[a.toListId]
      const ids = [...to.cardIds]
      ids.splice(Math.min(a.toIndex, ids.length), 0, a.cardId)
      lists[a.toListId] = { ...to, cardIds: ids }
      const next = { ...s, lists, cards: { ...s.cards, [a.cardId]: { ...card, listId: a.toListId } } }
      return from.id === a.toListId
        ? next
        : log(next, boardOfList(s, a.toListId), `將「${card.title}」從「${from.title}」移到「${to.title}」`)
    }
    case 'deleteCard': {
      const card = s.cards[a.cardId]
      const list = s.lists[card.listId]
      const cards = { ...s.cards }
      delete cards[a.cardId]
      return log(
        { ...s, cards, lists: { ...s.lists, [list.id]: { ...list, cardIds: list.cardIds.filter((c) => c !== a.cardId) } } },
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
      return { ...seed(), theme: s.theme }
  }
}

/** Fill in fields added after data was first saved. */
function migrate(s: AppState): AppState {
  const boards = Object.fromEntries(
    Object.entries(s.boards).map(([id, b]) => [id, { ...b, background: b.background ?? defaultBackground(b.color) }]),
  )
  const cards = Object.fromEntries(Object.entries(s.cards).map(([id, c]) => [id, { ...c, cover: c.cover ?? null }]))
  return { ...s, boards, cards, theme: { ...defaultTheme, ...s.theme } }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return migrate(JSON.parse(raw) as AppState)
  } catch {
    // ignore corrupted or unavailable storage
  }
  return seed()
}

export function useAppStore() {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // storage full or unavailable; keep working in memory
    }
  }, [state])
  return [state, dispatch] as const
}

/** Cards of a board in list order, excluding archived ones. */
export function boardCards(s: AppState, boardId: ID): Card[] {
  return s.boards[boardId].listIds.flatMap((lid) => s.lists[lid].cardIds.map((cid) => s.cards[cid])).filter((c) => !c.archived)
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
