import { useState } from 'react'
import type { Analysis } from '../../../shared/types'
import { useT } from '../../i18n'
import { useInvalidateAnalysis } from '../../state/queries'
import { ruleTitle } from '../../util/ruleTitle'
import { useRunner } from '../rules/useRunner'
import { AuditCard } from './AuditCard'
import { Explainer } from './Explainer'
import { Extras } from './Extras'
import { AuditsHeader } from './Header'
import { Ideas } from './Ideas'
import { RunDialog } from './RunDialog'

export const AuditsTab = ({ analysis, root }: { analysis: Analysis; root: string }) => {
  const t = useT()
  const help = t.audits
  const invalidate = useInvalidateAnalysis(root)
  const runner = useRunner(root, () => void invalidate())
  const items = analysis.audits.items
  const everRan = analysis.rules.some((rule) => rule.kind === 'ai' && rule.ranAt !== null)
  const [confirming, setConfirming] = useState<{ ids: string[]; all: boolean } | null>(null)

  const confirm = () => {
    if (!confirming) return
    const [first] = confirming.ids
    if (confirming.all) void runner.runAll(confirming.ids)
    else if (first) void runner.runOne(first)
    setConfirming(null)
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <AuditsHeader
        analysis={analysis}
        busy={runner.busy}
        onRunAll={() => setConfirming({ ids: items.map((item) => item.id), all: true })}
        onCancelAll={runner.cancelAll}
        left={runner.queue.length}
      />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-[16px] font-semibold tracking-tight">{help.listTitle}</h2>
          <p className="text-muted">{help.listText}</p>
        </div>
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-muted">
            {help.none}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((preview) => {
              const rule = analysis.config.rules.find((candidate) => candidate.id === preview.id)
              if (rule?.kind !== 'ai') return null
              const result = analysis.rules.find((candidate) => candidate.id === preview.id)
              return (
                <AuditCard
                  key={preview.id}
                  analysis={analysis}
                  preview={preview}
                  rule={rule}
                  result={result}
                  title={result ? ruleTitle(result, analysis.config.rules, t) : preview.id}
                  root={root}
                  state={runner.states[preview.id]}
                  locked={runner.busy}
                  onRun={() => setConfirming({ ids: [preview.id], all: false })}
                  onCancel={() => runner.cancel(preview.id)}
                />
              )
            })}
          </ul>
        )}
      </section>

      <Ideas analysis={analysis} />
      <Explainer analysis={analysis} open={!everRan} />
      <Extras analysis={analysis} />
      {confirming && (
        <RunDialog
          analysis={analysis}
          ids={confirming.ids}
          onConfirm={confirm}
          onClose={() => setConfirming(null)}
        />
      )}
    </div>
  )
}
