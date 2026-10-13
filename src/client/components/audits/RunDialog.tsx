import type { Analysis } from '../../../shared/types'
import { useT } from '../../i18n'
import { useClaudeStatus } from '../../state/queries'
import { ruleTitle } from '../../util/ruleTitle'
import { ConfirmDialog } from '../Dialog'
import { SparkIcon } from '../welcome/icons'

export const RunDialog = ({
  analysis,
  ids,
  onConfirm,
  onClose,
}: {
  analysis: Analysis
  ids: string[]
  onConfirm: () => void
  onClose: () => void
}) => {
  const t = useT()
  const words = t.audits.confirm
  const connection = t.audits.connection
  const status = useClaudeStatus()
  const items = ids.flatMap((id) => {
    const preview = analysis.audits.items.find((item) => item.id === id)
    if (!preview) return []
    const result = analysis.rules.find((rule) => rule.id === id)
    return [{ ...preview, title: result ? ruleTitle(result, analysis.config.rules, t) : id }]
  })
  const single = items.length === 1 ? items[0] : undefined

  return (
    <ConfirmDialog
      title={single ? words.titleOne : words.titleAll(items.length)}
      icon={<SparkIcon className="size-5" />}
      confirmLabel={single ? words.action : words.actionAll(items.length)}
      onConfirm={onConfirm}
      onClose={onClose}
    >
      {single ? (
        <p>
          <span className="font-medium">{single.title}</span>
          <span className="text-muted"> · {words.model(single.model)}</span>
        </p>
      ) : (
        <ul className="max-h-48 divide-y divide-line overflow-y-auto rounded-xl border border-line">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
              <span className="text-[12px] text-muted">{item.model}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted">{single ? words.text : words.textAll}</p>
      <p className="flex gap-2 text-[12px] text-muted">
        <span className="text-good">✓</span>
        {words.readOnly(analysis.audits.tools.join(', '))}
      </p>
      {status.data && !status.data.found && (
        <p className="rounded-lg border border-warn-line bg-warn-bg px-3 py-2 text-[12px] text-warn">
          <span className="font-medium">{connection.missing}.</span> {connection.missingText}
        </p>
      )}
    </ConfirmDialog>
  )
}
