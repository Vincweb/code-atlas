import { useState } from 'react'
import { CONFIG_FILE } from '../../../shared/config'
import type { Analysis } from '../../../shared/types'
import { useT } from '../../i18n'
import { auditPrompt } from '../../util/claudePrompt'
import { ClaudeActions } from '../ClaudeActions'
import { Code } from '../config/parts'
import { SeverityBadge } from '../rules/badges'
import { Badge, Button } from '../ui'

type Idea = ReturnType<typeof useT>['audits']['ideas'][number]

const IdeaCard = ({ idea, analysis }: { idea: Idea; analysis: Analysis }) => {
  const t = useT()
  const help = t.audits
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const present = analysis.config.rules.some((rule) => rule.id === idea.id)
  const rule = JSON.stringify(
    {
      id: idea.id,
      family: 'ai',
      severity: idea.severity,
      kind: 'ai',
      title: idea.title,
      prompt: idea.prompt,
    },
    null,
    2,
  )
  const prompt = help.addPrompt({
    root: analysis.root,
    target: analysis.configPath ?? `${analysis.root}/${CONFIG_FILE}`,
    rule,
    describe: analysis.describeCommand,
  })
  const copy = () => {
    void navigator.clipboard.writeText(rule).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-line bg-bg p-4">
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{idea.title}</span>
        <SeverityBadge severity={idea.severity} />
        {present && (
          <Badge className="border-good-line bg-good-bg text-good">{help.inConfig}</Badge>
        )}
      </span>
      <span className="text-[12px] leading-relaxed text-muted">{idea.text}</span>
      <span className="flex flex-wrap gap-2">
        <Button onClick={() => setOpen((on) => !on)} aria-expanded={open}>
          {open ? help.hideFull : help.showFull}
        </Button>
        <Button onClick={copy}>{copied ? help.ruleCopied : help.copyRule}</Button>
      </span>
      {open && (
        <div className="flex flex-col gap-3">
          <blockquote className="rounded-lg border-l-4 border-accent bg-panel px-3 py-2 text-[12px] leading-relaxed">
            {idea.prompt}
          </blockquote>
          {!present && <ClaudeActions prompt={prompt} cwd={analysis.root} />}
        </div>
      )}
    </li>
  )
}

export const Ideas = ({ analysis }: { analysis: Analysis }) => {
  const t = useT()
  const help = t.audits
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[16px] font-semibold tracking-tight">{help.ideasTitle}</h2>
        <p className="text-muted">{help.ideasText}</p>
      </div>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {help.ideas.map((idea) => (
          <IdeaCard key={idea.id} idea={idea} analysis={analysis} />
        ))}
      </ul>
      <details className="rounded-2xl border border-line bg-panel p-5">
        <summary className="cursor-pointer text-[16px] font-semibold tracking-tight">
          {help.createTitle}
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <p className="leading-relaxed text-muted">{help.createText}</p>
          <Code text={help.example} />
          <ClaudeActions prompt={auditPrompt(analysis, t)} cwd={analysis.root} />
        </div>
      </details>
    </section>
  )
}
