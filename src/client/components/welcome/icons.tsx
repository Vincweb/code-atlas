import type { ReactNode } from 'react'
import { cx } from '../../cx'

const Svg = ({ className, children }: { className?: string; children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    className={cx('shrink-0', className)}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
)

export const FolderIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h3.6l2 2.2h7.4a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7.5Z" />
  </Svg>
)

export const HomeIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M4 11 12 4.5 20 11M6 9.5V19h4.5v-5h3v5H18V9.5" />
  </Svg>
)

export const TerminalIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
    <path d="m7.5 9.5 2.5 2.5-2.5 2.5M12.5 14.5h4" />
  </Svg>
)

export const PencilIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M14.5 5.5 18.5 9.5M4 20l1-4.5L15.5 5a1.4 1.4 0 0 1 2 0l1.5 1.5a1.4 1.4 0 0 1 0 2L8.5 19 4 20Z" />
  </Svg>
)

export const ArrowUpIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Svg>
)

export const ChevronIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="m9.5 6 6 6-6 6" />
  </Svg>
)

export const SearchIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <circle cx="11" cy="11" r="6" />
    <path d="m19.5 19.5-4-4" />
  </Svg>
)

export const FilePlusIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5l-5-5Z" />
    <path d="M14 3.5v5h5M12 11.5v6M9 14.5h6" />
  </Svg>
)

export const SparkIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M11 4.5 12.8 9.2 17.5 11l-4.7 1.8L11 17.5l-1.8-4.7L4.5 11l4.7-1.8L11 4.5Z" />
    <path d="M18 15.5v4M16 17.5h4" />
  </Svg>
)
