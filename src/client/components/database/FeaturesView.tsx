import { projectPath } from '../../../shared/routes'
import type { DatabaseResult } from '../../../shared/types'
import { useT } from '../../i18n'
import { navigate } from '../../state/router'
import { FeatureGraph, NoLayersBanner } from '../graph/FeatureGraph'

/** The features of the database and the foreign keys between them, drawn like the import graph. */
export const FeaturesView = ({ db, root }: { db: DatabaseResult; root: string }) => {
  const t = useT()
  return (
    <div className="flex flex-col gap-3">
      {db.graph.layers.length === 0 && (
        <NoLayersBanner
          text={t.database.graph.noLayersBanner}
          onOpenConfig={() => navigate(projectPath(root, 'config'))}
        />
      )}
      <FeatureGraph
        graph={db.graph}
        words={t.database.graph}
        storageKey="code-atlas.database-panel"
        showCycles={false}
      />
    </div>
  )
}
