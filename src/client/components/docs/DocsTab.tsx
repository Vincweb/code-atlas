import { useMemo } from 'react'
import { projectPath } from '../../../shared/routes'
import { isWholeWorkspace } from '../../../shared/scope'
import type { Analysis } from '../../../shared/types'
import { useT } from '../../i18n'
import { usePkg } from '../../state/router'
import { Chip } from '../ui'
import { Link } from '../Link'
import { DocView } from './DocView'
import { FeatureList } from './FeatureList'
import { groupsOf, isDocumented, useHashSelection } from './model'
import type { Entry } from './model'

const Header = ({
  analysis,
  entries,
  root,
  packagesView,
}: {
  analysis: Analysis
  entries: Entry[]
  root: string
  packagesView: boolean
}) => {
  const t = useT()
  const words = t.docs
  const documented = entries.filter(isDocumented).length
  const coverage = entries.length ? Math.round((documented * 100) / entries.length) : 0
  const tiles: [string, string][] = [
    [packagesView ? words.tiles.packages : words.tiles.features, String(entries.length)],
    [words.tiles.documented, String(documented)],
    [words.tiles.coverage, `${coverage} %`],
  ]
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-5">
      <p className="max-w-3xl leading-relaxed text-muted">
        {packagesView ? words.packagesIntro : words.intro}
      </p>
      <div className="grid grid-cols-3 gap-3 sm:max-w-xl">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-bg px-4 py-3">
            <div className="text-[12px] text-muted">{label}</div>
            <div className="text-[22px] font-semibold tabular-nums">{value}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-semibold text-muted">{words.lookedFor}</span>
        {analysis.config.docs.map((template) => (
          <Chip key={template}>{template}</Chip>
        ))}
        <Link to={projectPath(root, 'config')} className="text-[12px] text-accent hover:underline">
          {words.configure} →
        </Link>
      </div>
    </section>
  )
}

/** The doc of each feature, picked from a list: the one the URL's hash names, else a documented one. */
export const DocsTab = ({ analysis, root }: { analysis: Analysis; root: string }) => {
  const t = useT()
  const pkg = usePkg()
  const packagesView = isWholeWorkspace(analysis, pkg)
  const groups = useMemo(() => groupsOf(analysis, t.common.unlayered), [analysis, t])
  const entries = groups.flatMap((group) => group.entries)
  const [chosen, select] = useHashSelection()
  const entry =
    entries.find((candidate) => candidate.node.id === chosen) ??
    entries.find(isDocumented) ??
    entries[0] ??
    null
  return (
    <div className="flex flex-col gap-4 pb-10">
      <Header analysis={analysis} entries={entries} root={root} packagesView={packagesView} />
      {entry ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
          <FeatureList groups={groups} selected={entry.node.id} onSelect={select} />
          <DocView
            key={entry.node.id}
            analysis={analysis}
            entry={entry}
            root={root}
            packagesView={packagesView}
          />
        </div>
      ) : (
        <p className="text-muted">{t.docs.noFeatures}</p>
      )}
    </div>
  )
}
