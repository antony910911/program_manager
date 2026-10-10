// Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { merge3, mergeDoc } from './merge.ts'

const card = (id: string, extra = {}) => ({ id, title: id, ...extra })
const listDoc = (title: string, cards: { id: string }[]) => JSON.stringify({ list: { id: 'L', title, cardIds: cards.map((c) => c.id), color: null }, cards })

test('a card moved in here survives another device adding a card to the same list', () => {
  const base = listDoc('進行中', [card('a')])
  const local = listDoc('進行中', [card('a'), card('beamup')]) // moved in here
  const remote = listDoc('進行中', [card('a'), card('other')]) // added elsewhere
  const m = JSON.parse(mergeDoc('list-L', base, local, remote))
  assert.deepEqual(m.list.cardIds, ['a', 'beamup', 'other'])
  assert.deepEqual(m.cards.map((c: { id: string }) => c.id), m.list.cardIds)
})

test('removing here and editing elsewhere: the card stays removed; edits elsewhere to other cards are kept', () => {
  const base = listDoc('待辦', [card('a'), card('b')])
  const local = listDoc('待辦', [card('b')])
  const remote = listDoc('待辦', [card('a', { title: '改過' }), card('b', { title: 'B2' })])
  const m = JSON.parse(mergeDoc('list-L', base, local, remote))
  assert.deepEqual(m.list.cardIds, ['b'])
  assert.equal(m.cards[0].title, 'B2')
})

test('both edited the same card: different fields are both kept, the same field goes to this device', () => {
  const base = listDoc('x', [card('a', { done: false, due: null })])
  const local = listDoc('x', [card('a', { title: '本機', done: true, due: null })])
  const remote = listDoc('x', [card('a', { title: '別處', done: false, due: '2026-10-12' })])
  const m = JSON.parse(mergeDoc('list-L', base, local, remote))
  assert.deepEqual(m.cards[0], { id: 'a', title: '本機', done: true, due: '2026-10-12' })
})

test('a list renamed here and a card added elsewhere', () => {
  const base = listDoc('舊名', [card('a')])
  const local = listDoc('新名', [card('a')])
  const remote = listDoc('舊名', [card('a'), card('n')])
  const m = JSON.parse(mergeDoc('list-L', base, local, remote))
  assert.equal(m.list.title, '新名')
  assert.deepEqual(m.list.cardIds, ['a', 'n'])
})

test('reordering here keeps the new order, and items only the other side has stay put', () => {
  assert.deepEqual(merge3(['a', 'b', 'c'], ['c', 'a', 'b'], ['a', 'b', 'c', 'd']), ['c', 'a', 'b', 'd'])
})

test('unknown base (never seen here): nothing counts as removed', () => {
  const m = JSON.parse(mergeDoc('list-L', undefined, listDoc('t', [card('mine')]), listDoc('t', [card('theirs')])))
  assert.deepEqual(m.list.cardIds, ['mine', 'theirs'])
})

test('trash items merge by card', () => {
  const t = (id: string) => ({ card: { id }, deletedAt: 'x' })
  assert.deepEqual(merge3({ items: [t('a')] }, { items: [t('b'), t('a')] }, { items: [t('c'), t('a')] }), { items: [t('b'), t('c'), t('a')] })
})
