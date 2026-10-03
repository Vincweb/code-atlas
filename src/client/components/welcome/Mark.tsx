export const Mark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    <rect width="32" height="32" rx="8" className="fill-accent" />
    <path
      d="M10 10.5 22 16M10 21.5 22 16M10 10.5v11"
      fill="none"
      stroke="white"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <circle cx="10" cy="10.5" r="2.6" fill="white" />
    <circle cx="10" cy="21.5" r="2.6" fill="white" />
    <circle cx="22" cy="16" r="3" fill="white" />
  </svg>
)
