import { projectPath } from '../../../shared/routes'
import type { Analysis } from '../../../shared/types'
import { useT } from '../../i18n'
import { formatUsd } from '../../util/format'
import { ruleSetting } from '../../util/ruleSetting'
import { Link } from '../Link'
import { SeverityBadge } from '../rules/badges'
import { groupByPattern, stackOf } from './model'
import { Chip, LayerStack, Section } from './parts'

export const ScopeSection = ({ analysis }: { analysis: Analysis }) => {
  const t = useT()
  const help = t.configHelp.scope
  const { config } = analysis
  const rows: [string, string[]][] = [
    [help.include, config.include],
    [help.exclude, config.exclude],
    [
      help.tsconfig,
      [config.tsconfig, ...analysis.ts.projects.filter((p) => p !== config.tsconfig)],
    ],
  ]
  return (
    <Section
      id="scope"
      title={help.title}
      text={help.text}
      aside={<span className="text-muted">{help.files(analysis.stats.files)}</span>}
    >
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {rows.map(([label, values]) => (
          <div key={label} className="flex flex-col gap-1.5">
            <dt className="text-[12px] font-semibold text-muted">{label}</dt>
            <dd className="flex flex-wrap gap-1.5">
              {values.map((value) => (
                <Chip key={value}>{value}</Chip>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}

export const FeaturesSection = ({ analysis }: { analysis: Analysis }) => {
  const t = useT()
  const help = t.configHelp.features
  const groups = groupByPattern(
    analysis.config.features,
    analysis.graph.features.map((f) => f.id),
  )
  return (
    <Section
      id="features"
      title={help.title}
      text={help.text}
      aside={<span className="text-muted">{help.count(analysis.graph.features.length)}</span>}
    >
      <ul className="flex flex-col gap-2">
        {groups.map((group) => {
          const prefix = group.pattern?.endsWith('/*') ? group.pattern.slice(0, -1) : null
          return (
            <li
              key={group.pattern ?? 'fallback'}
              className="grid grid-cols-1 gap-2 rounded-xl border border-line bg-bg px-4 py-3 sm:grid-cols-[14rem_minmax(0,1fr)]"
            >
              <span className="flex items-start gap-2">
                {group.pattern ? (
                  <Chip className="border-accent/40 text-accent">{group.pattern}</Chip>
                ) : (
                  <span className="text-[12px] font-semibold text-muted">{help.fallback}</span>
                )}
              </span>
              <span className="flex flex-wrap gap-1.5">
                {group.ids.length === 0 ? (
                  <span className="text-muted">—</span>
                ) : (
                  group.ids.map((id) => (
                    <Chip key={id}>
                      <span title={id}>
                        {prefix && id.startsWith(prefix) ? id.slice(prefix.length) : id}
                      </span>
                    </Chip>
                  ))
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

export const LayersSection = ({ analysis }: { analysis: Analysis }) => {
  const t = useT()
  const help = t.configHelp.layers
  const { layers, unlayered } = stackOf(analysis.graph)
  return (
    <Section id="layers" title={help.title} text={help.text}>
      {layers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-4 text-muted">
          {help.none}
        </p>
      ) : (
        <LayerStack layers={layers} unlayered={unlayered} />
      )}
    </Section>
  )
}

export const AllowSection = ({ analysis }: { analysis: Analysis }) => {
  const t = useT()
  const help = t.configHelp.allow
  return (
    <Section id="allow" title={help.title} text={help.text}>
      {analysis.config.allow.length === 0 ? (
        <p className="text-muted">{help.none}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {analysis.config.allow.map(([from, to]) => (
            <li key={`${from}→${to}`} className="flex flex-wrap items-center gap-2">
              <Chip>{from}</Chip>
              <span className="text-muted">→</span>
              <Chip>{to}</Chip>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

export const RulesSection = ({ analysis, root }: { analysis: Analysis; root: string }) => {
  const t = useT()
  const help = t.configHelp
  return (
    <Section
      id="rules"
      title={help.rules.title}
      text={help.rules.text}
      aside={
        <Link to={projectPath(root, 'rules')} className="text-accent hover:underline">
          {help.rules.seeRules} →
        </Link>
      }
    >
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-left">
          <thead className="bg-bg text-[12px] text-muted">
            <tr>
              {[
                help.rules.id,
                help.rules.family,
                help.rules.kind,
                help.rules.severity,
                help.rules.params,
              ].map((label) => (
                <th key={label} className="px-3 py-2 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {analysis.config.rules.map((rule) => (
              <tr key={rule.id} className="border-t border-line">
                <td className="px-3 py-2">
                  <Link
                    to={projectPath(root, 'rules', rule.id)}
                    className="font-mono text-[12px] hover:text-accent"
                  >
                    {rule.id}
                  </Link>
                </td>
                <td className="px-3 py-2 text-muted">{t.families[rule.family] ?? rule.family}</td>
                <td className="px-3 py-2" title={t.learn.kinds[rule.kind]?.what}>
                  {help.kinds[rule.kind] ?? rule.kind}
                </td>
                <td className="px-3 py-2">
                  <SeverityBadge severity={rule.severity} />
                </td>
                <td className="max-w-md truncate px-3 py-2 font-mono text-[12px] text-muted">
                  {ruleSetting(rule, analysis.config, t) ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

export const AiSection = ({ analysis, root }: { analysis: Analysis; root: string }) => {
  const t = useT()
  const help = t.configHelp
  const rows: [string, string][] = [
    [help.ai.model, analysis.config.ai.model],
    [help.ai.budget, formatUsd(analysis.config.ai.budgetUsd)],
    [help.ai.language, analysis.config.ai.language],
  ]
  return (
    <Section
      id="ai"
      title={help.aiAudits.title}
      text={help.aiAudits.what}
      aside={
        <Link to={projectPath(root, 'audits')} className="text-accent hover:underline">
          {t.tabs.audits} →
        </Link>
      }
    >
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-bg px-4 py-3">
            <dt className="text-[12px] text-muted">{label}</dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}
