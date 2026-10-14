import { plural } from './plural'
import type { databaseEn } from './database.en'

export const databaseFr: typeof databaseEn = {
  beta: 'bêta',
  intro:
    'La base telle que le schéma Drizzle la déclare, lue depuis les sources : tables, colonnes et clés étrangères, regroupées en features et vérifiées comme le graphe des imports. Bêta : les règles de base de données notent leur propre famille, jamais le score global, et ne bloquent jamais --check.',
  views: { schema: 'Schéma', features: 'Features', migrations: 'Migrations' },
  tiles: {
    tables: 'Tables',
    views: 'Vues',
    columns: 'Colonnes',
    foreignKeys: 'Clés étrangères',
    features: 'Features',
    junctions: 'Tables de jonction',
    migrations: 'Migrations',
    enums: 'Enums',
  },
  config: {
    title: 'Config Drizzle',
    others: (n: number) => `${plural(n, 'autre config trouvée', 'autres configs trouvées')}`,
    schema: 'schéma',
    out: 'migrations',
    dialect: 'dialecte',
    files: (n: number) => plural(n, 'fichier de schéma lu', 'fichiers de schéma lus'),
    featuresPrefix:
      'Les features regroupent les tables par le premier mot de leur nom. Renseignez database.features dans la config pour les corriger.',
    featuresConfig: 'Les features viennent de database.features dans la config.',
    openConfig: 'Ouvrir la config',
  },
  empty: {
    title: 'Aucune config Drizzle trouvée',
    text: 'code-atlas cherche drizzle.config.* sous le projet, jusqu’à quatre dossiers de profondeur, puis sous son workspace quand le projet n’en a pas. Pour en nommer une, ajoutez "database": { "config": "packages/db/drizzle.config.ts" } à code-atlas.json.',
    readOnly:
      'La config est lue comme du texte et jamais exécutée ; les fichiers du schéma sont analysés avec le TypeScript du projet. Rien ne se connecte à une base.',
  },
  schema: {
    feature: 'Feature',
    all: 'Toutes les tables',
    search: 'Chercher une table…',
    neighbours: 'Tables liées des autres features',
    noTables: 'Aucune table à afficher.',
    columns: (n: number) => plural(n, 'colonne', 'colonnes'),
    pk: 'PK',
    unique: 'unique',
    junction: 'jonction',
    view: 'vue',
    references: (n: number) => `Référence (${n})`,
    referencedBy: (n: number) => `Référencée par (${n})`,
    declaredIn: 'Déclarée dans',
    outsideRoot: 'hors du projet, donc impossible à ouvrir ici',
    unresolved: 'pas une table de ce schéma',
    legend: {
      own: 'tables de la feature',
      other: 'tables liées des autres features',
      junction: 'table de jonction : relie deux features, la voie acceptée',
      line: 'clé étrangère, de la colonne vers la table référencée',
    },
    hint: 'Survolez une table pour voir ses clés étrangères ; cliquez pour le détail.',
  },
  graph: {
    files: (n: number) => plural(n, 'table', 'tables'),
    unitLabel: 'Tables',
    sizeLabel: 'Colonnes',
    edgeTitle: (from: string, to: string, weight: number) =>
      `${from} → ${to} · ${plural(weight, 'clé étrangère', 'clés étrangères')}`,
    problemImports: 'Clés étrangères derrière les arêtes rouges',
    minWeight: (n: number) => `Clés étrangères min. : ${n}`,
    minWeightHelp:
      'Masque les liens gris qui ont moins de clés étrangères que ce seuil. Rouge et orange restent.',
    noRedEdges: 'Aucune clé étrangère remontante ou mutuelle entre features.',
    empty: 'Aucune feature : le schéma ne déclare aucune table.',
    noLayersBanner:
      'Pas de couches de base configurées : chaque bande est un niveau de dépendance. Décrivez-les sous "database": { "layers": [...] } pour voir quelles clés étrangères remontent.',
    help: [
      [
        'Une boîte, une feature',
        'Un groupe de tables — par le premier mot de leur nom, ou selon la config — avec son nombre de tables.',
      ],
      [
        'Une flèche, une clé étrangère',
        'De la feature dont la table porte la clé vers la feature qu’elle référence. Plus elle est épaisse, plus il y a de clés derrière.',
      ],
      [
        'Rouge, orange, gris',
        'Rouge : ça remonte une couche ou ça fait l’aller-retour, deux features imbriquées l’une dans l’autre. Orange : un lien direct entre features sœurs. Gris pointillé : via une table de jonction, la voie acceptée pour que deux features se rencontrent.',
      ],
      [
        'Survoler, cliquer, chercher',
        'Survoler une feature isole ses liens et affiche leur poids. Cliquer ouvre son détail. La recherche estompe tout le reste.',
      ],
    ],
    helpLayers: [
      'Les bandes sont vos couches de base',
      'Du haut jusqu’aux tables de référence vers lesquelles tout pointe. Une clé étrangère saine descend toujours.',
    ],
    helpDepth: [
      'Les bandes sont des niveaux',
      'Sans couches de base, une feature se place une bande sous la plus profonde qui la référence. Les arcs dans une même bande vont dans les deux sens.',
    ],
    legend: {
      red: 'remonte / aller-retour',
      amber: 'entre features sœurs, en direct',
      grey: 'normale',
      light: 'autorisée / hors couche / via une table de jonction',
      flagged: 'feature impliquée dans une arête rouge',
    },
  },
  migrations: {
    none: 'Cette config Drizzle ne nomme pas de dossier de migrations (out), ou le dossier est vide.',
    v0: (dir: string) =>
      `${dir} suit la structure Drizzle Kit v0 (meta/_journal.json). Le graphe a besoin de la structure v1 : un dossier par migration, avec son snapshot.json.`,
    loading: 'Lecture des migrations…',
    count: (n: number) => plural(n, 'migration', 'migrations'),
    heads: (n: number) => plural(n, 'tête', 'têtes'),
    headsHelp:
      'Une tête est une migration sur laquelle rien ne s’appuie. Deux têtes, ce sont deux branches que personne n’a encore fusionnées : drizzle-kit refuse de les appliquer.',
    unresolved: (n: number) => plural(n, 'parent inconnu', 'parents inconnus'),
    filter: 'Filtrer les migrations…',
    head: 'tête',
    merge: 'fusion',
    uncommitted: 'non commitée',
    created: 'créée',
    snapshot: 'snapshot',
    parents: 'parents',
    root: 'racine',
    statements: 'instructions',
    objects: 'objets',
    commit: 'commit',
    subject: 'sujet',
    notCommitted: 'pas commitée',
    emptySql: 'Migration vide.',
    credit: 'Lignes reconstruites depuis les prevIds de chaque snapshot par drizzle-graph.',
    close: 'Fermer',
  },
  ruleTitles: {
    'db-layers': 'Clés étrangères remontantes',
    'db-mutual': 'Features imbriquées l’une dans l’autre',
    'db-siblings': 'Liens directs entre features sœurs',
  },
}
