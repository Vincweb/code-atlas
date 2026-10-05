import { useState } from 'react'
import type { Analysis, SecurityPayload, StrixScanRequest } from '../../../shared/types'
import { useT } from '../../i18n'
import { useCancelScan, useSecurity, useStartScan, useStrixTools } from '../../state/queries'
import { TabSkeleton } from '../skeletons'
import { Button, ErrorBox } from '../ui'
import { RunView } from './RunView'
import { ScanDialog } from './ScanDialog'
import { ScanStatus } from './ScanStatus'
import { isReady, Setup } from './Setup'
import { Tooling } from './Tooling'

const relativeTo = (root: string, dir: string) =>
  dir.startsWith(`${root}/`) ? dir.slice(root.length + 1) : dir

const Header = ({
  root,
  payload,
  ready,
  onLaunch,
}: {
  root: string
  payload: SecurityPayload
  ready: boolean
  onLaunch: () => void
}) => {
  const t = useT()
  const cancel = useCancelScan(root)
  const running = payload.scan?.running ?? false
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-[20px] font-semibold tracking-tight">{t.tabs.security}</h2>
      <p className="max-w-2xl leading-relaxed text-muted">{t.security.intro}</p>
      <span>
        <Button primary onClick={onLaunch} disabled={running || !ready}>
          {t.security.launch}
        </Button>
      </span>
      {payload.scan && (
        <ScanStatus
          scan={payload.scan}
          stopping={cancel.isPending}
          onStop={() => cancel.mutate()}
        />
      )}
    </div>
  )
}

export const SecurityTab = ({ analysis, root }: { analysis: Analysis; root: string }) => {
  const [selected, setSelected] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const security = useSecurity(root, selected)
  const tools = useStrixTools()
  const start = useStartScan(root)
  const payload = security.data

  const launch = (request: StrixScanRequest) =>
    start.mutate(request, {
      onSuccess: () => {
        setSelected(null)
        setConfirming(false)
      },
    })

  if (security.error)
    return <ErrorBox message={security.error.message} onRetry={() => void security.refetch()} />
  if (!payload) return <TabSkeleton tab="security" />

  return (
    <div className="flex flex-col gap-6 pb-10">
      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-line bg-panel p-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Header
          root={root}
          payload={payload}
          ready={isReady(tools.data)}
          onLaunch={() => {
            start.reset()
            setConfirming(true)
          }}
        />
        <Setup tools={tools.data} pending={tools.isPending} onRecheck={tools.recheck} />
      </section>
      <RunView
        run={payload.run}
        runs={payload.runs}
        runsDir={payload.runsDir}
        root={analysis.root}
        onSelect={setSelected}
      />
      <Tooling
        integration={payload.integration}
        runsDir={relativeTo(analysis.root, payload.runsDir)}
        root={analysis.root}
      />
      {confirming && (
        <ScanDialog
          model={tools.data?.llm.model ?? null}
          pending={start.isPending}
          error={start.error?.message ?? null}
          onConfirm={launch}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  )
}
