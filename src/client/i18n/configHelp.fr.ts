import type { configHelpEn } from './configHelp.en'

export const configHelpFr: typeof configHelpEn = {
  nav: 'Sur cette page',
  introTitle: 'À quoi sert la config ?',
  intro:
    'code-atlas.json décrit l’architecture que vous voulez : comment les fichiers se regroupent en features, dans quelles couches ranger ces features, et quelles règles vérifier. C’est elle qui décide ce qui passe en rouge.',
  withoutConfig:
    'Sans fichier, code-atlas devine : une feature par dossier, et des niveaux de dépendance à la place des couches. Il voit encore les cycles et les allers-retours, mais pas ce qui remonte.',
  withConfig:
    'Ce projet a sa propre config : les couches, les exceptions et les règles ci-dessous viennent du fichier.',
  steps: {
    draft: {
      title: 'Voir un brouillon',
      text: 'code-atlas propose une config à partir du graphe actuel.',
      action: 'Générer un brouillon',
    },
    create: {
      title: 'Créer le fichier',
      text: 'Écrit code-atlas.json à la racine du projet, à partir du brouillon. Un fichier existant n’est jamais écrasé.',
      action: 'Créer code-atlas.json',
      done: 'Le fichier existe : code-atlas le lit à chaque analyse.',
      confirm: {
        title: 'Créer code-atlas.json ?',
        text: 'code-atlas écrit le brouillon de config à la racine du projet. Rien d’autre n’est modifié dans le projet.',
        where: 'Emplacement',
        what: 'Contenu',
        preparing: 'Préparation du brouillon…',
        summary: (layers: number, features: number, rules: number) =>
          `${layers} ${layers === 1 ? 'couche' : 'couches'} · ${features} ${features === 1 ? 'feature' : 'features'} · ${rules} ${rules === 1 ? 'règle' : 'règles'}`,
        safe: [
          'Un fichier existant n’est jamais écrasé.',
          'Modifiez-le ou supprimez-le quand vous voulez : code-atlas le relit à chaque analyse.',
        ],
        action: 'Créer le fichier',
      },
    },
    claude: {
      title: 'L’améliorer avec Claude Code',
      text: 'Ouvrez Claude Code dans le projet avec ce prompt, ou copiez-le : Claude décrira vos vraies couches et ajoutera des règles.',
    },
    reanalyse: {
      title: 'Ré-analyser',
      text: 'Le graphe et les scores suivent la nouvelle config.',
      action: 'Ré-analyser',
    },
  },
  json: { show: 'Voir le JSON', hide: 'Masquer le JSON', copy: 'Copier le JSON' },
  claudePrompt: (p: {
    root: string
    target: string
    exists: boolean
    describe: string
    context: string
  }) =>
    [
      `Dans le projet ${p.root}, ${p.exists ? 'améliore' : 'crée'} le fichier ${p.target} : il décrit l’architecture du projet pour l’outil code-atlas (features, couches, exceptions, règles).`,
      '',
      'Commence par lancer cette commande. Elle donne le format complet du fichier et l’état actuel du projet (features, couches, arêtes rouges avec les imports en cause, règles, scores) :',
      p.describe,
      '',
      'Ce qu’il faut faire :',
      '1. « features » : des motifs qui regroupent les fichiers en features qui ont du sens.',
      '2. « layers » : les couches de haut en bas, avec des noms parlants ; « siblings »: true quand les features d’une couche doivent rester indépendantes.',
      '3. « allow » : seulement les dépendances voulues malgré les couches, chacune justifiée dans ta réponse.',
      '4. « rules » : garde les règles par défaut ; ajoute des « forbid-import » pour les frontières importantes et des « pattern » pour le code à proscrire.',
      'Appuie-toi sur le code, le CLAUDE.md et les règles de lint du projet s’il y en a.',
      '',
      'Ensuite relance la commande : corrige toute erreur de config, et vérifie que chaque arête rouge restante est un vrai problème du code, pas une erreur de couche. Termine par un résumé de ce que tu as changé et pourquoi.',
      '',
      'État actuel :',
      p.context,
    ].join('\n'),
  context: {
    features: (n: number, layers: string) => `- ${n} features ; couches : ${layers}`,
    noLayers: 'aucune',
    unlayered: (ids: string) => `- Hors couche : ${ids}`,
    red: (n: number, list: string) => `- Arêtes rouges (${n}) : ${list}`,
    noRed: '- Aucune arête rouge.',
    scores: (line: string) => `- Scores : ${line}`,
  },
  scope: {
    title: 'Périmètre',
    text: 'Les fichiers analysés : ce que couvrent les motifs inclus, moins ce que retirent les motifs exclus, lus avec le tsconfig du projet.',
    include: 'Inclus',
    exclude: 'Exclus',
    tsconfig: 'tsconfig',
    files: (n: number) => `${n.toLocaleString('fr-FR')} fichiers analysés`,
  },
  features: {
    title: 'Features',
    text: 'Comment les fichiers se regroupent. Les motifs s’appliquent dans l’ordre ; « * » vaut un dossier : src/components/* fait une feature par sous-dossier de components.',
    fallback: 'Autres dossiers',
    count: (n: number) => `${n} ${n === 1 ? 'feature' : 'features'}`,
  },
  layers: {
    title: 'Couches',
    text: 'De haut en bas : une feature ne devrait dépendre que des couches sous elle. Une couche « sœurs » interdit en plus les liens entre ses propres features.',
    none: 'Aucune couche : le graphe montre des niveaux de dépendance et la règle des imports remontants ne s’applique pas. Générez un brouillon pour partir de quelque chose.',
    siblings: 'features sœurs indépendantes',
    unlayered: 'Hors couche',
    top: 'haut de la pile',
    bottom: 'socle',
  },
  allow: {
    title: 'Exceptions',
    text: 'Des dépendances acceptées malgré les couches — une factory qui connaît les deux implémentations, par exemple. Elles s’affichent en pointillé.',
    none: 'Aucune exception.',
  },
  rules: {
    title: 'Règles',
    text: 'Ce que code-atlas vérifie, et combien chaque règle pèse dans le score. Sans liste dans le fichier, un jeu de règles par défaut s’applique.',
    id: 'Règle',
    kind: 'Type',
    severity: 'Sévérité',
    params: 'Réglage',
    family: 'Famille',
    seeRules: 'Voir les résultats',
  },
  ai: {
    title: 'Audits IA',
    text: 'Les réglages par défaut des règles IA : le modèle Claude, le budget maximum par audit et la langue des constats.',
    model: 'Modèle',
    budget: 'Plafond par audit',
    language: 'Langue',
  },
  aiAudits: {
    title: 'Réglages des audits IA',
    what: 'Un audit IA est une règle vérifiée par Claude plutôt que par un script : Claude relit le code sous l’angle donné par le prompt de la règle et renvoie ses constats (fichier, ligne, message). Il se lance à la demande depuis l’onglet Règles et compte dans la famille « Audits IA ».',
  },
  file: {
    title: 'Le fichier complet',
    text: 'La config telle que code-atlas l’applique, valeurs par défaut comprises.',
  },
  draft: {
    title: 'Brouillon',
    text: 'Le brouillon reprend la structure actuelle : il range les features en couches selon leur profondeur de dépendance et ajoute les règles par défaut. Un point de départ à corriger, pas une vérité.',
    regenerate: 'Regénérer',
  },
  reference: {
    title: 'Référence des clés',
    key: 'Clé',
    role: 'Rôle',
    fallback: 'Par défaut',
    rows: [
      ['include', 'Motifs des fichiers à analyser.', 'src/**'],
      ['exclude', 'Motifs à ignorer (tests, déclarations…).', '**/*.test.*, **/*.d.ts…'],
      ['tsconfig', 'Le tsconfig qui sert à résoudre les imports.', 'tsconfig.json'],
      ['features', 'Motifs qui regroupent les fichiers en features.', 'deviné depuis les dossiers'],
      ['layers', 'Les couches, de haut en bas, avec leurs features.', 'aucune'],
      ['allow', 'Paires [de, vers] acceptées malgré les couches.', 'aucune'],
      ['rules', 'Les règles à vérifier.', 'jeu par défaut'],
      ['ai', 'Modèle, plafond et langue des audits IA.', 'sonnet · 1 $ · English'],
    ],
  },
  kinds: {
    layers: 'Couches',
    mutual: 'Allers-retours',
    siblings: 'Features sœurs',
    'no-cycle': 'Cycles',
    'forbid-import': 'Import interdit',
    'max-lines': 'Taille de fichier',
    complexity: 'Complexité',
    'max-params': 'Paramètres',
    pattern: 'Motif',
    command: 'Commande',
    ai: 'Audit IA',
  },
  params: {
    maxLines: (n: number) => `${n} lignes max.`,
    complexity: (n: number) => `complexité ${n} max.`,
    maxParams: (n: number) => `${n} paramètres max.`,
    budget: (usd: string) => `plafond ${usd}`,
  },
}
