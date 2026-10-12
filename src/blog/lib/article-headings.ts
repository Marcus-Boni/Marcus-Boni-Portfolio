import type rehypeSlug from 'rehype-slug'
import { visit } from 'unist-util-visit'

/** The page title owns h1; keep generated IDs while nesting authored headings. */
export function articleHeadings() {
  return (tree: Parameters<ReturnType<typeof rehypeSlug>>[0]) => {
    let hasTitle = false
    visit(tree, 'element', (node) => { if (node.tagName === 'h1') hasTitle = true })
    if (!hasTitle) return
    visit(tree, 'element', (node) => {
      if (/^h[1-6]$/.test(node.tagName)) node.tagName = `h${Math.min(6, Number(node.tagName[1]) + 1)}`
    })
  }
}
