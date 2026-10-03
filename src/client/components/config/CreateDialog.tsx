import type { ReactNode } from 'react'
import { CONFIG_FILE } from '../../../shared/config'
import { useT } from '../../i18n'
import type { useCreateConfig, useDraft } from '../../queries'
import { ConfirmDialog } from '../Dialog'
import { FilePlusIcon } from '../welcome/icons'
import { Spinner } from '../ui'
import { Code } from './parts'

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">{label}</span>
    {children}
  </div>
)

const joinPath = (root: string, file: string) => {
  const separator = root.includes('\\') ? '\\' : '/'
  return root.endsWith(separator) ? `${root}${file}` : `${root}${separator}${file}`
}

export const CreateDialog = ({
  root,
  draft,
  create,
  onClose,
}: {
  root: string
  draft: ReturnType<typeof useDraft>
  create: ReturnType<typeof useCreateConfig>
  onClose: () => void
}) => {
  const t = useT()
  const help = t.configHelp
  const confirm = help.steps.create.confirm
  const config = draft.data?.config

  return (
    <ConfirmDialog
      title={confirm.title}
      icon={<FilePlusIcon className="size-5" />}
      confirmLabel={confirm.action}
      onConfirm={() => create.mutate(undefined, { onSuccess: onClose })}
      onClose={onClose}
      pending={create.isPending}
      error={create.error?.message ?? null}
    >
      <p className="text-muted">{confirm.text}</p>
      <Field label={confirm.where}>
        <code className="rounded-lg border border-line bg-code-bg px-3 py-2 font-mono text-[12px] break-all">
          {joinPath(root, CONFIG_FILE)}
        </code>
      </Field>
      <Field label={confirm.what}>
        {config ? (
          <details className="group rounded-lg border border-line">
            <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex-1">
                {confirm.summary(
                  config.layers?.length ?? 0,
                  (config.layers ?? []).reduce((sum, layer) => sum + layer.features.length, 0),
                  config.rules?.length ?? 0,
                )}
              </span>
              <span className="text-[12px] text-accent">
                <span className="group-open:hidden">{help.json.show}</span>
                <span className="hidden group-open:inline">{help.json.hide}</span>
              </span>
            </summary>
            <Code
              text={draft.data?.text ?? ''}
              className="max-h-64 rounded-none rounded-b-lg border-x-0 border-b-0"
            />
          </details>
        ) : draft.error ? (
          <span className="text-muted">{draft.error.message}</span>
        ) : (
          <span className="flex items-center gap-2 text-muted">
            <Spinner /> {confirm.preparing}
          </span>
        )}
      </Field>
      <ul className="flex flex-col gap-1 text-[12px] text-muted">
        {confirm.safe.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="text-good">✓</span>
            {line}
          </li>
        ))}
      </ul>
    </ConfirmDialog>
  )
}
