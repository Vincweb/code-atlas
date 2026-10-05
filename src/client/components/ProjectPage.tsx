import type { ComponentType } from 'react'
import type { Tab } from '../../shared/routes'
import type { Analysis } from '../../shared/types'
import { useT } from '../i18n'
import { useEffect } from 'react'
import { useAnalysis, useInvalidateAnalysis } from '../state/queries'
import { rememberProject } from '../state/recent'
import { AuditsTab } from './audits/AuditsTab'
import { ConfigTab } from './ConfigTab'
import { GraphTab } from './graph/GraphTab'
import { MetricsTab } from './metrics/MetricsTab'
import { Overview } from './Overview'
import { ProjectHeader } from './ProjectHeader'
import { ProjectTabs } from './ProjectTabs'
import { RulesTab } from './rules/RulesTab'
import { SecurityTab } from './security/SecurityTab'
import { TabSkeleton } from './skeletons'
import { ErrorBox, Spinner } from './ui'
import { ViewerProvider } from './viewer'

type Props = { root: string; tab: Tab }

const TAB_VIEWS: Record<Tab, ComponentType<{ analysis: Analysis; root: string }>> = {
  overview: Overview,
  graph: GraphTab,
  rules: RulesTab,
  audits: AuditsTab,
  security: SecurityTab,
  metrics: MetricsTab,
  config: ConfigTab,
}

export const ProjectPage = ({ root, tab }: Props) => {
  const t = useT()
  const query = useAnalysis(root)
  const reanalyse = useInvalidateAnalysis(root)
  const analysis = query.data
  const TabView = TAB_VIEWS[tab]

  const folder = (analysis?.root ?? root).split('/').filter(Boolean).pop()
  useEffect(() => {
    document.title = folder && folder !== '.' ? `code-atlas · ${folder}` : 'code-atlas'
  }, [folder])

  useEffect(() => {
    if (analysis)
      rememberProject({
        root: analysis.root,
        label: analysis.label,
        overall: analysis.scores.overall,
      })
  }, [analysis])

  return (
    <ViewerProvider root={root}>
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-5">
        {analysis ? (
          <ProjectHeader
            analysis={analysis}
            busy={query.isFetching}
            onReanalyse={() => void reanalyse()}
          />
        ) : (
          <ProjectHeader root={root} busy={query.isFetching} onReanalyse={() => void reanalyse()} />
        )}
        <ProjectTabs root={root} tab={tab} analysis={analysis} busy={query.isFetching} />
        {query.isPending && (
          <div className="flex flex-col gap-4">
            <p role="status" className="flex items-center gap-2 text-muted">
              <Spinner /> {t.project.analysing}
            </p>
            <TabSkeleton tab={tab} />
          </div>
        )}
        {query.error && (
          <ErrorBox message={query.error.message} onRetry={() => void query.refetch()} />
        )}
        {analysis && <TabView analysis={analysis} root={root} />}
      </div>
    </ViewerProvider>
  )
}
