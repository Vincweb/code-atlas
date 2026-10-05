import type { RuleConfig } from '../../shared/config'
import { packageOf, withoutPackages } from '../../shared/packages'
import { ruleScore } from '../../shared/score'
import type { EngineResult, RuleResult, Violation } from '../../shared/types'
import { matchGlob } from '../engine/glob'

const MAX_VIOLATIONS = 500

/** Who owns what in a monorepo: each file's package and each package's size. */
export type Owners = {
  dirs: string[]
  ownerOf: (file: string | null) => string | null
  lines: Map<string, number>
  files: Map<string, string[]>
}

export const ownersOf = (engine: EngineResult): Owners | null => {
  if (engine.packages.length === 0) return null
  const dirs = engine.packages.map((pkg) => pkg.dir)
  const nested = dirs.filter((dir) => dir !== '.')
  const fallback = dirs.includes('.') ? '.' : null
  const byFile = new Map(engine.files.map((file) => [file.path, file.package]))
  const lines = new Map<string, number>(dirs.map((dir) => [dir, 0]))
  const files = new Map<string, string[]>(dirs.map((dir) => [dir, []]))
  for (const file of engine.files) {
    if (file.package === null) continue
    lines.set(file.package, (lines.get(file.package) ?? 0) + file.lines)
    files.get(file.package)?.push(file.path)
  }
  return {
    dirs,
    lines,
    files,
    ownerOf: (file) =>
      file === null ? null : (byFile.get(file) ?? packageOf(file, nested) ?? fallback),
  }
}

/** The glob that narrows a rule to some files: a package none of whose files match is out of it. */
const scopeOf = (rule: RuleConfig): string | undefined => {
  switch (rule.kind) {
    case 'max-lines':
    case 'complexity':
    case 'max-params':
    case 'pattern':
    case 'ai':
      return rule.files
    case 'forbid-import':
      return rule.from
    default:
      return undefined
  }
}

const hasResult = (result: RuleResult) => result.status === 'pass' || result.status === 'fail'

/**
 * A rule's score across the packages: each package's score weighted by its lines, times the score
 * of the violations no package owns. Ten packages with three violations each score like one
 * package with three, not like one with thirty.
 */
const workspaceScore = (result: RuleResult, owners: Owners) => {
  let weight = 0
  let total = 0
  for (const [dir, count] of Object.entries(result.packages ?? {})) {
    const lines = Math.max(1, owners.lines.get(dir) ?? 0)
    weight += lines
    total += lines * ruleScore(result.severity, count)
  }
  const owned = weight ? total / weight : 100
  return Math.round((owned * ruleScore(result.severity, result.unattributed ?? 0)) / 100)
}

const truncate = (violations: Violation[]) => {
  const kept = new Map<string | null, number>()
  return violations.filter((violation) => {
    const key = violation.package ?? null
    const count = kept.get(key) ?? 0
    kept.set(key, count + 1)
    return count < MAX_VIOLATIONS
  })
}

/**
 * The final result of a rule from all its violations: their count and score, and in a monorepo
 * the package each one counts against. A violation that already names its package keeps it.
 */
export const settle = (
  rule: RuleConfig,
  result: RuleResult,
  violations: Violation[],
  owners: Owners | null,
): RuleResult => {
  const ran = hasResult(result)
  // A stored run keeps 500 violations but its full count: what was cut belongs to no package.
  const count = Math.max(result.count, violations.length)
  if (!owners) {
    return {
      ...withoutPackages(result),
      count,
      score: ran ? ruleScore(result.severity, count) : null,
      violations: violations.slice(0, MAX_VIOLATIONS),
    }
  }
  const scope = scopeOf(rule)
  const packages: Record<string, number> = {}
  for (const dir of owners.dirs)
    if (!scope || (owners.files.get(dir) ?? []).some((file) => matchGlob(file, scope)))
      packages[dir] = 0
  let unattributed = count - violations.length
  const owned = violations.map((violation) => {
    const owner =
      violation.package !== undefined ? violation.package : owners.ownerOf(violation.file)
    if (owner !== null && owner in packages) packages[owner] = (packages[owner] ?? 0) + 1
    else unattributed++
    return { ...violation, package: owner !== null && owner in packages ? owner : null }
  })
  const settled = { ...result, count, packages, unattributed, violations: [] }
  return {
    ...settled,
    score: ran ? workspaceScore(settled, owners) : null,
    violations: truncate(owned),
  }
}
