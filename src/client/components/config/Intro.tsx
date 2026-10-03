import type { ReactNode } from 'react'
import type { Analysis } from '../../../shared/types'
import { cx } from '../../cx'
import { useT } from '../../i18n'
import { useCreateConfig, useInvalidateAnalysis } from '../../queries'
import { ClaudeActions } from '../ClaudeActions'
import { configPrompt } from '../../util/claudePrompt'
import { Button, ErrorBox, Spinner } from '../ui'

const Step = ({
  index,
  done,
  title,
  text,
  children,
}: {
  index: number
  done: boolean
  title: string
  text: string
  children?: ReactNode
}) => (
  <li className="flex gap-3">
    <span
      className={cx(
        'flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold',
        done ? 'bg-good text-white' : 'bg-accent text-white',
      )}
    >
      {done ? '✓' : index}
    </span>
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="font-semibold">{title}</span>
      <span className="text-[12px] leading-relaxed text-muted">{text}</span>
      {children}
    </div>
  </li>
)

export const Intro = ({
  analysis,
  root,
  onDraft,
  drafting,
}: {
  analysis: Analysis
  root: string
  onDraft: () => void
  drafting: boolean
}) => {
  const t = useT()
  const help = t.configHelp
  const steps = help.steps
  const create = useCreateConfig(root)
  const reanalyse = useInvalidateAnalysis(root)
  const isDefault = analysis.configSource === 'default'
  const prompt = configPrompt(analysis, t)

  const createFile = () => {
    if (window.confirm(steps.create.confirm)) create.mutate()
  }

  return (
    <section className="grid grid-cols-1 gap-5 rounded-2xl border border-line bg-panel p-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="flex flex-col gap-3">
        <h2 className="text-[20px] font-semibold tracking-tight">{help.introTitle}</h2>
        <p className="leading-relaxed">{help.intro}</p>
        <div
          className={cx(
            'flex flex-col gap-1.5 rounded-xl border px-4 py-3',
            isDefault ? 'border-warn-line bg-warn-bg' : 'border-good-line bg-good-bg',
          )}
        >
          <span className={cx('font-medium', isDefault ? 'text-warn' : 'text-good')}>
            {t.config.sources[analysis.configSource]}
          </span>
          {analysis.configPath && (
            <code className="font-mono text-[12px] break-all text-muted">
              {analysis.configPath}
            </code>
          )}
          <span className="text-[12px] leading-relaxed text-muted">
            {isDefault ? help.withoutConfig : help.withConfig}
          </span>
        </div>
      </div>

      <ol className="flex flex-col gap-4 rounded-xl border border-line bg-bg p-4">
        {isDefault && (
          <Step index={1} done={false} title={steps.draft.title} text={steps.draft.text}>
            <Button onClick={onDraft} disabled={drafting} className="flex w-fit items-center gap-2">
              {drafting && <Spinner />}
              {steps.draft.action}
            </Button>
          </Step>
        )}
        <Step
          index={isDefault ? 2 : 1}
          done={!isDefault}
          title={steps.create.title}
          text={isDefault ? steps.create.text : steps.create.done}
        >
          {isDefault && (
            <Button
              primary
              onClick={createFile}
              disabled={create.isPending}
              className="flex w-fit items-center gap-2"
            >
              {create.isPending && <Spinner className="border-white/40 border-t-white" />}
              {steps.create.action}
            </Button>
          )}
          {create.error && <ErrorBox message={create.error.message} />}
        </Step>
        <Step
          index={isDefault ? 3 : 2}
          done={false}
          title={steps.claude.title}
          text={steps.claude.text}
        >
          <ClaudeActions prompt={prompt} cwd={analysis.root} primary={!isDefault} />
        </Step>
        <Step
          index={isDefault ? 4 : 3}
          done={false}
          title={steps.reanalyse.title}
          text={steps.reanalyse.text}
        >
          <Button onClick={() => void reanalyse()} className="w-fit">
            {steps.reanalyse.action}
          </Button>
        </Step>
      </ol>
    </section>
  )
}
