import { polyfill } from 'mobile-drag-drop'
import { scrollBehaviourDragImageTranslateOverride } from 'mobile-drag-drop/scroll-behaviour'
import 'mobile-drag-drop/default.css'

/**
 * Phones and tablets don't fire HTML5 drag events for touch, so cards and lists
 * couldn't be dragged there. The polyfill turns a long press + move into the same
 * drag events the mouse produces, so all drag-and-drop code works unchanged.
 * Long press (instead of an immediate drag) keeps normal swipe-scrolling working.
 */
export function enableTouchDrag() {
  // iPadOS reports a desktop Mac user agent, so the polyfill's own check misses it.
  const iPad = /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1
  const applied = polyfill({
    holdToDrag: 250,
    // The library's default lookup reads event.composedPath(), which is empty by the time the
    // hold timer fires, so long-press drags never started. Walk up from the touched element instead.
    tryFindDraggableTarget: (e: TouchEvent) => {
      for (let el = e.target as HTMLElement | null; el && el !== document.body; el = el.parentElement)
        if (el.getAttribute('draggable') === 'true') return el
      return undefined
    },
    // The default returns undefined (not null) off-screen, which crashes the library mid-drag.
    elementFromPoint: (x: number, y: number) => document.elementFromPoint(x, y) as Element, // may be null; the library handles null, not undefined
    forceApply: iPad,
    dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride,
  })
  document.documentElement.dataset.touchDrag = applied ? 'polyfill' : 'native'
  if (applied) {
    // Some touch browsers (Chrome on Android) also start their own native drag on long press,
    // which fights the polyfill. For touch input, let only the polyfill's drag through.
    let pointerType = 'mouse'
    window.addEventListener('pointerdown', (e) => (pointerType = e.pointerType), true)
    window.addEventListener(
      'dragstart',
      (e) => {
        if (e.isTrusted && pointerType === 'touch') {
          e.preventDefault()
          e.stopPropagation()
        }
      },
      true,
    )
    // The polyfill follows the spec strictly: an element only becomes the drop target if it
    // cancels dragenter. Desktop browsers also accept a cancelled dragover, which is all the
    // components do, so accept every polyfilled dragenter and let dragover decide as before.
    document.addEventListener('dragenter', (e) => {
      if (!e.isTrusted) e.preventDefault()
    })
  }
  // iOS Safari needs a non-passive touchmove listener for the polyfill to block scrolling mid-drag.
  window.addEventListener('touchmove', () => {}, { passive: false })
}
