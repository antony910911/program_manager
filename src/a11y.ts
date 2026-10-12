/**
 * Icon-only buttons (a ⋯, a ×, an arrow) show their purpose in a hover `title`, which screen readers such as
 * iPhone's VoiceOver don't reliably read. Give each such button the same text as its accessible name, now and
 * whenever buttons are added or their title changes. Buttons with visible text or their own aria-label are
 * left alone.
 */
export function nameIconButtons(root: HTMLElement = document.body) {
  const label = (b: Element) => {
    const title = b.getAttribute('title')
    if (!title || b.textContent?.trim()) return
    const current = b.getAttribute('aria-label')
    if (current === null || b.hasAttribute('data-auto-label')) {
      if (current !== title) b.setAttribute('aria-label', title)
      b.setAttribute('data-auto-label', '')
    }
  }
  const scan = (node: Node) => {
    if (!(node instanceof Element)) return
    if (node.matches('button[title]')) label(node)
    node.querySelectorAll('button[title]').forEach(label)
  }
  scan(root)
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'attributes') label(r.target as Element)
      else r.addedNodes.forEach(scan)
    }
  }).observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['title'] })
}
