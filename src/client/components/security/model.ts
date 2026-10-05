import type { StrixFinding, StrixSeverity } from '../../../shared/types'
import type { Strings } from '../../i18n'

export const INSTALL_COMMAND = 'curl -sSL https://strix.ai/install | bash'

export const SKILLS_COMMAND = 'npx skills add usestrix/strix'

export const LLM_EXAMPLE = `export STRIX_LLM="anthropic/claude-sonnet-4-6"
export LLM_API_KEY="…"`

export const DEFAULT_BUDGET_USD = 5

export const SEVERITIES: StrixSeverity[] = ['critical', 'high', 'medium', 'low', 'info']

export const SEVERITY_CLASS: Record<StrixSeverity, string> = {
  critical: 'border-sev-critical text-sev-critical',
  high: 'border-sev-high text-sev-high',
  medium: 'border-sev-medium text-sev-medium',
  low: 'border-sev-low text-sev-low',
  info: 'border-line text-muted',
}

export const severityLabel = (severity: StrixSeverity, t: Strings) =>
  severity === 'info' ? t.security.findings.info : t.severity[severity]

export const GITHUB_WORKFLOW = `name: Security scan

on:
  pull_request:

jobs:
  strix:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Install Strix
        run: curl -sSL https://strix.ai/install | bash
      - name: Run Strix
        env:
          STRIX_LLM: \${{ secrets.STRIX_LLM }}
          LLM_API_KEY: \${{ secrets.LLM_API_KEY }}
        run: strix -n -t ./ --scan-mode quick --fail-on high
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: strix-report
          path: strix_runs/
`

const shellQuote = (arg: string) =>
  /^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`

/** `strix view` reads `strix_runs/` from the folder it starts in. */
export const viewerCommand = (runsDir: string, run: string) =>
  `cd ${shellQuote(runsDir.replace(/[\\/]strix_runs$/, ''))} && strix view ${shellQuote(run)}`

export const fixPrompt = (root: string, finding: StrixFinding, t: Strings) => {
  const where = finding.locations
    .map((location) => `${location.file}:${location.line}`)
    .concat(finding.endpoint ? [`${finding.method ?? ''} ${finding.endpoint}`.trim()] : [])
    .join(', ')
  const label = [severityLabel(finding.severity, t), finding.cwe].filter(Boolean).join(', ')
  return t.security.findings.fixPrompt({
    root,
    title: finding.title,
    label,
    report: finding.reportPath,
    where,
  })
}
