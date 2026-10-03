import type { Analysis } from '../../shared/types'
import { useT } from '../i18n'
import { useDraft } from '../queries'
import { DraftSection, FileSection, ReferenceSection } from './config/Files'
import { Intro } from './config/Intro'
import {
  AiSection,
  AllowSection,
  FeaturesSection,
  LayersSection,
  RulesSection,
  ScopeSection,
} from './config/Sections'

export const ConfigTab = ({ analysis, root }: { analysis: Analysis; root: string }) => {
  const t = useT()
  const draft = useDraft(root)
  const help = t.configHelp
  const nav: [string, string][] = [
    ...(draft.data || draft.isPending ? [['draft', help.draft.title] as [string, string]] : []),
    ['scope', help.scope.title],
    ['features', help.features.title],
    ['layers', help.layers.title],
    ['allow', help.allow.title],
    ['rules', help.rules.title],
    ['ai', help.aiAudits.title],
    ['file', help.file.title],
    ['reference', help.reference.title],
  ]
  const generate = () => {
    draft.mutate(undefined, {
      onSuccess: () =>
        requestAnimationFrame(() =>
          document.getElementById('draft')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        ),
    })
  }

  return (
    <div className="flex flex-col gap-5 pb-10">
      <Intro analysis={analysis} root={root} onDraft={generate} drafting={draft.isPending} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <nav className="hidden lg:block">
          <div className="sticky top-4 flex flex-col gap-0.5">
            <span className="mb-1 px-2 text-[11px] font-semibold tracking-wide text-muted uppercase">
              {help.nav}
            </span>
            {nav.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={(event) => {
                  event.preventDefault()
                  document
                    .getElementById(id)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className="rounded-md px-2 py-1 text-muted hover:bg-hover hover:text-text"
              >
                {label}
              </a>
            ))}
          </div>
        </nav>
        <div className="flex min-w-0 flex-col gap-5">
          <DraftSection
            draft={draft.data}
            error={draft.error}
            pending={draft.isPending}
            onRegenerate={generate}
          />
          <ScopeSection analysis={analysis} />
          <FeaturesSection analysis={analysis} />
          <LayersSection analysis={analysis} />
          <AllowSection analysis={analysis} />
          <RulesSection analysis={analysis} root={root} />
          <AiSection analysis={analysis} root={root} />
          <FileSection analysis={analysis} />
          <ReferenceSection />
        </div>
      </div>
    </div>
  )
}
