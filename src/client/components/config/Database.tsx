import { projectPath } from '../../../shared/routes'
import type { Analysis } from '../../../shared/types'
import { useT } from '../../i18n'
import { Link } from '../Link'
import { Chip, LayerStack, Section } from './parts'

/** How the Drizzle schema is read: the config, the features, their layers, the junction tables. */
export const DatabaseSection = ({ analysis, root }: { analysis: Analysis; root: string }) => {
  const t = useT()
  const help = t.configHelp.database
  const db = analysis.database
  const chosen = db?.configs.find((config) => config.chosen)
  const layers = db
    ? db.graph.layers.map((layer, index) => ({
        name: layer.name,
        siblings: layer.siblings,
        features: db.graph.features.filter((f) => f.layer === index).map((f) => f.id),
      }))
    : []
  const unlayered = db?.graph.layers.length
    ? db.graph.features.filter((f) => f.layer === null).map((f) => f.id)
    : []
  const junctions = db?.tables.filter((table) => table.junction).map((table) => table.id) ?? []
  return (
    <Section
      id="database"
      title={help.title}
      text={help.text}
      aside={
        db && (
          <Link to={projectPath(root, 'database')} className="text-accent hover:underline">
            {help.seeTab} →
          </Link>
        )
      }
    >
      {!db || !chosen ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-4 text-muted">
          {help.none}
        </p>
      ) : (
        <dl className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <dt className="text-[12px] font-semibold text-muted">{help.config}</dt>
            <dd className="flex flex-wrap gap-1.5">
              <Chip className="border-accent/40 text-accent">{chosen.path}</Chip>
              {chosen.schema.map((entry) => (
                <Chip key={entry}>{entry}</Chip>
              ))}
            </dd>
          </div>
          <div className="flex flex-col gap-1.5">
            <dt className="text-[12px] font-semibold text-muted">
              {help.features} ·{' '}
              {db.featuresSource === 'config' ? help.featuresConfig : help.featuresPrefix}
            </dt>
            <dd className="flex flex-wrap gap-1.5">
              {db.graph.features.map((feature) => (
                <Chip key={feature.id}>
                  {feature.id}
                  <span className="ml-1.5 text-muted">{help.tables(feature.files)}</span>
                </Chip>
              ))}
            </dd>
          </div>
          <div className="flex flex-col gap-1.5">
            <dt className="text-[12px] font-semibold text-muted">{help.layers}</dt>
            <dd>
              {layers.length === 0 ? (
                <p className="text-muted">{help.noLayers}</p>
              ) : (
                <LayerStack layers={layers} unlayered={unlayered} compact />
              )}
            </dd>
          </div>
          <div className="flex flex-col gap-1.5">
            <dt className="text-[12px] font-semibold text-muted">{help.junctions}</dt>
            <dd className="flex flex-wrap gap-1.5">
              {junctions.length === 0 ? (
                <span className="text-muted">{help.noJunctions}</span>
              ) : (
                junctions.map((id) => <Chip key={id}>{id}</Chip>)
              )}
            </dd>
          </div>
        </dl>
      )}
    </Section>
  )
}
