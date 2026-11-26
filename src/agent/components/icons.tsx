import type { SVGProps } from 'react'

/**
 * Uniform-stroke (1.5px) geometric icons for the Signal & Ink agent console.
 * Zero extra runtime dependencies, crisp at 14–16px across light and dark.
 */

type IconProps = SVGProps<SVGSVGElement>

const base: IconProps = {
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export function IconTerminal(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 5l3 3-3 3" />
      <path d="M8.5 11H13" />
    </svg>
  )
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L13.5 13.5" />
    </svg>
  )
}

export function IconLayers(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 2.5L2.5 5.5 8 8.5l5.5-3L8 2.5z" />
      <path d="M2.5 8.5L8 11.5l5.5-3" />
      <path d="M2.5 11.5L8 14.2l5.5-2.7" />
    </svg>
  )
}

export function IconBriefcase(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.2" y="5" width="11.6" height="8.2" rx="1.5" />
      <path d="M5.5 5V3.6A1.1 1.1 0 0 1 6.6 2.5h2.8a1.1 1.1 0 0 1 1.1 1.1V5" />
    </svg>
  )
}

export function IconFileText(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 2.2h5.2L12.5 5.5v8.3H4V2.2z" />
      <path d="M9.2 2.2v3.3h3.3" />
      <path d="M6 8.2h4.2" />
      <path d="M6 10.8h2.8" />
    </svg>
  )
}

export function IconSpark(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 2l1.4 4.2L13.6 7.6 9.4 9 8 13.2 6.6 9 2.4 7.6l4.2-1.4L8 2z" />
    </svg>
  )
}

export function IconMail(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
      <path d="M2.6 4.5L8 8.6l5.4-4.1" />
    </svg>
  )
}

export function IconMic(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="5.75" y="2" width="4.5" height="7.5" rx="2.25" />
      <path d="M3.5 7.8a4.5 4.5 0 0 0 9 0" />
      <path d="M8 12.3V14.2" />
    </svg>
  )
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 3v10" />
      <path d="M3 8h10" />
    </svg>
  )
}

export function IconArrowUp(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 12.5V3.5" />
      <path d="M4.2 7.2L8 3.5l3.8 3.7" />
    </svg>
  )
}

export function IconArrowUpRight(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 11.5L11.5 4.5" />
      <path d="M6 4.5h5.5V10" />
    </svg>
  )
}

export function IconChevron(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5.5 3.5L10 8l-4.5 4.5" />
    </svg>
  )
}

export function IconChevronDown(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.2 8.5l3 3 6.6-7" />
    </svg>
  )
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 4l8 8" />
      <path d="M12 4l-8 8" />
    </svg>
  )
}

export function IconCopy(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="5.5" y="5.5" width="7.5" height="7.5" rx="1" />
      <path d="M10.5 5.5V3H3v7.5h2.5" />
    </svg>
  )
}

export function IconDownload(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 2.5v8" />
      <path d="M4.8 7.5L8 10.7l3.2-3.2" />
      <path d="M3 13h10" />
    </svg>
  )
}

export function IconExpand(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9.5 2.5h4v4" />
      <path d="M13.5 2.5l-4.5 4.5" />
      <path d="M6.5 13.5h-4v-4" />
      <path d="M2.5 13.5L7 9" />
    </svg>
  )
}

export function IconReset(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.2 7.2A5 5 0 1 1 4.5 11.5" />
      <path d="M3 3.5v3.8h3.8" />
    </svg>
  )
}

export function IconSend(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M13.5 2.5L7 9" />
      <path d="M13.5 2.5l-4 11-2.5-4.5L2.5 6.5l11-4z" />
    </svg>
  )
}

export function IconSlash(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10.5 2.5l-5 11" />
    </svg>
  )
}

export function IconUser(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3.2 13.5c.8-2.4 2.6-3.5 4.8-3.5s4 1.1 4.8 3.5" />
    </svg>
  )
}
