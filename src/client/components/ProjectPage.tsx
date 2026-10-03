import type { Tab } from '../../shared/routes'
import { useT } from '../i18n'
import { useEffect } from 'react'
import { useAnalysis, useInvalidateAnalysis } from '../queries'
import { rememberProject } from '../recent'
import { AuditsTab } from './audits/AuditsTab'
import { ConfigTab } from './ConfigTab'
import { GraphTab } from './graph/GraphTab'
import { MetricsTab } from './metrics/MetricsTab'
import { Overview } from './Overview'
import { ProjectHeader } from './ProjectHeader'
import { ProjectTabs } from './ProjectTabs'
import { RulesTab } from './rules/RulesTab'
import { TabSkeleton } from './skeletons'
import { ErrorBox, Spinner } from './ui'
import { ViewerProvider } from './viewer'

type Props = { root: string; tab: Tab }

export const ProjectPage = ({ root, tab }: Props) => {
  const t = useT()
  const query = useAnalysis(root)
  const reanalyse = useInvalidateAnalysis(root)
  const analysis = query.data

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
        {analysis && tab === 'overview' && <Overview analysis={analysis} root={root} />}
        {analysis && tab === 'graph' && <GraphTab analysis={analysis} root={root} />}
        {analysis && tab === 'rules' && <RulesTab analysis={analysis} root={root} />}
        {analysis && tab === 'audits' && <AuditsTab analysis={analysis} root={root} />}
        {analysis && tab === 'metrics' && <MetricsTab analysis={analysis} />}
        {analysis && tab === 'config' && <ConfigTab analysis={analysis} root={root} />}
      </div>
    </ViewerProvider>
  )
}
