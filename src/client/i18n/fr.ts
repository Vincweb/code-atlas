import type { Strings } from './en'
import { learnFr } from './learn.fr'
import { configHelpFr } from './configHelp.fr'
import { auditsFr } from './audits.fr'

export const fr: Strings = {
  locale: 'fr-FR',

  titles: { welcome: 'code-atlas — cartographier et auditer une base TypeScript' },

  common: {
    retry: 'Réessayer',
    copy: 'Copier',
    copied: 'Copié',
    loading: 'Chargement…',
    notRun: 'non lancé',
    unlayered: 'Hors couche',
    none: 'aucune',
  },

  welcome: {
    madeFor: 'Conçu pour les projets TypeScript et Claude Code · MIT',
    hasConfig: 'configuré',
    localOnly:
      'Lit votre code en local ; n’écrit que sous .code-atlas/ quand vous lancez une règle.',
  },

  prefs: {
    theme: 'Thème',
    themes: { light: 'Clair', system: 'Système', dark: 'Sombre' },
    language: 'Langue',
  },

  recent: {
    title: 'Projets récents',
    empty:
      'Aucun projet ouvert pour l’instant. Parcourez vos dossiers pour en choisir un — il apparaîtra ici.',
    remove: 'Retirer des projets récents',
    score: 'Score global à la dernière analyse',
  },

  explorer: {
    show: 'Parcourir mes dossiers',
    hide: 'Masquer l’explorateur',
    title: 'Explorer vos dossiers',
    places: 'Emplacements',
    home: 'Dossier personnel',
    filter: 'Filtrer ce dossier…',
    editPath: 'Saisir un chemin',
    pathLabel: 'Chemin du dossier',
    go: 'Aller',
    up: 'Dossier parent',
    open: 'Ouvrir',
    thisIsProject: 'Ce dossier est un projet TypeScript.',
    empty: 'Aucun sous-dossier ici.',
    noMatch: 'Aucun dossier ne correspond.',
    project: 'TypeScript',
    git: 'git',
    hint: '↑ ↓ pour se déplacer · Entrée pour entrer · ⌘/Ctrl + Entrée pour ouvrir · ⌫ pour remonter',
  },

  landing: {
    eyebrow: 'Architecture · Clean code · Audits IA',
    title: 'Voyez la forme de votre code.',
    titleAccent: 'Et ce qui s’y dégrade.',
    lead: 'code-atlas lit votre projet TypeScript avec son propre compilateur, regroupe les fichiers en features, les range dans vos couches et signale chaque dépendance qui remonte ou tourne en rond. Règles scriptées, commandes du projet et audits IA se résument en un score par famille.',
    cta: 'Ouvrir un projet',
    copyCommand: 'Copier la commande',
    copied: 'Copié',
    art: 'Un graphe de features sur trois couches : une dépendance remonte, en rouge ; deux features sœurs dépendent l’une de l’autre, en orange.',
    scores: { architecture: 'Architecture', cleanCode: 'Code propre', tooling: 'Outillage' },
    featuresTitle: 'Ce qu’il vous montre',
    features: [
      {
        title: 'Le graphe des features',
        text: 'Vos dossiers deviennent des features, rangées dans vos couches. En rouge : ce qui remonte une couche ou fait l’aller-retour.',
      },
      {
        title: 'Des règles qui mesurent',
        text: 'Couches, cycles, complexité, taille, motifs interdits — calculés à chaque analyse, au fichier et à la ligne près.',
      },
      {
        title: 'Vos commandes, et Claude',
        text: 'Lint, types, tests : vos scripts deviennent des règles. Les audits IA lisent le code avec Claude Code — en lecture seule, budget plafonné.',
      },
      {
        title: 'Un score, un garde-fou',
        text: 'Un score par famille, une référence que vous commitez, et une vérification CI qui n’échoue que si ça empire.',
      },
    ],
    stepsTitle: 'Trois étapes pour démarrer',
    steps: [
      { title: 'Lancez', command: 'npx code-atlas', text: 'dans le dossier du projet.' },
      {
        title: 'Décrivez vos couches',
        command: 'code-atlas.json',
        text: 'ou partez du brouillon généré depuis votre graphe.',
      },
      {
        title: 'Verrouillez',
        command: 'npx code-atlas --check',
        text: 'en CI, contre la référence enregistrée.',
      },
    ],
    trust: [
      '100 % local',
      'Zéro dépendance',
      'Le TypeScript de votre projet',
      'L’IA via votre Claude Code',
    ],
    openTitle: 'Ouvrir un projet',
    openText:
      'Reprenez là où vous en étiez, ou parcourez vos dossiers jusqu’à un projet TypeScript.',
  },

  project: {
    back: 'Projets',
    analysing: 'Analyse du projet…',
    modified: 'modifié',
    analysedIn: (duration: string) => `analysé en ${duration}`,
    reanalyse: 'Ré-analyser',
  },

  tabs: {
    label: 'Sections du projet',
    overview: 'Vue d’ensemble',
    graph: 'Graphe',
    rules: 'Règles',
    audits: 'Audits IA',
    metrics: 'Métriques',
    config: 'Config',
  },

  families: {
    architecture: 'Architecture',
    'clean-code': 'Code propre',
    tooling: 'Outillage',
    ai: 'Audits IA',
  },

  severity: { critical: 'critique', high: 'haute', medium: 'moyenne', low: 'basse' },

  status: { pass: 'ok', fail: 'échec', 'not-run': 'non lancé', error: 'erreur' },

  ruleTitles: {
    layers: 'Imports remontants',
    mutual: 'Allers-retours entre features',
    siblings: 'Couplage entre features sœurs',
    noCycle: 'Cycles d’imports',
    forbid: (from: string, to: string) => `Imports interdits ${from} → ${to}`,
    maxLines: (max: number) => `Fichiers de plus de ${max} lignes`,
    complexity: (max: number) => `Fonctions de complexité supérieure à ${max}`,
    maxParams: (max: number) => `Fonctions à plus de ${max} paramètres`,
    pattern: (pattern: string) => `Motif /${pattern}/`,
    aiArch: 'Revue d’architecture par Claude',
    aiClean: 'Revue de clean code par Claude',
  },

  learn: learnFr,

  overview: {
    overall: 'Score global',
    files: 'Fichiers',
    lines: 'Lignes',
    imports: 'Imports',
    typeImports: 'Imports de types',
    features: 'Features',
    functions: 'Fonctions',
    cycles: 'Cycles',
    warnings: (n: number) => `${n} ${n === 1 ? 'avertissement' : 'avertissements'}`,
  },

  rules: {
    summary: (total: number) => `${total} règles`,
    failingCount: (n: number) => `${n} en échec`,
    passingCount: (n: number) => `${n} OK`,
    pendingCount: (n: number) => `${n} pas lancées`,
    filters: { all: 'Toutes', fail: 'En échec', pass: 'OK', pending: 'Pas lancées' },
    allFamilies: 'Toutes les familles',
    search: 'Chercher une règle…',
    intro:
      'Chaque règle part de 100 et perd des points à chaque violation, plus vite si elle est sévère. Dépliez une règle pour voir ce qu’elle vérifie et chaque cas.',
    noMatch: 'Aucune règle ne correspond à ces filtres.',
    files: (n: number) => `${n} ${n === 1 ? 'fichier' : 'fichiers'}`,
    showAllFiles: (n: number) => `Voir les ${n} fichiers`,
    showLess: 'Réduire',
    never: 'jamais lancée',
    lastRun: (when: string) => `lancée ${when}`,
    seeAudits: 'Audits IA',
    fixTitle: 'Corriger avec Claude',
    fixText:
      'Claude reçoit la règle, la façon de corriger et la liste des cas, puis corrige le code.',
    fixPrompt: (p: {
      root: string
      id: string
      title: string
      what: string
      fix: string
      describe: string
      count: number
      list: string
    }) =>
      [
        `Dans le projet ${p.root}, corrige les violations de la règle code-atlas ${p.id} — ${p.title}.`,
        `Ce qu’elle signale : ${p.what}`,
        `Comment corriger : ${p.fix}`,
        `Pour le contexte (couches, arêtes, règles), lance : ${p.describe}`,
        '',
        `Violations (${p.count}) :`,
        p.list,
        '',
        'Corrige le code, pas code-atlas.json. Garde le comportement identique et vérifie avec le lint et les tests du projet. Relance ensuite la commande pour confirmer que les violations ont disparu, puis résume tes changements.',
      ].join('\n'),
    connectionLost: 'La connexion au serveur a été perdue.',
    cancelled: 'Annulé.',
    running: 'En cours…',
    cancel: 'Annuler',
    stale: 'périmé',
    violations: (n: number) => `${n} ${n === 1 ? 'violation' : 'violations'}`,
    run: 'Lancer',
    runAi: (budget: string) => `Lancer (jusqu’à ${budget})`,
    showing: (shown: number, total: number) => `${shown} affichées sur ${total}`,
    confirmAi: (budget: string) =>
      `Cet audit IA utilise votre connexion Claude Code et coûte de l’argent, jusqu’à ${budget}. Le lancer ?`,
    runAllCommands: 'Lancer toutes les commandes',
    cancelAll: (left: number) => `Annuler l’exécution (${left} restant${left > 1 ? 's' : ''})`,
  },

  metrics: {
    intro:
      'Les chiffres bruts du code : taille, complexité et couplage de chaque partie. Ils ne notent rien par eux-mêmes ; les règles s’appuient dessus.',
    tiles: {
      files: 'Fichiers',
      filesHint: 'source analysés',
      lines: 'Lignes',
      linesHint: (avg: string) => `${avg} par fichier en moyenne`,
      functions: 'Fonctions',
      complexity: 'Complexité moyenne',
      complexityHint: (max: number) => `max ${max}`,
      features: 'Features',
      featuresHint: (n: number) => `${n} ${n === 1 ? 'couche' : 'couches'}`,
      noLayers: 'sans couches',
      instability: 'Instabilité moyenne',
      instabilityHint: '0 stable · 1 instable',
    },
    complexityTitle: 'Complexité des fonctions',
    complexityText:
      'Le nombre de chemins possibles dans une fonction (if, boucles, ?:, &&…). Au-delà de 10 elle se teste mal, au-delà de 15 elle se relit mal.',
    sizeTitle: 'Taille des fichiers',
    sizeText: 'Un fichier long mélange souvent plusieurs responsabilités.',
    aboveLimit: (n: number, max: number, id: string) => `${n} au-dessus de ${max} (règle ${id})`,
    bucket: (min: number, max: number | null) => (max === null ? `${min}+` : `${min}–${max}`),
    countFunctions: (n: number) => `${n} ${n === 1 ? 'fonction' : 'fonctions'}`,
    countFiles: (n: number) => `${n} ${n === 1 ? 'fichier' : 'fichiers'}`,
    features: 'Features',
    featuresText:
      'Chaque feature avec sa taille et son couplage. « Utilisée par » (Ca) : combien de features en dépendent. « Dépend de » (Ce) : de combien elle dépend. Instabilité = Ce / (Ca + Ce) : proche de 0, un socle dont tout dépend ; proche de 1, une feature qui dépend de tout et que rien n’utilise.',
    search: 'Filtrer les features…',
    feature: 'Feature',
    layer: 'Couche',
    files: 'Fichiers',
    lines: 'Lignes',
    ca: 'Utilisée par',
    ce: 'Dépend de',
    instability: 'Instabilité',
    topFunctions: 'Fonctions les plus complexes',
    topFunctionsText: 'Les 30 premières ; le trait marque la limite de la règle de complexité.',
    largestFiles: 'Plus gros fichiers',
    largestFilesText: 'Les 20 premiers ; le trait marque la limite de la règle de taille.',
    limit: (max: number) => `limite ${max}`,
    paramsCount: (n: number) => `${n} param.`,
    linesCount: (n: number) => `${n} lignes`,
  },

  claude: {
    open: 'Ouvrir dans Claude Code',
    copy: 'Copier le prompt',
    copied: 'Prompt copié',
    show: 'Voir le prompt',
    hide: 'Masquer le prompt',
    hint: 'Le bouton lance Claude Code dans le projet avec ce prompt prêt (le navigateur demande d’abord). Sinon, copiez-le dans n’importe quelle conversation Claude.',
  },

  audits: auditsFr,

  configHelp: configHelpFr,

  config: {
    sources: {
      file: 'Lue depuis le fichier de config du projet',
      cli: 'Lue depuis un fichier donné en ligne de commande',
      default: 'Configuration par défaut (aucun fichier de config trouvé)',
    },
    generate: 'Générer un brouillon',
    draftHint: (file: string) =>
      `Enregistrez-le sous ${file} à la racine du projet, puis corrigez-le.`,
  },

  viewer: { close: 'Fermer' },

  edgeClass: {
    down: 'descendante',
    up: 'remontante',
    mutual: 'mutuelle',
    sibling: 'entre voisines',
    lateral: 'latérale',
    allowed: 'autorisée',
    unlayered: 'hors couche',
  },

  graph: {
    unlayered: 'Hors couche',
    depth: (n: number) => `Niveau ${n + 1}`,
    edgeTitle: (from: string, to: string, weight: number) =>
      `${from} → ${to} · ${weight} ${weight === 1 ? 'import' : 'imports'}`,
    files: (n: number) => `${n} ${n === 1 ? 'fichier' : 'fichiers'}`,
    instabilityHelp:
      'Instabilité = Ce / (Ca + Ce) : 0 si tout en dépend, 1 si elle dépend de tout.',
    dependsOn: (n: number) => `Dépend de (${n})`,
    usedBy: (n: number) => `Utilisée par (${n})`,
    problemImports: 'Imports derrière les arêtes rouges',
    clickHint: 'Survolez une feature pour voir ses liens ; cliquez pour le détail.',
    close: 'Fermer',
    mostCoupled: 'Features les plus couplées',
    coupling: (ca: number, ce: number) => `${ca} entrantes · ${ce} sortantes`,
    cycles: (n: number) => `Cycles de fichiers (${n})`,
    noCycles: 'Aucun cycle de fichiers.',
    redEdges: (n: number) => `Arêtes rouges (${n})`,
    noRedEdges: 'Aucune dépendance remontante ou mutuelle.',
    noLayersBanner:
      'Pas de couches configurées : chaque bande est un niveau de dépendance, le niveau 1 regroupe ce dont rien ne dépend. Décrivez vos couches pour voir ce qui remonte.',
    openConfig: 'Ouvrir la config',
    modes: { all: 'Tout', problems: 'Problèmes seuls' },
    minWeight: (n: number) => `Imports min. : ${n}`,
    minWeightHelp:
      'Masque les liens gris qui ont moins d’imports que ce seuil. Rouge et orange restent.',
    search: 'Chercher une feature…',
    showHelp: 'Comment lire ce graphe',
    hideHelp: 'Masquer l’aide',
    panel: 'Détails',
    collapsePanel: 'Replier le panneau',
    expandPanel: 'Ouvrir le panneau',
    empty: 'Aucune feature trouvée.',
    help: [
      [
        'Une boîte, une feature',
        'Un dossier qui regroupe une fonctionnalité, avec son nombre de fichiers.',
      ],
      [
        'Une flèche, un import',
        'De la feature qui importe vers celle qu’elle importe. Plus elle est épaisse, plus il y a d’imports derrière.',
      ],
      [
        'Rouge, orange, gris',
        'Rouge : ça remonte une couche ou ça fait l’aller-retour. Orange : un lien entre features sœurs. Gris : une dépendance normale ; en pointillé, une dépendance autorisée.',
      ],
      [
        'Survoler, cliquer, chercher',
        'Survoler une feature isole ses liens et affiche leur poids. Cliquer ouvre son détail. La recherche estompe tout le reste.',
      ],
    ],
    helpLayers: [
      'Les bandes sont vos couches',
      'Du haut de la pile, en haut, jusqu’au socle, en bas. Une flèche saine descend toujours.',
    ],
    helpDepth: [
      'Les bandes sont des niveaux',
      'Sans couches, une feature se place une bande sous la plus profonde qui l’importe. Les arcs dans une même bande vont dans les deux sens.',
    ],
    legend: {
      red: 'remonte / aller-retour',
      amber: 'entre features sœurs',
      grey: 'normale',
      light: 'autorisée / hors couche',
      flagged: 'feature impliquée dans une arête rouge',
    },
  },
}
