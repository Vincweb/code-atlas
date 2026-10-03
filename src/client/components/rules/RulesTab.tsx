import { useState } from 'react'
import { projectPath } from '../../../shared/routes'
import type { Analysis, RuleResult } from '../../../shared/types'
import { cx } from '../../cx'
import { useT } from '../../i18n'
import { useInvalidateAnalysis } from '../../queries'
import { useRoute } from '../../router'
import { ruleTitle } from '../../util/ruleTitle'
import { BAND_TEXT, bandOf } from '../../util/score'
import { RunDialog } from '../audits/RunDialog'
import { Link } from '../Link'
import { SearchIcon } from '../welcome/icons'
import { Button } from '../ui'
import { matchesStatus, sortRules } from './model'
import type { StatusFilter } from './model'
import { RuleCard } from './RuleCard'
import { useRunner } from './useRunner'

const FILTERS: StatusFilter[] = ['all', 'fail', 'pass', 'pending']

export const RulesTab = ({ analysis, root }: { analysis: Analysis; root: string }) => {
  const t = useT()
  const focused = useRoute().rule
  const invalidate = useInvalidateAnalysis(root)
  const runner = useRunner(root, () => void invalidate())
  const [status, setStatus] = useState<StatusFilter>('all')
  const [family, setFamily] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)

  const run = (rule: RuleResult) => {
    if (rule.kind === 'ai') setConfirming(rule.id)
    else void runner.runOne(rule.id)
  }
  const commandIds = analysis.rules.filter((rule) => rule.kind === 'command').map((r) => r.id)

  const titled = analysis.rules.map((rule) => ({
    rule,
    title: ruleTitle(rule, analysis.config.rules, t),
  }))
  const needle = query.trim().toLowerCase()
  const visible = titled.filter(
    ({ rule, title }) =>
      matchesStatus(rule, status) &&
      (family === null || rule.family === family) &&
      (!needle || `${rule.id} ${title}`.toLowerCase().includes(needle)),
  )
  const counts = {
    all: analysis.rules.length,
    fail: analysis.rules.filter((r) => matchesStatus(r, 'fail')).length,
    pass: analysis.rules.filter((r) => matchesStatus(r, 'pass')).length,
    pending: analysis.rules.filter((r) => matchesStatus(r, 'pending')).length,
  }

  return (
    <div className="flex flex-col gap-5 pb-10">
      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="font-semibold">{t.rules.summary(counts.all)}</span>
          <span className="text-bad">{t.rules.failingCount(counts.fail)}</span>
          <span className="text-good">{t.rules.passingCount(counts.pass)}</span>
          <span className="text-muted">{t.rules.pendingCount(counts.pending)}</span>
          <span className="ml-auto flex flex-wrap gap-2">
            <Button
              onClick={() => void runner.runAll(commandIds)}
              disabled={runner.busy || !commandIds.length}
            >
              {t.rules.runAllCommands}
            </Button>
            {runner.busy && (
              <Button onClick={runner.cancelAll}>{t.rules.cancelAll(runner.queue.length)}</Button>
            )}
            <Link
              to={projectPath(root, 'audits')}
              className="rounded border border-line bg-panel px-2.5 py-1 hover:bg-hover"
            >
              {t.rules.seeAudits} →
            </Link>
          </span>
        </div>
        <p className="text-[12px] leading-relaxed text-muted">{t.rules.intro}</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-lg border border-line bg-bg p-0.5">
            {FILTERS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                aria-pressed={status === value}
                className={cx(
                  'rounded-md px-2.5 py-1',
                  status === value
                    ? 'bg-accent text-white'
                    : 'text-muted hover:bg-hover hover:text-text',
                )}
              >
                {t.rules.filters[value]} <span className="opacity-70">{counts[value]}</span>
              </button>
            ))}
          </span>
          <span className="flex flex-wrap gap-1.5">
            {[null, ...analysis.scores.families.map((f) => f.family)].map((name) => (
              <button
                key={name ?? 'all'}
                type="button"
                onClick={() => setFamily(name)}
                aria-pressed={family === name}
                className={cx(
                  'rounded-full border px-2.5 py-0.5 text-[12px]',
                  family === name
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-line hover:bg-hover',
                )}
              >
                {name === null ? t.rules.allFamilies : (t.families[name] ?? name)}
              </button>
            ))}
          </span>
          <label className="ml-auto flex min-w-48 items-center gap-2 rounded-lg border border-line bg-bg px-2.5 py-1">
            <SearchIcon className="size-4 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.rules.search}
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent outline-none"
            />
          </label>
        </div>
      </section>

      {visible.length === 0 && (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-muted">
          {t.rules.noMatch}
        </p>
      )}

      {analysis.scores.families.map((familyScore) => {
        const members = sortRules(
          visible.filter(({ rule }) => rule.family === familyScore.family).map(({ rule }) => rule),
        )
        if (members.length === 0) return null
        return (
          <section key={familyScore.family} className="flex flex-col gap-2">
            <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-[16px] font-semibold tracking-tight">
                {t.families[familyScore.family] ?? familyScore.family}
              </h2>
              <span
                className={cx('font-semibold tabular-nums', BAND_TEXT[bandOf(familyScore.score)])}
              >
                {familyScore.score ?? t.common.notRun}
              </span>
              <span className="text-[12px] text-muted">
                {t.learn.familyText[familyScore.family] ?? ''}
              </span>
            </header>
            <ul className="flex flex-col gap-2">
              {members.map((rule) => (
                <RuleCard
                  key={rule.id}
                  analysis={analysis}
                  rule={rule}
                  title={titled.find((entry) => entry.rule.id === rule.id)?.title ?? rule.title}
                  focused={rule.id === focused}
                  state={runner.states[rule.id]}
                  locked={runner.busy}
                  onRun={() => run(rule)}
                  onCancel={() => runner.cancel(rule.id)}
                />
              ))}
            </ul>
          </section>
        )
      })}
      {confirming && (
        <RunDialog
          analysis={analysis}
          ids={[confirming]}
          onConfirm={() => {
            void runner.runOne(confirming)
            setConfirming(null)
          }}
          onClose={() => setConfirming(null)}
        />
      )}
    </div>
  )
}
