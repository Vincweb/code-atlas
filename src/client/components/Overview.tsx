import type { Analysis } from '../../shared/types'
import { usePkg } from '../state/router'
import { isWholeWorkspace, packageIn } from '../../shared/scope'
import { Families } from './overview/Families'
import { Warnings } from './ui'
import { Figures, Glossary } from './overview/Figures'
import { NextSteps } from './overview/NextSteps'
import { Packages } from './overview/Packages'
import { Priorities } from './overview/Priorities'
import { Summary } from './overview/Summary'

export const Overview = ({ analysis, root }: { analysis: Analysis; root: string }) => {
  const pkg = usePkg()
  const whole = isWholeWorkspace(analysis, pkg)
  return (
    <div className="flex flex-col gap-8 pb-10">
      <Summary
        analysis={analysis}
        packages={whole ? analysis.workspace?.packages.length : undefined}
        scope={packageIn(analysis, pkg)?.name}
      />
      {whole && <Packages analysis={analysis} root={root} />}
      <Families analysis={analysis} root={root} />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Priorities analysis={analysis} root={root} />
        <NextSteps analysis={analysis} root={root} />
      </div>
      <Figures analysis={analysis} />
      <Glossary />
      <Warnings warnings={analysis.warnings} />
    </div>
  )
}
