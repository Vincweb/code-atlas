import { useState } from 'react'
import type { StrixCiFile, StrixCiStep, StrixIntegration } from '../../../shared/types'
import { useT } from '../../i18n'
import { ClaudeActions } from '../ClaudeActions'
import { Button, CopyButton } from '../ui'
import { GITHUB_WORKFLOW, SKILLS_COMMAND } from './model'
import { Check, Command, Fact } from './parts'
import type { Tone } from './parts'

const StepFacts = ({ step }: { step: StrixCiStep }) => {
  const words = useT().security.tooling
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="font-mono">
        {step.file}:{step.line}
      </span>
      <Fact good={step.headless}>{step.headless ? words.headless : words.notHeadless}</Fact>
      <Fact good={step.mode !== null}>{step.mode ? words.mode(step.mode) : words.noMode}</Fact>
      <Fact good={step.failOn !== null}>
        {step.failOn ? words.failOn(step.failOn) : words.noFailOn}
      </Fact>
      <Fact good={step.budget !== null}>
        {step.budget ? words.budget(step.budget) : words.noBudget}
      </Fact>
    </span>
  )
}

const FileFacts = ({ ci }: { ci: StrixCiFile }) => {
  const words = useT().security.tooling
  return (
    <span className="flex flex-wrap gap-1.5">
      {ci.cloud && <Fact good>{words.cloud}</Fact>}
      <Fact good={ci.secrets}>{ci.secrets ? words.secrets : words.noSecrets}</Fact>
      {ci.pullRequests !== null && (
        <Fact good={ci.pullRequests}>
          {ci.pullRequests ? words.pullRequests : words.noPullRequests}
        </Fact>
      )}
      {ci.fullHistory !== null && (
        <Fact good={ci.fullHistory}>
          {ci.fullHistory ? words.fullHistory : words.noFullHistory}
        </Fact>
      )}
    </span>
  )
}

const MissingCi = ({ root }: { root: string }) => {
  const words = useT().security.tooling
  const [open, setOpen] = useState(false)
  return (
    <Check tone="warn" title={words.ciMissing}>
      <span>{words.ciMissingText}</span>
      <ClaudeActions prompt={words.ciPrompt(root, GITHUB_WORKFLOW)} cwd={root} />
      <span className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setOpen((on) => !on)} aria-expanded={open}>
          {open ? words.hideWorkflow : words.showWorkflow}
        </Button>
        {open && <CopyButton text={GITHUB_WORKFLOW} />}
      </span>
      {open && (
        <pre className="overflow-x-auto rounded-lg border border-line bg-code-bg p-3 font-mono text-[12px] leading-5 text-text">
          {GITHUB_WORKFLOW}
        </pre>
      )}
    </Check>
  )
}

const ciTone = (ci: StrixCiFile): Tone =>
  ci.secrets && ci.steps.every((step) => step.headless) ? 'good' : 'warn'

const Skills = ({ integration }: { integration: StrixIntegration }) => {
  const words = useT().security.tooling
  const { skills } = integration
  return (
    <Check
      tone={skills.length ? 'good' : 'none'}
      title={skills.length ? words.skillsFound(skills.length) : words.skillsMissing}
    >
      <span>{words.skillsText}</span>
      {skills.length ? (
        <span className="flex flex-wrap gap-1.5">
          {skills.map((skill) => (
            <span key={skill.path} title={skill.path} className="rounded bg-hover px-1.5 font-mono">
              {skill.name} · {words.skillScope[skill.scope]}
            </span>
          ))}
        </span>
      ) : (
        <Command command={SKILLS_COMMAND} />
      )}
    </Check>
  )
}

const Reports = ({ integration, runsDir }: { integration: StrixIntegration; runsDir: string }) => {
  const words = useT().security.tooling
  const { reportsIgnored, rootRuns } = integration
  if (reportsIgnored === null) return <Check tone="none" title={words.noGit} />
  return (
    <>
      <Check
        tone={reportsIgnored ? 'good' : 'bad'}
        title={reportsIgnored ? words.reportsIgnored : words.reportsNotIgnored(runsDir)}
      >
        {!reportsIgnored && <span>{words.reportsText}</span>}
      </Check>
      {rootRuns.present && rootRuns.ignored === false && (
        <Check tone="bad" title={words.rootRuns}>
          <span>{words.reportsText}</span>
        </Check>
      )}
    </>
  )
}

export const Tooling = ({
  integration,
  runsDir,
  root,
}: {
  integration: StrixIntegration
  runsDir: string
  root: string
}) => {
  const words = useT().security.tooling
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-line bg-panel p-5">
      <div>
        <h2 className="text-[16px] font-semibold tracking-tight">{words.title}</h2>
        <p className="text-muted">{words.intro}</p>
      </div>
      <ul className="flex flex-col divide-y divide-line">
        {integration.ci.length === 0 && <MissingCi root={root} />}
        {integration.ci.map((ci) => (
          <Check key={ci.file} tone={ciTone(ci)} title={words.ciFound(ci.file)}>
            {ci.steps.map((step) => (
              <StepFacts key={step.line} step={step} />
            ))}
            <FileFacts ci={ci} />
          </Check>
        ))}
        <Skills integration={integration} />
        <Reports integration={integration} runsDir={runsDir} />
      </ul>
    </section>
  )
}
