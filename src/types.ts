export type ID = string

export interface Label {
  id: ID
  name: string
  color: string
}

export interface Member {
  id: ID
  name: string
  color: string
}

export interface ChecklistItem {
  id: ID
  text: string
  done: boolean
}

export interface Comment {
  id: ID
  memberId: ID
  text: string
  createdAt: string
}

export interface Card {
  id: ID
  listId: ID
  title: string
  description: string
  labelIds: ID[]
  memberIds: ID[]
  startDate: string | null // YYYY-MM-DD
  dueDate: string | null // YYYY-MM-DD
  completed: boolean
  checklist: ChecklistItem[]
  comments: Comment[]
  /** Custom field values keyed by CustomField id (Premium feature). */
  customFields: Record<ID, string>
  /** Card cover color (Premium feature); null = no cover. */
  cover: string | null
  archived: boolean
  createdAt: string
}

export interface List {
  id: ID
  title: string
  cardIds: ID[]
}

export interface CustomField {
  id: ID
  name: string
  type: 'text' | 'number' | 'select'
  options: string[]
}

export interface BoardBackground {
  type: 'color' | 'gradient' | 'image'
  color: string
  color2: string
  angle: number
  image: string
}

export interface Board {
  id: ID
  title: string
  /** Primary board color, used for tiles and charts. */
  color: string
  background: BoardBackground
  listIds: ID[]
  labels: Label[]
  customFields: CustomField[]
}

export interface ActivityEntry {
  id: ID
  boardId: ID
  text: string
  at: string
}

export interface Theme {
  mode: 'light' | 'dark' | 'system'
  accent: string
  font: 'sans' | 'rounded' | 'serif' | 'mono'
  fontScale: number // percent, 85–125
  radius: number // px, 0–20
  density: 'compact' | 'comfortable' | 'spacious'
  cardStyle: 'shadow' | 'flat' | 'outline' | 'glass'
  listWidth: number // px
  listOpacity: number // percent, 0–100
  labelStyle: 'bar' | 'pill'
  blur: boolean
}

export interface AppState {
  theme: Theme
  boards: Record<ID, Board>
  boardOrder: ID[]
  lists: Record<ID, List>
  cards: Record<ID, Card>
  members: Member[]
  currentMemberId: ID
  activity: ActivityEntry[]
}

export type ViewKind = 'board' | 'table' | 'calendar' | 'timeline' | 'dashboard'

export interface Filter {
  text: string
  labelIds: ID[]
  memberIds: ID[]
  due: 'all' | 'overdue' | 'week' | 'none'
}
