import type { Root } from 'mdast'
import { visit } from 'unist-util-visit'

/**
 * Turns `remark-directive` nodes into custom hast elements that `PostBody`'s
 * component map renders.
 *
 * Authoring syntax:
 *
 *   :::callout{type=tip}          container — rich body
 *   Texto do aviso.
 *   :::
 *
 *   :::quote{cite="Fulano"}       container — pull quote
 *   ...
 *   :::
 *
 *   :::takeaways                  container — the entry's key ideas
 *   - Uma ideia por linha.
 *   :::
 *
 *   :::gallery{columns=2}         container — grid of images
 *   ![a](media:abc)
 *   ![b](media:def)
 *   :::
 *
 *   ::::steps                     container — walkthrough; note the 4 colons,
 *   ```ts                         needed because it holds other containers
 *   const a = 1
 *   ```
 *   :::step{lines=1}
 *   O que a linha 1 faz.
 *   :::
 *   ::::
 *
 *   ::youtube{id=dQw4w9WgXcQ}     leaf — lazy YouTube facade
 *   ::video{src=... poster=...}   leaf — self-hosted short clip
 *   ::repo{owner=... name=...}    leaf — GitHub repository card
 *
 * An unknown directive is downgraded to a plain paragraph instead of throwing,
 * so a typo in the editor never blanks the whole post.
 */

const CONTAINER_DIRECTIVES = new Set(['callout', 'quote', 'gallery', 'takeaways', 'steps', 'step'])
const LEAF_DIRECTIVES = new Set(['youtube', 'video', 'repo'])

interface BlockNode {
  type: string
  name?: string
  value?: string
  children?: BlockNode[]
  attributes?: Record<string, string | null | undefined> | null
  data?: {
    hName?: string
    hProperties?: Record<string, unknown>
  }
}

interface DirectiveNode extends BlockNode {
  name: string
}

function isDirective(node: { type: string }): node is DirectiveNode {
  return (
    node.type === 'containerDirective' ||
    node.type === 'leafDirective' ||
    node.type === 'textDirective'
  )
}

/** What a walkthrough can pin: a code fence, or a paragraph that is only images. */
function isStageMedia(node: BlockNode | undefined): node is BlockNode {
  if (!node) return false
  if (node.type === 'code') return true
  const kids = node.children ?? []
  return (
    node.type === 'paragraph' &&
    kids.some((child) => child.type === 'image') &&
    kids.every((child) => child.type === 'image' || (child.type === 'text' && !child.value?.trim()))
  )
}

/** A node `mdast-util-to-hast` does not know: it becomes the element named here. */
function block(hName: string, children: BlockNode[], hProperties: Record<string, unknown> = {}): BlockNode {
  return { type: 'blogBlock', children, data: { hName, hProperties } }
}

/**
 * Regroups a `::::steps` container into the two columns the page lays out:
 * a stage holding what stays pinned, and the list of steps that scroll past.
 *
 * Whatever comes before the first step is the shared pane. A step that opens
 * with its own code fence or image starts a new pane; a step without one keeps
 * the pane above it and only moves the highlighted lines. The resulting
 * `plan` (`pane:lines|pane:lines`) is all the client needs to follow along.
 */
function arrangeSteps(node: BlockNode) {
  const panes: BlockNode[][] = []
  const steps: BlockNode[] = []

  for (const child of node.children ?? []) {
    if (child.type === 'containerDirective' && child.name === 'step') {
      const [first, ...rest] = child.children ?? []
      if (isStageMedia(first)) {
        panes.push([first])
        child.children = rest
      }
      child.attributes = {
        ...child.attributes,
        index: String(steps.length),
        pane: String(Math.max(0, panes.length - 1)),
      }
      steps.push(child)
    } else if (steps.length > 0) {
      // Prose left between two steps belongs to the step above it.
      steps[steps.length - 1].children?.push(child)
    } else {
      if (panes.length === 0) panes.push([])
      panes[0].push(child)
    }
  }

  node.attributes = {
    plan: steps.map((step) => `${step.attributes?.pane}:${step.attributes?.lines ?? ''}`).join('|'),
  }
  node.children = [
    block('x-steps-stage', panes.map((kids, index) => block('x-steps-pane', kids, { index: String(index) }))),
    block('x-steps-notes', steps),
  ]
}

export function remarkBlogDirectives() {
  return (tree: Root) => {
    visit(tree, (node) => {
      if (!isDirective(node)) return

      const isKnown =
        (node.type === 'containerDirective' &&
          CONTAINER_DIRECTIVES.has(node.name)) ||
        (node.type === 'leafDirective' && LEAF_DIRECTIVES.has(node.name))

      const data = node.data ?? (node.data = {})

      if (!isKnown) {
        // Unrecognised — render the inner content as an ordinary block rather
        // than emitting an unknown element React would warn about.
        data.hName = 'div'
        data.hProperties = {}
        return
      }

      // Before the attributes are read: this rewrites them, and the visitor
      // then walks into the regrouped children, steps included.
      if (node.name === 'steps') arrangeSteps(node)

      data.hName = `x-${node.name}`
      data.hProperties = Object.fromEntries(
        Object.entries(node.attributes ?? {})
          .filter((entry): entry is [string, string] => entry[1] != null)
          // hast properties are lowercased on the way to React; keep the keys
          // simple (`type`, `id`, `src`) so the components read naturally.
          .map(([key, value]) => [key, value]),
      )
    })
  }
}
