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

export interface Board {
  id: ID
  title: string
  color: string
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

export interface AppState {
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
