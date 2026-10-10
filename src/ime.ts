/**
 * Keeps the Enter that confirms an input-method candidate (注音、拼音、日文…) from also submitting.
 *
 * Browsers differ: Chrome sends that Enter with `isComposing`, Safari sends it with keyCode 229 just
 * after `compositionend`. A capture listener on the document sees it before React or a form does,
 * stops it there, and in Safari's case also cancels the form's implicit submission.
 */
export function installImeGuard() {
  let lastEnd = -Infinity
  document.addEventListener('compositionend', () => (lastEnd = performance.now()), true)
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Enter') return
      if (!e.isComposing && e.keyCode !== 229 && performance.now() - lastEnd > 120) return
      e.stopPropagation()
      // Composition already over (Safari): this Enter would only submit the form, so cancel it.
      if (!e.isComposing) e.preventDefault()
    },
    true,
  )
}
