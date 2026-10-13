const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The Database tab, in beta: the Drizzle schema, its feature graph and its migrations. */
export const databaseEn = {
  beta: 'beta',
  intro:
    'The database as the Drizzle schema declares it, read from the source: tables, columns and foreign keys, grouped into features and checked like the import graph. Beta: the database rules score their own family, never the overall score, and never gate --check.',
  views: { schema: 'Schema', features: 'Features', migrations: 'Migrations' },
  tiles: {
    tables: 'Tables',
    views: 'Views',
    columns: 'Columns',
    foreignKeys: 'Foreign keys',
    features: 'Features',
    junctions: 'Junction tables',
    migrations: 'Migrations',
    enums: 'Enums',
  },
  config: {
    title: 'Drizzle config',
    others: (n: number) => `${plural(n, 'other config', 'other configs')} found`,
    schema: 'schema',
    out: 'migrations',
    dialect: 'dialect',
    files: (n: number) => plural(n, 'schema file read', 'schema files read'),
    featuresPrefix:
      'Features are grouped by the first word of each table name. Set database.features in the config to correct them.',
    featuresConfig: 'Features come from database.features in the config.',
    openConfig: 'Open the config',
  },
  empty: {
    title: 'No Drizzle config found',
    text: 'code-atlas looks for drizzle.config.* under the project, four folders deep, then under its workspace when the project has none. To name one, add "database": { "config": "packages/db/drizzle.config.ts" } to code-atlas.json.',
    readOnly:
      'The config is read as text and never executed; the schema files are parsed with the project’s own TypeScript. Nothing connects to a database.',
  },
  schema: {
    feature: 'Feature',
    all: 'All tables',
    search: 'Find a table…',
    neighbours: 'Linked tables of other features',
    noTables: 'No table to show.',
    columns: (n: number) => plural(n, 'column', 'columns'),
    pk: 'PK',
    unique: 'unique',
    junction: 'junction',
    view: 'view',
    references: (n: number) => `References (${n})`,
    referencedBy: (n: number) => `Referenced by (${n})`,
    declaredIn: 'Declared in',
    outsideRoot: 'outside the project, so it cannot be opened here',
    unresolved: 'not a table of this schema',
    legend: {
      own: 'tables of the feature',
      other: 'linked tables of other features',
      junction: 'junction table: links two features, the accepted way',
      line: 'foreign key, from the column to the table it references',
    },
    hint: 'Hover a table to see its foreign keys; click it for the details.',
  },
  graph: {
    files: (n: number) => plural(n, 'table', 'tables'),
    unitLabel: 'Tables',
    sizeLabel: 'Columns',
    edgeTitle: (from: string, to: string, weight: number) =>
      `${from} → ${to} · ${plural(weight, 'foreign key', 'foreign keys')}`,
    problemImports: 'Foreign keys behind the red edges',
    minWeight: (n: number) => `Min. foreign keys: ${n}`,
    minWeightHelp: 'Hide the grey links with fewer foreign keys than this. Red and amber stay.',
    noRedEdges: 'No upward or mutual foreign key between features.',
    empty: 'No feature: the schema declares no table.',
    noLayersBanner:
      'No database layers configured: each band is a dependency level. Describe them under "database": { "layers": [...] } to see which foreign keys climb back up.',
    help: [
      [
        'A box is a feature',
        'A group of tables — by the first word of their names, or by the config — with its table count.',
      ],
      [
        'An arrow is a foreign key',
        'From the feature whose table holds the key to the feature it references. The thicker, the more keys behind it.',
      ],
      [
        'Red, amber, grey',
        'Red climbs back up a layer or goes both ways: two features nested in each other. Amber links two sibling features directly. Dashed grey, through a junction table — the accepted way for two features to meet.',
      ],
      [
        'Hover, click, search',
        'Hovering a feature isolates its links and shows their weight. Clicking opens its details. The search dims everything else.',
      ],
    ] as [string, string][],
    helpLayers: [
      'Bands are your database layers',
      'From the top, down to the reference tables everything points at. A healthy foreign key always points down.',
    ] as [string, string],
    helpDepth: [
      'Bands are levels',
      'Without database layers, a feature sits one band below the deepest feature referencing it. Arcs inside one band go both ways.',
    ] as [string, string],
    legend: {
      red: 'climbs back up / both ways',
      amber: 'between siblings, directly',
      grey: 'normal',
      light: 'allowed / unlayered / via a junction table',
      flagged: 'feature involved in a red edge',
    },
  },
  migrations: {
    none: 'This Drizzle config names no migrations folder (out), or the folder is empty.',
    v0: (dir: string) =>
      `${dir} uses the Drizzle Kit v0 layout (meta/_journal.json). The graph needs the v1 layout: one folder per migration, with its snapshot.json.`,
    loading: 'Reading the migrations…',
    count: (n: number) => plural(n, 'migration', 'migrations'),
    heads: (n: number) => plural(n, 'head', 'heads'),
    headsHelp:
      'A head is a migration nothing builds on. Two heads are two branches nobody merged yet: drizzle-kit refuses to apply them.',
    unresolved: (n: number) => plural(n, 'unknown parent', 'unknown parents'),
    filter: 'Filter migrations…',
    head: 'head',
    merge: 'merge',
    uncommitted: 'uncommitted',
    created: 'created',
    snapshot: 'snapshot',
    parents: 'parents',
    root: 'root',
    statements: 'statements',
    objects: 'objects',
    commit: 'commit',
    subject: 'subject',
    notCommitted: 'not committed',
    emptySql: 'Empty migration.',
    credit: 'Lanes rebuilt from each snapshot’s prevIds by drizzle-graph.',
    close: 'Close',
  },
  ruleTitles: {
    'db-layers': 'Upward foreign keys',
    'db-mutual': 'Features nested in each other',
    'db-siblings': 'Direct links between sibling features',
  },
}
