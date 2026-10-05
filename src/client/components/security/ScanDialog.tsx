import { useId, useState } from 'react'
import { STRIX_MODES } from '../../../shared/types'
import type { StrixMode, StrixScanRequest } from '../../../shared/types'
import { useT } from '../../i18n'
import { cx } from '../../util/cx'
import { ConfirmDialog } from '../Dialog'
import { DEFAULT_BUDGET_USD } from './model'

const ShieldIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="size-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 3.5 5 6.2v5.3c0 4.3 2.9 7.6 7 9 4.1-1.4 7-4.7 7-9V6.2l-7-2.7Z" />
    <path d="m9.2 12 2 2 3.6-3.8" />
  </svg>
)

const ModePicker = ({ mode, onPick }: { mode: StrixMode; onPick: (mode: StrixMode) => void }) => {
  const words = useT().security
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 font-medium">{words.dialog.mode}</legend>
      {STRIX_MODES.map((candidate) => (
        <label
          key={candidate}
          className={cx(
            'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2',
            candidate === mode ? 'border-accent bg-accent/5' : 'border-line hover:bg-hover',
          )}
        >
          <input
            type="radio"
            name="strix-mode"
            value={candidate}
            checked={candidate === mode}
            onChange={() => onPick(candidate)}
            className="mt-1 accent-accent"
          />
          <span className="flex flex-col">
            <span className="font-medium">{words.modes[candidate].label}</span>
            <span className="text-[12px] text-muted">{words.modes[candidate].text}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}

export const ScanDialog = ({
  model,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  model: string | null
  pending: boolean
  error: string | null
  onConfirm: (request: StrixScanRequest) => void
  onClose: () => void
}) => {
  const words = useT().security.dialog
  const ids = { budget: useId(), instruction: useId() }
  const [mode, setMode] = useState<StrixMode>('quick')
  const [budget, setBudget] = useState(String(DEFAULT_BUDGET_USD))
  const [instruction, setInstruction] = useState('')
  const [invalid, setInvalid] = useState(false)

  const confirm = () => {
    const budgetUsd = Number(budget)
    const valid = Number.isFinite(budgetUsd) && budgetUsd > 0 && budgetUsd <= 100
    setInvalid(!valid)
    if (valid) onConfirm({ mode, budgetUsd, instruction: instruction.trim() })
  }

  return (
    <ConfirmDialog
      title={words.title}
      icon={<ShieldIcon />}
      confirmLabel={words.action}
      onConfirm={confirm}
      onClose={onClose}
      pending={pending}
      error={invalid ? words.budgetError : error}
    >
      <ModePicker mode={mode} onPick={setMode} />
      <div className="flex flex-col gap-1">
        <label htmlFor={ids.budget} className="font-medium">
          {words.budget}
        </label>
        <span className="flex items-center gap-2">
          <span className="text-muted">$</span>
          <input
            id={ids.budget}
            type="number"
            min="0.5"
            max="100"
            step="0.5"
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            className="w-28 rounded border border-line bg-bg px-2 py-1 tabular-nums"
          />
        </span>
        <span className="text-[12px] text-muted">{words.budgetHint}</span>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={ids.instruction} className="font-medium">
          {words.instruction}
        </label>
        <textarea
          id={ids.instruction}
          rows={2}
          maxLength={4000}
          value={instruction}
          placeholder={words.instructionPlaceholder}
          onChange={(event) => setInstruction(event.target.value)}
          className="rounded border border-line bg-bg px-2 py-1"
        />
      </div>
      <ul className="flex flex-col gap-1.5 text-[12px] text-muted">
        {[words.copy, words.llm(model), words.telemetry].map((line) => (
          <li key={line} className="flex gap-2">
            <span className="text-good">✓</span>
            {line}
          </li>
        ))}
        <li className="flex gap-2 text-warn">
          <span>!</span>
          {words.own}
        </li>
      </ul>
    </ConfirmDialog>
  )
}
