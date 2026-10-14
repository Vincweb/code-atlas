import { plural } from './plural'
import type { DraftFacts, docsEn } from './docs.en'

const list = (items: string[]) => (items.length ? items.join(', ') : 'aucun')

export const docsFr: typeof docsEn = {
  intro:
    'À quoi sert chaque feature, dans ses propres mots : le README.md, AGENTS.md ou CLAUDE.md de son dossier, ou le fichier que nomme « docs » dans la config. La doc vit à côté du code, elle se déplace et disparaît avec lui — et les agents qui travaillent dans ce dossier lisent le même fichier.',
  packagesIntro:
    'Une entrée par package : sa propre doc. Ouvrez un package pour voir les docs de ses features.',
  tiles: {
    features: 'Features',
    packages: 'Packages',
    documented: 'Documentées',
    coverage: 'Couverture',
  },
  lookedFor: 'Cherchée, dans l’ordre',
  configure: 'Le changer dans la config',
  search: 'Trouver une feature…',
  filters: { all: 'Toutes', missing: 'Sans doc' },
  noMatch: 'Aucune feature ne correspond.',
  noFeatures: 'Aucune feature trouvée.',
  read: 'Lire la doc',
  write: 'Écrire sa doc',
  noDoc: 'pas de doc',
  files: (n: number) => plural(n, 'fichier', 'fichiers'),
  lines: (n: string) => `${n} lignes`,
  usedBy: (n: number) => `utilisée par ${n}`,
  dependsOn: (n: number) => `dépend de ${n}`,
  status: 'statut',
  owner: 'responsable',
  openFile: 'Ouvrir le fichier',
  openPackage: 'Ouvrir ce package',
  loadFailed: 'La doc n’a pas pu être lue.',
  image: (alt: string) => (alt ? `image : ${alt}` : 'image'),
  empty: {
    title: 'Pas encore de doc',
    lookedFor: 'code-atlas a cherché ces fichiers, dans cet ordre, sans en trouver :',
    frontMatter:
      'Commencez-la par un front matter : sa description devient la définition en une ligne de la feature, ici, dans le graphe et pour les agents.',
    claude: 'Ou laissez Claude Code l’écrire à partir du code :',
  },
  frontMatterExample: `---
description: Une phrase sur ce à quoi sert cette feature.
owner: équipe-ou-personne
status: stable
---
`,
  draftPrompt: (facts: DraftFacts) =>
    [
      `Écris la doc de la feature ${facts.id} de ce projet, dans ${facts.path}.`,
      '',
      'Ouvre-la par ce front matter :',
      '---',
      'description: une phrase sur ce à quoi sert la feature',
      'owner: l’équipe ou la personne responsable, si le code le dit ; sinon omets la ligne',
      'status: stable, experimental ou deprecated',
      '---',
      '',
      'Puis, en une page au plus : ce que fait la feature et pour qui, ses points d’entrée (les fichiers que les autres features importent), ce dont elle dépend et pourquoi, et les règles qu’un changement doit respecter. Lis d’abord le code et décris ce qui existe, pas ce qui devrait exister.',
      '',
      'Ce que code-atlas en sait :',
      `- couche : ${facts.layer ?? 'aucune'}`,
      `- fichiers (${facts.files.length}) : ${list(facts.files)}`,
      `- dépend de : ${list(facts.dependsOn)}`,
      `- utilisée par : ${list(facts.usedBy)}`,
    ].join('\n'),
  ruleTitle: 'Features sans doc',
  missing: (n: number) => plural(n, 'feature sans doc', 'features sans doc'),
}
