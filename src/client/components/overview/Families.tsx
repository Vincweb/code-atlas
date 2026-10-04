import type { RuleConfig } from '../../../shared/config'
import { projectPath } from '../../../shared/routes'
import type { Analysis, FamilyScore, RuleResult } from '../../../shared/types'
import { cx } from '../../util/cx'
import { useT } from '../../i18n'
import { BAND_BOX, BAND_TEXT, bandOf } from '../../util/score'
import { ruleScore } from '../../../shared/score'
import type { Band } from '../../util/score'
import { Link } from '../Link'
import { ruleTitle } from '../../util/ruleTitle'
import { hasRun } from './model'

const BAR: Record<Band, string> = {
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  none: 'bg-line',
}

const RuleBar = ({ rule, title, root }: { rule: RuleResult; title: string; root: string }) => {
  const score = hasRun(rule) ? ruleScore(rule.severity, rule.count) : null
  const band = bandOf(score)
  return (
    <li>
      <Link
        to={projectPath(root, 'rules', rule.id)}
        className="grid grid-cols-[minmax(0,1fr)_5rem_2rem] items-center gap-2 rounded px-1 py-0.5 hover:bg-hover"
      >
        <span className="truncate text-[12px]" title={title}>
          {title}
        </span>
        <span className="h-1.5 overflow-hidden rounded-full bg-line">
          <span className={cx('block h-full', BAR[band])} style={{ width: `${score ?? 0}%` }} />
        </span>
        <span className={cx('text-right text-[12px] tabular-nums', BAND_TEXT[band])}>
          {score ?? '–'}
        </span>
      </Link>
    </li>
  )
}

const FamilyCard = ({
  family,
  rules,
  configs,
  before,
  root,
}: {
  family: FamilyScore
  rules: RuleResult[]
  configs: RuleConfig[]
  before: number | null
  root: string
}) => {
  const t = useT()
  const band = bandOf(family.score)
  const idle =
    family.family === 'tooling' || family.family === 'ai'
      ? t.learn.familyIdle[family.family]
      : t.learn.familyIdle.other
  const diff = family.score !== null && before !== null ? family.score - before : null

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-4">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold">
            {t.families[family.family] ?? family.family}
          </h3>
          <p className="text-[12px] leading-relaxed text-muted">
            {t.learn.familyText[family.family] ?? ''}
          </p>
        </div>
        <span
          className={cx(
            'flex size-12 shrink-0 items-center justify-center rounded-xl border text-[18px] font-semibold tabular-nums',
            BAND_BOX[band],
            BAND_TEXT[band],
          )}
        >
          {family.score ?? '–'}
        </span>
      </header>
      {family.score === null ? (
        <p className="rounded-lg border border-dashed border-line px-3 py-2 text-[12px] text-muted">
          {idle}
        </p>
      ) : (
        <ul className="flex flex-col">
          {rules.map((rule) => (
            <RuleBar key={rule.id} rule={rule} title={ruleTitle(rule, configs, t)} root={root} />
          ))}
        </ul>
      )}
      <footer className="mt-auto flex items-center justify-between text-[12px]">
        <span className={diff === null ? '' : diff >= 0 ? 'text-good' : 'text-bad'}>
          {diff !== null && t.learn.sinceBaseline(diff)}
        </span>
        <Link to={projectPath(root, 'rules')} className="text-accent hover:underline">
          {t.learn.seeRules} →
        </Link>
      </footer>
    </article>
  )
}

export const Families = ({ analysis, root }: { analysis: Analysis; root: string }) => {
  const t = useT()
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[16px] font-semibold tracking-tight">{t.learn.familiesTitle}</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
        {analysis.scores.families.map((family) => (
          <FamilyCard
            key={family.family}
            family={family}
            root={root}
            rules={analysis.rules.filter((rule) => rule.family === family.family)}
            configs={analysis.config.rules}
            before={
              analysis.baseline?.scores.families.find((f) => f.family === family.family)?.score ??
              null
            }
          />
        ))}
      </div>
    </section>
  )
}
