import { projectPath } from '../../../shared/routes'
import type { Tab } from '../../../shared/routes'
import type { Analysis } from '../../../shared/types'
import { cx } from '../../cx'
import { useT } from '../../i18n'
import { Link } from '../Link'
import { CopyButton } from '../ui'
import { stepsOf } from './model'
import type { Step } from './model'

const TARGET: Record<Step['id'], Tab | null> = {
  layers: 'config',
  commands: 'rules',
  ai: 'rules',
  baseline: null,
}

const BASELINE_COMMAND = 'npx @vincweb/code-atlas --update-baseline'
const CHECK_COMMAND = 'npx @vincweb/code-atlas --check'

const Command = ({ text }: { text: string }) => (
  <span className="flex items-center gap-2">
    <code className="min-w-0 flex-1 truncate rounded bg-code-bg px-2 py-1 font-mono text-[12px]">
      {text}
    </code>
    <CopyButton text={text} />
  </span>
)

const Marker = ({ done, index }: { done: boolean; index: number }) => (
  <span
    className={cx(
      'flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold',
      done ? 'bg-good text-white' : 'border border-line text-muted',
    )}
  >
    {done ? '✓' : index + 1}
  </span>
)

export const NextSteps = ({ analysis, root }: { analysis: Analysis; root: string }) => {
  const t = useT()
  const steps = stepsOf(analysis)
  const done = steps.filter((step) => step.done).length

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[16px] font-semibold tracking-tight">{t.learn.stepsTitle}</h2>
        <span className="text-[12px] text-muted">{t.learn.stepsDone(done, steps.length)}</span>
      </div>
      <ol className="flex flex-col gap-2 rounded-xl border border-line bg-panel p-4">
        {steps.map((step, index) => {
          const copy = t.learn.steps[step.id]
          const target = TARGET[step.id]
          return (
            <li key={step.id} className="flex gap-3 border-b border-line pb-3 last:border-b-0">
              <Marker done={step.done} index={index} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className={cx('font-medium', step.done && 'text-muted line-through')}>
                  {copy.title}
                </span>
                <span className="text-[12px] text-muted">{step.done ? copy.done : copy.todo}</span>
                {!step.done && target && 'action' in copy && (
                  <Link
                    to={projectPath(root, target)}
                    className="w-fit text-[12px] text-accent hover:underline"
                  >
                    {copy.action} →
                  </Link>
                )}
                {!step.done && step.id === 'baseline' && <Command text={BASELINE_COMMAND} />}
              </div>
            </li>
          )
        })}
        <li className="flex gap-3">
          <Marker done={false} index={steps.length} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="font-medium">{t.learn.steps.ci.title}</span>
            <span className="text-[12px] text-muted">{t.learn.steps.ci.text}</span>
            <Command text={CHECK_COMMAND} />
          </div>
        </li>
      </ol>
    </section>
  )
}
