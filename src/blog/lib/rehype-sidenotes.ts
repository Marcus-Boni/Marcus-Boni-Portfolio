import type rehypeSlug from 'rehype-slug'
import { SKIP, visit } from 'unist-util-visit'

type HastRoot = Parameters<ReturnType<typeof rehypeSlug>>[0]
type HastNode = HastRoot['children'][number]
type HastElement = Extract<HastNode, { type: 'element' }>

const isElement = (node: { type: string } | undefined): node is HastElement =>
  node?.type === 'element'

/**
 * Moves each footnote next to the sentence that cites it.
 *
 * GFM gathers footnotes (`[^1]`) in a list at the end of the document. A note
 * in a notebook sits in the margin beside the line it comments on, so this
 * swaps every reference for an `x-note` element carrying the note's own
 * content; the page then floats it into the margin, or folds it under the
 * paragraph on a narrow screen.
 *
 * Only notes made of plain paragraphs move: a note holding a list or a code
 * block cannot live inside a sentence, so it keeps the standard reference and
 * stays in the list at the end. The list disappears once it is empty.
 */
export function rehypeSidenotes() {
  return (tree: HastRoot) => {
    let section: HastElement | undefined
    let holder: { children: HastNode[] } | undefined

    visit(tree, 'element', (node, _index, parent) => {
      if (node.tagName !== 'section' || node.properties.dataFootnotes === undefined) return
      section = node
      holder = parent as { children: HastNode[] }
      return SKIP
    })
    const list = section?.children.find(
      (child): child is HastElement => isElement(child) && child.tagName === 'ol',
    )
    if (!section || !holder || !list) return

    const notes = new Map<string, HastElement['children']>()
    for (const item of list.children) {
      if (!isElement(item)) continue
      const blocks = item.children.filter(isElement)
      if (blocks.length === 0 || blocks.some((child) => child.tagName !== 'p')) continue
      notes.set(
        String(item.properties.id),
        blocks.flatMap((paragraph, index) => [
          ...(index > 0
            ? [{ type: 'element' as const, tagName: 'br', properties: {}, children: [] }]
            : []),
          // The "back to the reference" arrow has nowhere to go any more.
          ...paragraph.children.filter(
            (child) => !isElement(child) || child.properties.dataFootnoteBackref === undefined,
          ),
        ]),
      )
    }

    const moved = new Set<string>()
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'sup' || index === undefined || !parent) return
      const link = node.children[0]
      if (!isElement(link) || link.properties.dataFootnoteRef === undefined) return
      const id = String(link.properties.href ?? '').slice(1)
      const body = notes.get(id)
      if (!body) return

      const label = link.children[0]
      parent.children[index] = {
        type: 'element',
        tagName: 'x-note',
        properties: { n: label?.type === 'text' ? label.value : '' },
        // Cloned: the same note can be cited twice.
        children: structuredClone(body),
      }
      moved.add(id)
      return SKIP
    })

    list.children = list.children.filter(
      (item) => !isElement(item) || !moved.has(String(item.properties.id)),
    )
    if (!list.children.some(isElement)) {
      holder.children = holder.children.filter((child) => child !== section)
    }
  }
}
