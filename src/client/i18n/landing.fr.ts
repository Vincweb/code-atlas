import type { landingEn } from './landing.en'

export const landingFr: typeof landingEn = {
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
      text: 'Lint, types, tests : vos scripts deviennent des règles. Les audits IA lisent le code avec Claude Code, en lecture seule.',
    },
    {
      title: 'Un score, un garde-fou',
      text: 'Un score par famille, une référence que vous commitez, et une vérification CI qui n’échoue que si ça empire.',
    },
  ],
  stepsTitle: 'Trois étapes pour démarrer',
  steps: [
    { title: 'Lancez', command: 'npx @vincweb/code-atlas', text: 'dans le dossier du projet.' },
    {
      title: 'Décrivez vos couches',
      command: 'code-atlas.json',
      text: 'ou partez du brouillon généré depuis votre graphe.',
    },
    {
      title: 'Verrouillez',
      command: 'npx @vincweb/code-atlas --check',
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
  openText: 'Reprenez là où vous en étiez, ou parcourez vos dossiers jusqu’à un projet TypeScript.',
  mcp: {
    title: 'Donnez la carte à Claude Code',
    text: 'code-atlas est aussi un serveur MCP : Claude Code lit le graphe, les violations et les scores du projet pendant qu’il travaille, et vérifie que rien n’a régressé avant de s’arrêter. Une commande, depuis le dossier du projet :',
    note: 'Elle écrit .mcp.json à la racine du projet — commitez-le, et chaque session Claude Code sur le projet reçoit les outils. Aucune dépendance, aucune clé : le serveur tourne sur votre machine.',
    tools: [
      ['overview', 'les scores, chaque règle avec son compte, l’historique récent'],
      ['violations', 'chacune à fichier:ligne, par règle ou par fichier'],
      ['edges', 'les dépendances entre features, les rouges d’abord'],
      ['feature', 'une feature : sa couche, ses fichiers, son couplage'],
      ['check', 'le cliquet contre la référence, comme --check'],
      ['config', 'le format de code-atlas.json, avant de l’éditer'],
    ] as [string, string][],
  },
}
