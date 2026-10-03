import { useState } from 'react'
import { CONFIG_FILE } from '../../../shared/config'
import type { Analysis, DraftPayload } from '../../../shared/types'
import { useT } from '../../i18n'
import { Button, CopyButton, ErrorBox, Spinner } from '../ui'
import { Code, LayerStack, Section } from './parts'

const JsonToggle = ({ text }: { text: string }) => {
  const t = useT()
  const help = t.configHelp.json
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <span className="flex flex-wrap gap-2">
        <Button onClick={() => setOpen((on) => !on)} aria-expanded={open}>
          {open ? help.hide : help.show}
        </Button>
        <CopyButton text={text} />
      </span>
      {open && <Code text={text} />}
    </div>
  )
}

export const DraftSection = ({
  draft,
  error,
  pending,
  onRegenerate,
}: {
  draft: DraftPayload | undefined
  error: Error | null
  pending: boolean
  onRegenerate: () => void
}) => {
  const t = useT()
  const help = t.configHelp.draft
  if (!draft && !error && !pending) return null
  const layers = (draft?.config.layers ?? []).map((layer) => ({
    name: layer.name,
    siblings: !!layer.siblings,
    features: layer.features,
  }))
  return (
    <Section
      id="draft"
      title={help.title}
      text={help.text}
      aside={
        <Button onClick={onRegenerate} disabled={pending} className="flex items-center gap-2">
          {pending && <Spinner />}
          {help.regenerate}
        </Button>
      }
    >
      {error && <ErrorBox message={error.message} />}
      {draft && (
        <div className="flex flex-col gap-4">
          <LayerStack layers={layers} unlayered={[]} compact />
          <p className="text-[12px] text-muted">{t.config.draftHint(CONFIG_FILE)}</p>
          <JsonToggle text={draft.text} />
        </div>
      )}
    </Section>
  )
}

export const FileSection = ({ analysis }: { analysis: Analysis }) => {
  const t = useT()
  const help = t.configHelp.file
  return (
    <Section id="file" title={help.title} text={help.text}>
      <JsonToggle text={JSON.stringify(analysis.config, null, 2)} />
    </Section>
  )
}

export const ReferenceSection = () => {
  const t = useT()
  const help = t.configHelp.reference
  return (
    <details id="reference" className="scroll-mt-6 rounded-2xl border border-line bg-panel p-5">
      <summary className="cursor-pointer text-[16px] font-semibold tracking-tight">
        {help.title}
      </summary>
      <div className="mt-3 overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-left">
          <thead className="bg-bg text-[12px] text-muted">
            <tr>
              {[help.key, help.role, help.fallback].map((label) => (
                <th key={label} className="px-3 py-2 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {help.rows.map(([key, role, fallback]) => (
              <tr key={key} className="border-t border-line">
                <td className="px-3 py-2 font-mono text-[12px]">{key}</td>
                <td className="px-3 py-2">{role}</td>
                <td className="px-3 py-2 font-mono text-[12px] text-muted">{fallback}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
