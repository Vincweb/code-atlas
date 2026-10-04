import type { ReactNode } from 'react'
import { cx } from '../util/cx'
import { LANGS, setLang, useLang, useT } from '../i18n'
import { THEMES, setTheme, useTheme } from '../state/theme'
import type { Theme } from '../state/theme'

const ThemeIcon = ({ theme }: { theme: Theme }) => {
  const paths: Record<Theme, ReactNode> = {
    light: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
      </>
    ),
    system: (
      <>
        <rect x="3" y="4.5" width="18" height="12" rx="2" />
        <path d="M8.5 20h7M12 16.5V20" />
      </>
    ),
    dark: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
  }
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[theme]}
    </svg>
  )
}

const Segmented = ({ label, children }: { label: string; children: ReactNode }) => (
  <span
    role="group"
    aria-label={label}
    className="inline-flex rounded-lg border border-line bg-panel p-0.5"
  >
    {children}
  </span>
)

const segment = (active: boolean) =>
  cx(
    'flex h-6 items-center justify-center rounded-md px-1.5 text-[11px]',
    active ? 'bg-accent text-white' : 'text-muted hover:bg-hover hover:text-text',
  )

export const ThemeSwitch = () => {
  const t = useT()
  const theme = useTheme()
  return (
    <Segmented label={t.prefs.theme}>
      {THEMES.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-pressed={value === theme}
          title={t.prefs.themes[value]}
          aria-label={t.prefs.themes[value]}
          className={segment(value === theme)}
        >
          <ThemeIcon theme={value} />
        </button>
      ))}
    </Segmented>
  )
}

export const LangSwitch = () => {
  const t = useT()
  const lang = useLang()
  return (
    <Segmented label={t.prefs.language}>
      {LANGS.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          aria-pressed={code === lang}
          className={cx(segment(code === lang), 'uppercase')}
        >
          {code}
        </button>
      ))}
    </Segmented>
  )
}

export const Prefs = () => (
  <span className="flex items-center gap-2">
    <ThemeSwitch />
    <LangSwitch />
  </span>
)
