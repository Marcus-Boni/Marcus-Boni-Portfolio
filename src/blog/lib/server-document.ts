import { useLayoutEffect } from 'react'

/**
 * Hand-off between the edge-rendered blog HTML and the React view.
 *
 * netlify/edge-functions/blog-meta.ts puts the full article (or index) inside
 * #root. `createRoot` clears its container on the first commit, so without this
 * the reader would see the text, then a blank shell, then "loading" while the
 * Firestore SDK fetches the same post again. Lifting the server markup out of
 * #root keeps it on screen until React has real content to replace it with.
 *
 * If the client fetch fails the server document simply stays: it is a complete,
 * readable page with plain links, which beats an error state.
 */
let lifted: HTMLElement | null = null

export function liftServerDocument(root: HTMLElement) {
  const document_ = root.querySelector<HTMLElement>(':scope > .blog-document')
  if (!document_) return
  const holder = document.createElement('div')
  holder.id = 'server-document'
  const style = document_.previousElementSibling
  if (style?.tagName === 'STYLE') holder.append(style)
  holder.append(document_)
  root.before(holder)
  root.style.display = 'none'
  lifted = holder
}

function releaseServerDocument() {
  if (!lifted) return
  lifted.remove()
  lifted = null
  document.getElementById('root')?.style.removeProperty('display')
}

/** Swap to the React view in the same frame it first has data to show. */
export function useReleaseServerDocument(ready: boolean) {
  useLayoutEffect(() => {
    if (ready) releaseServerDocument()
  }, [ready])
}
