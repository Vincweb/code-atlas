import { useState } from 'react'
import type { RuleResult } from '../../../shared/types'
import { useT } from '../../i18n'
import { Button } from '../ui'
import { FileLink, useViewer } from '../viewer'
import { groupByFile } from './model'

const FIRST_FILES = 8

export const Violations = ({ rule }: { rule: RuleResult }) => {
  const t = useT()
  const { open } = useViewer()
  const [all, setAll] = useState(false)
  const groups = groupByFile(rule.violations)
  const shown = all ? groups : groups.slice(0, FIRST_FILES)

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] text-muted">
        {t.rules.violations(rule.count)} · {t.rules.files(groups.length)}
        {rule.count > rule.violations.length &&
          ` · ${t.rules.showing(rule.violations.length, rule.count)}`}
      </p>
      <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-bg">
        {shown.map((group) => (
          <li key={group.file ?? '—'} className="flex flex-col gap-1.5 px-3 py-2">
            <div className="flex items-center gap-2">
              {group.file ? (
                <FileLink file={group.file} line={group.items[0]?.line ?? null} />
              ) : (
                <span className="text-[12px] text-muted">—</span>
              )}
              <span className="ml-auto rounded-full bg-bad-bg px-2 text-[11px] text-bad tabular-nums">
                {group.items.length}
              </span>
            </div>
            <ul className="flex flex-col gap-1">
              {group.items.map((violation, index) => (
                <li key={index} className="flex gap-2 text-[12px]">
                  {violation.line && group.file ? (
                    <button
                      type="button"
                      onClick={() => open(group.file ?? '', violation.line)}
                      className="shrink-0 rounded bg-panel px-1.5 font-mono text-accent tabular-nums hover:underline"
                    >
                      L{violation.line}
                    </button>
                  ) : null}
                  <span className="min-w-0 break-words whitespace-pre-wrap">
                    {violation.message}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {groups.length > FIRST_FILES && (
        <Button onClick={() => setAll((on) => !on)} className="w-fit">
          {all ? t.rules.showLess : t.rules.showAllFiles(groups.length)}
        </Button>
      )}
    </div>
  )
}
