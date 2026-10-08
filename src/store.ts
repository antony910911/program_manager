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

/** Initial top lists of split mode; like every list they can be renamed, added or removed. */
export const FOCUS_LISTS: { title: string; color: string }[] = [
  { title: '待辦', color: '#64748b' },
  { title: '進行中', color: '#0ea5e9' },
  { title: '急件', color: '#ef4444' },
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
    newList('官網改版', '#6366f1'),
    newList('行動 App', '#0ea5e9'),
    newList('年度行銷活動', '#f97316'),
    newList('內部系統升級', '#22c55e'),
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

export function reducer(s: AppState, a: Action): AppState {
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
    case 'hydrate':
      return migrate(a.state)
  }
}

/** Fill in fields added after data was first saved. */
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
  if (!s.theme?.rev) {
    // Rounder corners became the default; bump themes still on the old default of 12px.
    if (theme.radius === 12) theme.radius = 16
    theme.rev = 2
  }
  return { ...s, focusBoardId, boards, lists, cards, theme }
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
