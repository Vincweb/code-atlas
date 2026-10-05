import { useState } from 'react'
import type { StrixTools } from '../../../shared/types'
import { useT } from '../../i18n'
import { Button, Spinner } from '../ui'
import { INSTALL_COMMAND, LLM_EXAMPLE } from './model'
import { Check, Command } from './parts'

/** Whether the page can run a scan at all: Strix, a running Docker, and an LLM to drive it. */
export const isReady = (tools: StrixTools | undefined) =>
  !!tools && tools.strix.found && tools.docker.running

const LlmCheck = ({ llm }: { llm: StrixTools['llm'] }) => {
  const t = useT()
  const words = t.security.setup
  const configured = (!!llm.model && llm.apiKey) || llm.configFile
  return (
    <Check
      tone={configured ? 'good' : 'warn'}
      title={llm.model ? words.llmModel(llm.model) : words.llmNoModel}
    >
      <span>{llm.apiKey ? words.llmKey : words.llmNoKey}</span>
      {llm.configFile && <span>{words.llmFile}</span>}
      {!configured && (
        <>
          <span>{words.llmText}</span>
          <Command command={LLM_EXAMPLE} />
        </>
      )}
    </Check>
  )
}

const StrixCheck = ({ strix }: { strix: StrixTools['strix'] }) => {
  const words = useT().security.setup
  return (
    <Check
      tone={strix.found ? 'good' : 'bad'}
      title={strix.found ? words.strixFound(strix.version ?? '') : words.strixMissing}
    >
      {!strix.found && (
        <>
          <span>{words.strixInstall}</span>
          <Command command={INSTALL_COMMAND} />
        </>
      )}
    </Check>
  )
}

const DockerCheck = ({ docker }: { docker: StrixTools['docker'] }) => {
  const words = useT().security.setup
  const missing = docker.found ? words.dockerStopped : words.dockerMissing
  return (
    <Check
      tone={docker.running ? 'good' : 'bad'}
      title={docker.running ? words.dockerRunning(docker.version ?? '') : missing}
    >
      {!docker.running && <span>{words.dockerText}</span>}
    </Check>
  )
}

export const Setup = ({
  tools,
  pending,
  onRecheck,
}: {
  tools: StrixTools | undefined
  pending: boolean
  onRecheck: () => Promise<unknown>
}) => {
  const words = useT().security.setup
  const [checking, setChecking] = useState(false)
  const recheck = () => {
    setChecking(true)
    void onRecheck().finally(() => setChecking(false))
  }
  const busy = checking || pending

  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-line bg-panel p-5">
      <header className="flex items-center gap-2">
        <h2 className="text-[16px] font-semibold tracking-tight">{words.title}</h2>
        <Button onClick={recheck} disabled={busy} className="ml-auto flex items-center gap-2">
          {busy && <Spinner />}
          {busy ? words.checking : words.recheck}
        </Button>
      </header>
      {tools && (
        <ul className="flex flex-col divide-y divide-line">
          <StrixCheck strix={tools.strix} />
          <DockerCheck docker={tools.docker} />
          <LlmCheck llm={tools.llm} />
        </ul>
      )}
    </section>
  )
}
