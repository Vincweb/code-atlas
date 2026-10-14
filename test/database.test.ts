import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import type { ResolvedConfig, ResolvedDatabaseConfig, RuleConfig } from '../src/shared/config'
import { loadConfig } from '../src/server/config'
import { draftConfig } from '../src/server/configDraft'
import { analyzeEngine } from '../src/server/engine'
import { findDrizzleConfigs, readDrizzleConfig } from '../src/server/engine/database/discover'
import { prefixOf } from '../src/server/engine/database/features'
import {
  buildMigrationGraph,
  migrationsInfo,
  readMigrationSql,
} from '../src/server/engine/database/migrations'
import { describeProject } from '../src/server/describe'
import { makeBaseline, runCheck } from '../src/server/rules'
import { computeScores } from '../src/server/rules/score'
import { evaluateStatic } from '../src/server/rules/static'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'drizzle')
const none = { root: null, config: null, state: null }

const flat: ResolvedDatabaseConfig = {
  config: null,
  features: null,
  layers: [],
  allow: [],
  junctions: [],
}

const configOf = (database: ResolvedDatabaseConfig, rules: RuleConfig[] = []): ResolvedConfig => ({
  include: ['src/**'],
  exclude: [],
  tsconfig: 'tsconfig.json',
  workspaces: [],
  features: ['src/*'],
  docs: [],
  layers: [],
  allow: [],
  rules,
  ai: { model: 'sonnet', language: 'English' },
  database,
})

const layered: ResolvedDatabaseConfig = {
  ...flat,
  layers: [
    { name: 'Top', features: ['customer', 'project', 'events'], siblings: true },
    { name: 'Core', features: ['users'] },
  ],
}

const engine = analyzeEngine(root, configOf(flat))
const db = engine.database
const table = (id: string) => db?.tables.find((candidate) => candidate.id === id)
const edge = (from: string, to: string) =>
  db?.graph.edges.find((candidate) => candidate.from === from && candidate.to === to)

test('finds the Drizzle config and reads it as text', () => {
  const [file] = findDrizzleConfigs(root)
  assert.equal(file, path.join(root, 'drizzle.config.ts'))
  const info = readDrizzleConfig(file ?? '')
  assert.deepEqual(info.schema, ['./src/schema/index.ts'])
  assert.equal(info.out, './drizzle')
  assert.equal(info.dialect, 'postgresql')
})

test('reads the tables through the barrel, the schema object and the spread helper', () => {
  assert.ok(db)
  assert.deepEqual(
    db.tables.map((item) => item.id),
    [
      'active_users',
      'audit.events',
      'customer_notes',
      'customers',
      'customers_projects',
      'project_tags',
      'projects',
      'users',
    ],
  )
  assert.equal(db.stats.tables, 7)
  assert.equal(db.stats.views, 1)
  assert.equal(table('active_users')?.kind, 'view')
  assert.equal(table('audit.events')?.schema, 'audit')
  assert.equal(table('audit.events')?.file, 'src/schema/reporting.ts')
  const users = table('users')
  assert.deepEqual(
    users?.columns.map((column) => column.name),
    ['id', 'email', 'role', 'defaultCustomerId', 'createdAt', 'updatedAt'],
  )
  const email = users?.columns.find((column) => column.name === 'email')
  assert.equal(email?.type, 'varchar')
  assert.equal(email?.sqlName, 'email')
  assert.ok(email?.notNull && email.unique)
  assert.equal(users?.columns.find((column) => column.name === 'role')?.type, 'roleEnum')
  assert.deepEqual(users?.primaryKey, ['id'])
  assert.deepEqual(
    db.enums.map((item) => [item.name, item.values]),
    [['role', ['admin', 'member']]],
  )
  assert.deepEqual(db.files, [
    'src/helpers.ts',
    'src/schema/app.ts',
    'src/schema/customers.ts',
    'src/schema/index.ts',
    'src/schema/links.ts',
    'src/schema/projects.ts',
    'src/schema/reporting.ts',
    'src/schema/users.ts',
  ])
  assert.deepEqual(db.warnings, [])
})

test('reads both foreign-key syntaxes and resolves their targets', () => {
  const inline = table('customers')?.foreignKeys[0]
  assert.deepEqual(inline, {
    name: null,
    columns: ['ownerId'],
    table: 'users',
    targetColumns: ['id'],
    resolved: true,
    line: 8,
  })
  const explicit = table('customer_notes')?.foreignKeys[0]
  assert.equal(explicit?.name, 'customer_notes_customer_id_fk')
  assert.deepEqual(explicit?.columns, ['customerId'])
  assert.equal(explicit?.table, 'customers')
  assert.deepEqual(table('customers_projects')?.primaryKey, ['customerId', 'projectId'])
  assert.deepEqual(table('audit.events')?.uniques, [['userId', 'id']])
  const reference = table('users')?.columns.find((column) => column.name === 'defaultCustomerId')
  assert.deepEqual(reference?.references, { table: 'customers', column: 'id', resolved: true })
})

test('groups tables by the first word of their names, singular and plural together', () => {
  assert.equal(prefixOf('chatArtifacts'), 'chat')
  assert.equal(prefixOf('sell_in_programs'), 'sell')
  assert.deepEqual(
    db?.tables.map((item) => [item.id, item.feature]),
    [
      ['active_users', 'active'],
      ['audit.events', 'events'],
      ['customer_notes', 'customer'],
      ['customers', 'customer'],
      ['customers_projects', 'customer'],
      ['project_tags', 'project'],
      ['projects', 'project'],
      ['users', 'users'],
    ],
  )
  assert.equal(db?.featuresSource, 'prefix')
})

test('detects a junction table from its composite key', () => {
  assert.equal(table('customers_projects')?.junction, true)
  assert.equal(table('customer_notes')?.junction, false)
  assert.equal(table('audit.events')?.junction, false)
  assert.equal(db?.stats.junctions, 1)
})

test('classifies the feature edges; a junction never nests two features', () => {
  assert.equal(edge('customer', 'users')?.class, 'mutual')
  assert.equal(edge('users', 'customer')?.class, 'mutual')
  assert.equal(edge('customer', 'project')?.class, 'junction')
  assert.equal(edge('project', 'customer')?.class, 'down')
  assert.equal(edge('events', 'users')?.class, 'down')
  assert.deepEqual(edge('project', 'customer')?.imports, [
    { file: 'src/schema/projects.ts', line: 8, target: 'projects.customerId → customers.id' },
  ])
  const users = db?.graph.features.find((feature) => feature.id === 'users')
  assert.equal(users?.files, 1)
  assert.equal(users?.lines, 6)
  assert.equal(users?.ca, 3)
})

test('database layers and config features apply like the import ones', () => {
  const result = analyzeEngine(
    root,
    configOf({
      ...layered,
      features: [
        { name: 'customer', tables: ['customer*'] },
        { name: 'audit', tables: ['audit.*'] },
      ],
      junctions: ['customer_notes'],
    }),
  ).database
  const at = (from: string, to: string) =>
    result?.graph.edges.find((candidate) => candidate.from === from && candidate.to === to)
  assert.equal(result?.featuresSource, 'config')
  assert.equal(result?.tables.find((item) => item.id === 'audit.events')?.feature, 'audit')
  assert.equal(result?.tables.find((item) => item.id === 'customer_notes')?.junction, true)
  assert.equal(at('users', 'customer')?.class, 'up')
  assert.equal(at('customer', 'users')?.class, 'down')
  assert.equal(at('project', 'customer')?.class, 'sibling')
  assert.equal(at('audit', 'customer')?.class, 'unlayered')
  assert.deepEqual(
    result?.graph.layers.map((layer) => [layer.name, layer.siblings]),
    [
      ['Top', true],
      ['Core', false],
    ],
  )
})

test('the database rules report the foreign keys behind each edge', () => {
  const rules: RuleConfig[] = [
    { id: 'L', family: 'database', severity: 'high', kind: 'db-layers' },
    { id: 'M', family: 'database', severity: 'medium', kind: 'db-mutual' },
    { id: 'S', family: 'database', severity: 'low', kind: 'db-siblings' },
  ]
  const [layers, mutual, siblings] = evaluateStatic(
    root,
    configOf(layered, rules),
    analyzeEngine(root, configOf(layered)),
    null,
  )
  assert.equal(layers?.count, 1)
  assert.deepEqual(layers?.violations[0], {
    file: 'src/schema/users.ts',
    line: 11,
    message: 'users → customer (up): users.defaultCustomerId → customers.id',
  })
  assert.equal(mutual?.count, 0)
  assert.equal(siblings?.count, 2)
  assert.equal(layers?.title, 'Database layering')
  const [flatMutual] = evaluateStatic(root, configOf(flat, [rules[1] as RuleConfig]), engine, null)
  assert.equal(flatMutual?.count, 2)
})

test('the database family is scored but stays out of the overall score and of --check', async () => {
  const rules: RuleConfig[] = [
    { id: 'CC', family: 'clean-code', severity: 'medium', kind: 'max-lines', max: 1000 },
    { id: 'DB', family: 'database', severity: 'medium', kind: 'db-mutual' },
  ]
  const results = evaluateStatic(root, configOf(flat, rules), engine, null)
  const scores = computeScores(results)
  const database = scores.families.find((family) => family.family === 'database')
  assert.equal(database?.beta, true)
  assert.equal(database?.score, 79)
  assert.equal(scores.families.find((family) => family.family === 'clean-code')?.beta, false)
  assert.equal(scores.overall, 100)
  assert.deepEqual(Object.keys(makeBaseline(results, scores, null).violations), ['CC'])
  const check = await runCheck({
    root,
    config: configOf(flat, rules),
    engine,
    stateDir: path.join(mkdtempSync(path.join(tmpdir(), 'atlas-db-')), '.code-atlas'),
    git: { commit: null, dirty: false },
    skipCommands: true,
    log: () => {},
  })
  assert.deepEqual(
    check.rules.map((rule) => rule.id),
    ['CC'],
  )
  assert.equal(check.ok, true)
})

test('default rules and the draft follow the database', () => {
  const { config } = loadConfig(root)
  assert.ok(config.rules.some((rule) => rule.id === 'DB-MUTUAL'))
  assert.ok(!config.rules.some((rule) => rule.id === 'DB-LAYERS'))
  const draft = draftConfig(root, engine)
  assert.deepEqual(
    draft.database?.features?.find((feature) => feature.name === 'customer'),
    {
      name: 'customer',
      tables: ['customer_*', 'customers', 'customers_*'],
    },
  )
  assert.deepEqual(
    draft.database?.layers?.map((layer) => layer.features),
    [
      ['active', 'events', 'project'],
      ['customer', 'users'],
    ],
  )
  assert.ok(draft.rules?.some((rule) => rule.id === 'DB-MUTUAL'))
  const flatProject = mkdtempSync(path.join(tmpdir(), 'atlas-nodb-'))
  assert.ok(!loadConfig(flatProject).config.rules.some((rule) => rule.kind === 'db-mutual'))
})

test('validates the database key', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'atlas-dbconf-'))
  writeFileSync(
    path.join(dir, 'code-atlas.json'),
    JSON.stringify({
      database: {
        config: 3,
        features: [{ name: '', tables: 'x' }],
        layers: [{ name: 'L' }],
        junctions: 'no',
        nope: true,
      },
    }),
  )
  assert.throws(
    () => loadConfig(dir),
    (error: Error & { issues?: string[] }) => {
      const text = error.issues?.join('\n') ?? ''
      for (const part of [
        'database.config must be a string',
        'database.features[0].name must be a string',
        'database.features[0].tables must be an array',
        'database.layers[0].features must be an array',
        'database.junctions must be an array',
        'database: unknown field nope',
      ])
        assert.match(text, new RegExp(part.replace(/[[\]]/g, '\\$&')))
      return true
    },
  )
})

test('a package sees the Drizzle config of a workspace package it depends on', () => {
  const workspace = mkdtempSync(path.join(tmpdir(), 'atlas-ws-'))
  const write = (file: string, text: string) => {
    mkdirSync(path.dirname(path.join(workspace, file)), { recursive: true })
    writeFileSync(path.join(workspace, file), text)
  }
  write('pnpm-workspace.yaml', 'packages:\n  - apps/*\n  - packages/*\n')
  write('packages/db/package.json', JSON.stringify({ name: '@ws/db' }))
  write('packages/db/drizzle.config.ts', "export default { schema: './src', out: './drizzle' }")
  write('apps/api/package.json', JSON.stringify({ dependencies: { '@ws/db': 'workspace:*' } }))
  write('apps/web/package.json', JSON.stringify({ dependencies: { react: '*' } }))
  assert.deepEqual(findDrizzleConfigs(path.join(workspace, 'apps', 'api')), [
    path.join(workspace, 'packages', 'db', 'drizzle.config.ts'),
  ])
  assert.deepEqual(findDrizzleConfigs(path.join(workspace, 'apps', 'web')), [])
})

test('reads the migrations folder in both layouts', () => {
  const v1 = migrationsInfo(path.join(root, 'drizzle'))
  assert.deepEqual(v1, { dir: path.join(root, 'drizzle'), count: 3, layout: 'v1' })
  assert.equal(migrationsInfo(path.join(root, 'drizzle-v0'))?.layout, 'v0')
  assert.equal(migrationsInfo(path.join(root, 'src')), null)
  assert.deepEqual(db?.migrations, v1)
  const graph = buildMigrationGraph(path.join(root, 'drizzle'))
  assert.equal(graph.rows.length, 3)
  assert.deepEqual(graph.heads.sort(), ['20260102000000_customers', '20260103000000_projects'])
  assert.match(readMigrationSql(path.join(root, 'drizzle'), '20260101000000_init') ?? '', /users/)
  assert.equal(readMigrationSql(path.join(root, 'drizzle'), '../package.json'), null)
})

test('describe includes the database section', () => {
  const { text } = describeProject(root, none)
  assert.match(text, /## Database: 7 tables in 5 features, 1 junction tables/)
  assert.match(text, /Junction tables: customers_projects/)
  assert.match(text, /- customer → users \(mutual, 1 foreign key\)/)
})
