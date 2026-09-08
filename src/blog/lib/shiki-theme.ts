import type { ThemeRegistrationRaw } from 'shiki/core'

/**
 * A Shiki theme built from the site's own tokens instead of importing a
 * generic one. Signal & Ink is monochrome plus a single ember accent, so the
 * code blocks stay in that discipline: structure is carried by the bone/smoke
 * ramp, ember marks control flow, and only two warm derived hues (sand for
 * strings, ember-tinted amber for literals) are added so code stays scannable.
 *
 * Keep these values in sync with the `@theme` block in `src/styles/index.css`.
 */

const ink = '#0d0c0a'
const bone = '#ece7df'
const boneDim = '#b5afa4'
const smoke = '#7a7368'
const ember = '#ff4d17'

/** Derived, deliberately desaturated so nothing competes with ember. */
const sand = '#c9b896'
const amber = '#d98b5f'
const clay = '#bfa98a'

export const signalInkTheme: ThemeRegistrationRaw = {
  name: 'signal-ink',
  type: 'dark',
  colors: {
    'editor.background': ink,
    'editor.foreground': bone,
  },
  settings: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: smoke, fontStyle: 'italic' } },
    { scope: ['keyword', 'keyword.control', 'storage', 'storage.type', 'keyword.operator.new', 'keyword.operator.expression'], settings: { foreground: ember } },
    { scope: ['string', 'string.quoted', 'string.template', 'punctuation.definition.string'], settings: { foreground: sand } },
    { scope: ['constant.numeric', 'constant.language', 'constant.character', 'keyword.other.unit'], settings: { foreground: amber } },
    { scope: ['entity.name.function', 'support.function', 'meta.function-call.generic'], settings: { foreground: bone } },
    { scope: ['entity.name.type', 'entity.name.class', 'support.type', 'support.class', 'entity.other.inherited-class'], settings: { foreground: clay } },
    { scope: ['variable', 'variable.other', 'meta.definition.variable'], settings: { foreground: boneDim } },
    { scope: ['variable.parameter'], settings: { foreground: boneDim, fontStyle: 'italic' } },
    { scope: ['variable.other.property', 'support.variable.property', 'meta.object-literal.key'], settings: { foreground: bone } },
    { scope: ['punctuation', 'meta.brace', 'keyword.operator'], settings: { foreground: smoke } },
    { scope: ['entity.name.tag', 'punctuation.definition.tag'], settings: { foreground: ember } },
    { scope: ['entity.other.attribute-name'], settings: { foreground: clay } },
    { scope: ['markup.heading', 'entity.name.section'], settings: { foreground: bone, fontStyle: 'bold' } },
    { scope: ['markup.inserted', 'meta.diff.header.to-file'], settings: { foreground: sand } },
    { scope: ['markup.deleted', 'meta.diff.header.from-file'], settings: { foreground: ember } },
    { scope: ['invalid', 'invalid.illegal'], settings: { foreground: ember, fontStyle: 'underline' } },
  ],
}
