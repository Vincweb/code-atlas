import type { Analysis } from '../../shared/types'
import { Families } from './overview/Families'
import { Figures, Glossary, Warnings } from './overview/Figures'
import { NextSteps } from './overview/NextSteps'
import { Priorities } from './overview/Priorities'
import { Summary } from './overview/Summary'

export const Overview = ({ analysis, root }: { analysis: Analysis; root: string }) => (
  <div className="flex flex-col gap-8 pb-10">
    <Summary analysis={analysis} />
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
