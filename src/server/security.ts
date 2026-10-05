import { API } from '../shared/routes'
import type { SecurityPayload, StrixRunSummary, StrixScan } from '../shared/types'
import { json, messageOf, readJson } from './http'
import type { ProjectCall } from './http'
import { projectContext } from './project'
import type { Overrides } from './project'
import { parseScanRequest, ScanError } from './strixScan'
import type { Scans } from './strixScan'
import { listRunNames, readRunSummaries, readStrixRun, strixRunsDir } from './strixReport'
import { strixIntegration } from './strixTooling'

/**
 * A run still marked running that no scan of this server drives was cut short: Strix was killed.
 * While a scan has not found its run folder yet, any running one may be it.
 */
const settle =
  (scan: StrixScan | null) =>
  <T extends StrixRunSummary>(run: T): T => {
    if (run.status !== 'running' || (scan?.running && (!scan.run || scan.run === run.name)))
      return run
    return { ...run, status: 'interrupted' }
  }

/** The Security tab in one answer: the scan in progress, the past runs, one run in full, the tooling. */
export const securityPayload = (
  root: string,
  stateDir: string,
  scan: StrixScan | null,
  asked: string | null,
): SecurityPayload => {
  const runsDir = strixRunsDir(stateDir)
  const name = asked ?? listRunNames(stateDir)[0] ?? null
  const run = name ? readStrixRun(root, stateDir, name) : null
  const settled = settle(scan)
  return {
    runsDir,
    scan,
    runs: readRunSummaries(root, stateDir).map(settled),
    run: run && settled(run),
    integration: strixIntegration(root, runsDir),
  }
}

/** The project routes of the Security tab. Starting and cancelling take a POST from the page. */
export const securityRoutes = (
  overrides: Overrides,
  scans: Scans,
): [string, (call: ProjectCall) => void][] => {
  const stateDirOf = (root: string) => projectContext(root, overrides).stateDir

  const startScan = ({ request, response, root }: ProjectCall) => {
    if (request.method !== 'POST')
      return json(response, { error: 'starting a scan takes a POST' }, 405)
    readJson(request).then(
      (body) => {
        try {
          json(response, { scan: scans.start(root, stateDirOf(root), parseScanRequest(body)) }, 202)
        } catch (error) {
          json(
            response,
            { error: messageOf(error) },
            error instanceof ScanError ? error.status : 500,
          )
        }
      },
      (error: unknown) => json(response, { error: messageOf(error) }, 400),
    )
  }

  const cancelScan = ({ request, response, root }: ProjectCall) => {
    if (request.method !== 'POST')
      return json(response, { error: 'cancelling a scan takes a POST' }, 405)
    json(response, { cancelled: scans.cancel(root) })
  }

  return [
    [
      API.security,
      ({ response, url, root }) =>
        json(
          response,
          securityPayload(root, stateDirOf(root), scans.get(root), url.searchParams.get('run')),
        ),
    ],
    [API.securityScan, startScan],
    [API.securityCancel, cancelScan],
  ]
}
