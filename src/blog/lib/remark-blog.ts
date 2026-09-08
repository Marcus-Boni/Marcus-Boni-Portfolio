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
 *   :::gallery{columns=2}         container — grid of images
 *   ![a](media:abc)
 *   ![b](media:def)
 *   :::
 *
 *   ::youtube{id=dQw4w9WgXcQ}     leaf — lazy YouTube facade
 *   ::video{src=... poster=...}   leaf — self-hosted short clip
 *   ::repo{owner=... name=...}    leaf — GitHub repository card
 *
 * An unknown directive is downgraded to a plain paragraph instead of throwing,
 * so a typo in the editor never blanks the whole post.
 */

const CONTAINER_DIRECTIVES = new Set(['callout', 'quote', 'gallery'])
const LEAF_DIRECTIVES = new Set(['youtube', 'video', 'repo'])

interface DirectiveNode {
  type: string
  name: string
  attributes?: Record<string, string | null | undefined>
  data?: {
    hName?: string
    hProperties?: Record<string, unknown>
  }
}

function isDirective(node: { type: string }): node is DirectiveNode {
  return (
    node.type === 'containerDirective' ||
    node.type === 'leafDirective' ||
    node.type === 'textDirective'
  )
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
