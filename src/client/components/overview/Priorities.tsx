import { projectPath } from '../../../shared/routes'
import type { Analysis } from '../../../shared/types'
import { useT } from '../../i18n'
import { Link } from '../Link'
import { SeverityBadge } from '../rules/badges'
import { ruleTitle } from '../../util/ruleTitle'
import { prioritiesOf } from './model'
import type { Priority } from './model'

const GRAPH_KINDS = new Set(['layers', 'mutual', 'siblings', 'no-cycle'])

const Item = ({ priority, title, root }: { priority: Priority; title: string; root: string }) => {
  const t = useT()
  const { rule, gain } = priority
  const lesson = t.learn.kinds[rule.kind]
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-4">
      <header className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={rule.severity} />
        <h3 className="min-w-0 flex-1 truncate font-semibold">{title}</h3>
        <span className="text-[12px] text-muted">{t.families[rule.family] ?? rule.family}</span>
        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[12px] font-medium text-accent">
          {t.learn.gain(gain)}
        </span>
      </header>
      {lesson && (
        <dl className="grid grid-cols-1 gap-3 text-[12px] leading-relaxed sm:grid-cols-3">
          {(['what', 'why', 'fix'] as const).map((key) => (
            <div key={key}>
              <dt className="mb-0.5 font-semibold text-muted">{t.learn[key]}</dt>
              <dd>{lesson[key]}</dd>
            </div>
          ))}
        </dl>
      )}
      <footer className="flex flex-wrap gap-4 text-[12px]">
        <Link to={projectPath(root, 'rules', rule.id)} className="text-accent hover:underline">
          {t.learn.seeCases(rule.count)} →
        </Link>
        {GRAPH_KINDS.has(rule.kind) && (
          <Link to={projectPath(root, 'graph')} className="text-accent hover:underline">
            {t.learn.seeGraph} →
          </Link>
        )}
      </footer>
    </li>
  )
}

export const Priorities = ({ analysis, root }: { analysis: Analysis; root: string }) => {
  const t = useT()
  const priorities = prioritiesOf(analysis.rules)
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[16px] font-semibold tracking-tight">{t.learn.prioritiesTitle}</h2>
        <p className="text-muted">{t.learn.prioritiesText}</p>
      </div>
      {priorities.length === 0 ? (
        <p className="rounded-xl border border-good-line bg-good-bg px-4 py-3 text-good">
          {t.learn.noPriorities}
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {priorities.map((priority) => (
            <Item
              key={priority.rule.id}
              priority={priority}
              title={ruleTitle(priority.rule, analysis.config.rules, t)}
              root={root}
            />
          ))}
        </ol>
      )}
    </section>
  )
}
