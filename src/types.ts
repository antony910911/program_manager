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
  /** Day the card was marked done (YYYY-MM-DD); missing for cards completed before this was recorded. */
  completedAt?: string | null
  checklist: ChecklistItem[]
  comments: Comment[]
  /** Custom field values keyed by CustomField id (Premium feature). */
  customFields: Record<ID, string>
  /** Card cover color (Premium feature); null = no cover. */
  cover: string | null
  /** Project (board) the card belongs to; kept while it sits in a focus list. */
  homeBoardId: ID | null
  /** Project list the card last sat in, so it can be sent back from a focus list. */
  homeListId: ID | null
  archived: boolean
  createdAt: string
  /** Id of the todo this card came from in Beamup (thought-task-entry), so later edits update it. */
  sourceId?: string
}

export interface List {
  id: ID
  title: string
  cardIds: ID[]
  /** Custom list color; null = theme default. */
  color: string | null
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
  /** How saturated list and card colors look, percent 20–100. */
  colorStrength: number
  /** Appearance defaults revision, used to upgrade saved themes once. */
  rev?: number
}

/** The home-screen alien (ported from Beamup): care stats, unlocks and the latest thing it was fed for. */
export interface PetState {
  alien: string
  xp: number
  energy: number
  energyAt: string | null
  streak: number
  best: number
  lastDay: string | null
  days: string[]
  stats: { todosAdded: number; todosDone: number; notes: number; events: number }
  unlocked: string[]
  equipped: string | null
  /** Most recent reward, so the alien can celebrate it when the home screen is shown. */
  lastEvent: { text: string; at: number } | null
}

/** A deleted card, kept for TRASH_DAYS so it can be restored. */
export interface TrashItem {
  card: Card
  /** Where it was, for display (the list or board may be gone by now). */
  listTitle: string
  boardTitle: string
  deletedAt: string
}

export interface AppState {
  theme: Theme
  pet: PetState
  /** Hidden board holding split mode's top lists (待辦 / 進行中 / 急件 by default, fully editable). */
  focusBoardId: ID
  boards: Record<ID, Board>
  boardOrder: ID[]
  lists: Record<ID, List>
  cards: Record<ID, Card>
  members: Member[]
  currentMemberId: ID
  activity: ActivityEntry[]
  trash: TrashItem[]
}

export type ViewKind = 'board' | 'table' | 'calendar' | 'timeline' | 'dashboard' | 'review'

export interface Filter {
  text: string
  labelIds: ID[]
  memberIds: ID[]
  due: 'all' | 'overdue' | 'week' | 'none'
}
