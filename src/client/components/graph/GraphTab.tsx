import { projectPath } from '../../../shared/routes'
import type { Analysis } from '../../../shared/types'
import { useT } from '../../i18n'
import { navigate, usePkg } from '../../state/router'
import { isWholeWorkspace } from '../../util/scope'
import { FeatureGraph, NoLayersBanner } from './FeatureGraph'

export const GraphTab = ({ analysis, root }: { analysis: Analysis; root: string }) => {
  const t = useT()
  const pkg = usePkg()
  // A monorepo's whole view draws its packages: each node opens that package's own graph.
  const packagesView = isWholeWorkspace(analysis, pkg)
  return (
    <div className="flex flex-col gap-3">
      {packagesView ? (
        <div className="rounded-xl border border-line bg-panel px-4 py-2.5 text-muted">
          {t.graph.packagesBanner}
        </div>
      ) : (
        analysis.graph.layers.length === 0 && (
          <NoLayersBanner
            text={t.graph.noLayersBanner}
            onOpenConfig={() => navigate(projectPath(root, 'config'))}
          />
        )
      )}
      <FeatureGraph
        graph={analysis.graph}
        storageKey="code-atlas.graph-panel"
        {...(packagesView
          ? { onOpen: (id: string) => navigate(projectPath(root, 'graph', null, id)) }
          : {})}
      />
    </div>
  )
}
