import type { ReactNode } from 'react'
import { useT } from '../../i18n'

const Icon = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    className="size-5"
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

const ICONS = [
  <Icon key="graph">
    <circle cx="5" cy="6" r="2.2" />
    <circle cx="5" cy="18" r="2.2" />
    <circle cx="19" cy="12" r="2.2" />
    <path d="M7.1 6.8 16.9 11.2M7.1 17.2l9.8-4.4" />
  </Icon>,
  <Icon key="rules">
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="m3.5 6 1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17" />
  </Icon>,
  <Icon key="terminal">
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="m7 9 3 3-3 3M13 15h4" />
  </Icon>,
  <Icon key="shield">
    <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6L12 3Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Icon>,
]

export const Features = () => {
  const t = useT()
  return (
    <section className="flex flex-col gap-4 py-8">
      <h2 className="text-[20px] font-semibold tracking-tight">{t.landing.featuresTitle}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {t.landing.features.map((feature, index) => (
          <article
            key={feature.title}
            className="flex flex-col gap-2 rounded-xl border border-line bg-panel p-4"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
              {ICONS[index]}
            </span>
            <h3 className="text-[14px] font-semibold">{feature.title}</h3>
            <p className="leading-relaxed text-muted">{feature.text}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export const Steps = () => {
  const t = useT()
  return (
    <section className="flex flex-col gap-4 py-8">
      <h2 className="text-[20px] font-semibold tracking-tight">{t.landing.stepsTitle}</h2>
      <ol className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {t.landing.steps.map((step, index) => (
          <li key={step.title} className="flex gap-3 rounded-xl border border-line bg-panel p-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-white">
              {index + 1}
            </span>
            <span className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[14px] font-semibold">{step.title}</span>
              <code className="w-fit rounded bg-code-bg px-2 py-0.5 font-mono text-[12px]">
                {step.command}
              </code>
              <span className="text-muted">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

export const Trust = () => {
  const t = useT()
  return (
    <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 py-6 text-muted">
      {t.landing.trust.map((item) => (
        <li key={item} className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-good" aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  )
}
