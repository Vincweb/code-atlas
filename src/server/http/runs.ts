import { RUN_KINDS } from '../../shared/config'
import type { AiRuleConfig, CommandRuleConfig, ResolvedConfig } from '../../shared/config'
import { API } from '../../shared/routes'
import { isActive } from '../../shared/runs'
import type { RuleRun } from '../../shared/runs'
import type { RunEvent } from '../../shared/types'
import { gitState } from '../project/git'
import { messageOf } from '../../shared/errors'
import { json, readJson } from './api'
import type { ProjectCall } from './api'
import { projectContext } from '../project'
import type { Overrides } from '../project'
import { runRule } from '../rules'

const MAX_LINES = 200

export class RunError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

type RunnableRule = CommandRuleConfig | AiRuleConfig

/** What a run needs from its project, read when it was asked for. */
export type RunProject = { config: ResolvedConfig; stateDir: string }

type Waiting = { rule: RunnableRule; project: RunProject }

type Project = {
  runs: Map<string, RuleRun>
  waiting: Waiting[]
  current: AbortController | null
}

const now = () => new Date().toISOString()

const runnable = (config: ResolvedConfig, id: string): RunnableRule => {
  const rule = config.rules.find((candidate) => candidate.id === id)
  if (!rule) throw new RunError(`no rule ${id} in this project's config`, 404)
  if (!RUN_KINDS.includes(rule.kind))
    throw new RunError(`${id} is computed by every analysis — there is nothing to run`, 400)
  return rule as RunnableRule
}

const record = (run: RuleRun, event: RunEvent) => {
  if (event.type === 'start') run.lines.push(event.at)
  else if (event.type === 'progress') run.lines.push(event.message)
  else if (event.type === 'error') run.error = event.message
  if (run.lines.length > MAX_LINES) run.lines.splice(0, run.lines.length - MAX_LINES)
}

type RunRule = typeof runRule

/** Whether a run is still running: a cancel may have settled it while it was awaited. */
const stillRunning = (run: RuleRun) => run.status === 'running'

/**
 * The command and AI runs of each project, detached from the page that asked for them: leaving
 * the tab or closing the page lets a run finish and its result land under `.code-atlas/runs/`.
 * One run at a time per project, the others wait their turn. A finished run keeps its output
 * until the rule runs again, so a page that comes back still shows it.
 */
export const createRuns = (opts: { run?: RunRule } = {}) => {
  const execute = opts.run ?? runRule
  const projects = new Map<string, Project>()

  const projectOf = (root: string) => {
    const known = projects.get(root)
    if (known) return known
    const created: Project = { runs: new Map(), waiting: [], current: null }
    projects.set(root, created)
    return created
  }

  const list = (root: string): RuleRun[] => [...(projects.get(root)?.runs.values() ?? [])]

  const runNext = async (root: string, project: Project, next: Waiting) => {
    const run = project.runs.get(next.rule.id)
    if (!run || run.status !== 'queued') return
    const controller = new AbortController()
    project.current = controller
    run.status = 'running'
    run.startedAt = now()
    try {
      const result = await execute({
        root,
        config: next.project.config,
        rule: next.rule,
        stateDir: next.project.stateDir,
        commit: gitState(root).commit,
        onEvent: (event) => record(run, event),
        signal: controller.signal,
      })
      if (stillRunning(run)) {
        run.status = result.status === 'error' ? 'failed' : 'done'
        run.error = result.error
      }
    } catch (error) {
      if (stillRunning(run)) Object.assign(run, { status: 'failed', error: messageOf(error) })
    }
    run.endedAt = now()
    project.current = null
  }

  const drain = async (root: string, project: Project) => {
    for (let next = project.waiting.shift(); next; next = project.waiting.shift())
      await runNext(root, project, next)
  }

  /** Queues the rules not queued or running yet; the first starts now if nothing runs. */
  const start = (root: string, runProject: RunProject, ids: string[]) => {
    const rules = ids.map((id) => runnable(runProject.config, id))
    const project = projectOf(root)
    for (const rule of rules) {
      const known = project.runs.get(rule.id)
      if (known && isActive(known)) continue
      project.runs.set(rule.id, {
        rule: rule.id,
        status: 'queued',
        lines: [],
        error: null,
        startedAt: null,
        endedAt: null,
      })
      project.waiting.push({ rule, project: runProject })
    }
    if (!project.current) void drain(root, project)
    return list(root)
  }

  /** Cancels one rule, or every rule waiting or running in the project. */
  const cancel = (root: string, id: string | null) => {
    const project = projects.get(root)
    if (!project) return []
    for (const run of project.runs.values()) {
      if ((id !== null && run.rule !== id) || !isActive(run)) continue
      if (run.status === 'running') project.current?.abort()
      else run.endedAt = now()
      run.status = 'cancelled'
    }
    project.waiting = project.waiting.filter(
      (entry) => project.runs.get(entry.rule.id)?.status === 'queued',
    )
    return list(root)
  }

  const stopAll = () => {
    for (const root of projects.keys()) cancel(root, null)
  }

  return { start, cancel, list, stopAll }
}

export type Runs = ReturnType<typeof createRuns>

const ruleIdsOf = (body: unknown): string[] => {
  const rules: unknown =
    typeof body === 'object' && body !== null && 'rules' in body ? body.rules : null
  if (!Array.isArray(rules) || !rules.length || !rules.every((id) => typeof id === 'string'))
    throw new RunError('the body needs a non-empty "rules" array of rule ids', 400)
  return rules
}

const ruleIdOf = (body: unknown) => {
  const rule = typeof body === 'object' && body !== null && 'rule' in body ? body.rule : null
  return typeof rule === 'string' ? rule : null
}

/** The project routes of the runs: the list the page polls, and starting and cancelling by POST. */
export const runRoutes = (
  overrides: Overrides,
  runs: Runs,
): [string, (call: ProjectCall) => void][] => {
  const withBody =
    (verb: string, answer: (root: string, body: unknown) => RuleRun[], status = 200) =>
    ({ request, response, root }: ProjectCall) => {
      if (request.method !== 'POST')
        return json(response, { error: `${verb} a run takes a POST` }, 405)
      readJson(request).then(
        (body) => {
          try {
            json(response, { runs: answer(root, body) }, status)
          } catch (error) {
            json(
              response,
              { error: messageOf(error) },
              error instanceof RunError ? error.status : 500,
            )
          }
        },
        (error: unknown) => json(response, { error: messageOf(error) }, 400),
      )
    }

  return [
    [API.runs, ({ response, root }) => json(response, { runs: runs.list(root) })],
    [
      API.run,
      withBody(
        'starting',
        (root, body) => {
          const { config, stateDir } = projectContext(root, overrides)
          return runs.start(root, { config, stateDir }, ruleIdsOf(body))
        },
        202,
      ),
    ],
    [API.runCancel, withBody('cancelling', (root, body) => runs.cancel(root, ruleIdOf(body)))],
  ]
}
