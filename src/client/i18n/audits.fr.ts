import type { auditsEn } from './audits.en'

const example = {
  id: 'AI-ERRORS',
  family: 'ai',
  severity: 'medium',
  kind: 'ai',
  title: 'Gestion des erreurs',
  prompt:
    'Relis la gestion des erreurs : catch vides, erreurs avalées, messages sans contexte. Ne signale pas les catch laissés vides volontairement autour d’un stockage optionnel.',
  files: 'src/**/*.{ts,tsx}',
  budgetUsd: 0.5,
}

export const auditsFr: typeof auditsEn = {
  summary: (n: number, ran: number) =>
    `${n} ${n === 1 ? 'audit' : 'audits'} · ${ran} ${ran === 1 ? 'lancé' : 'lancés'}`,
  familyScore: 'Score Audits IA',
  spent: (usd: string) => `${usd} au total (estimation au tarif API)`,
  runAll: 'Lancer tous les audits',
  confirm: {
    titleOne: 'Lancer cet audit IA ?',
    titleAll: (n: number) => `Lancer ${n} audits IA ?`,
    budget: 'Coût maximum',
    budgetAll: 'Coût maximum, au total',
    model: (model: string) => `modèle ${model}`,
    text: 'Il passe par votre connexion Claude Code : votre abonnement, ou ANTHROPIC_API_KEY si vous êtes facturé à l’usage. Claude s’arrête une fois le budget atteint.',
    textAll:
      'Ils passent l’un après l’autre par votre connexion Claude Code, et chacun s’arrête à son propre budget. Vous pouvez annuler à tout moment.',
    readOnly: (tools: string) =>
      `Lecture seule : Claude n’utilise que ${tools} et ne modifie aucun fichier.`,
    action: 'Lancer l’audit',
    actionAll: (n: number) => `Lancer les ${n} audits`,
  },
  connection: {
    title: 'Connexion',
    checking: 'Recherche de Claude Code…',
    found: (version: string) => `Claude Code ${version} détecté`,
    missing: 'Claude Code introuvable',
    text: 'Les audits passent par votre Claude Code : votre abonnement, ou ANTHROPIC_API_KEY si vous êtes facturé à l’usage. Aucune clé à configurer ici.',
    missingText:
      'Installez Claude Code et connectez-vous (lancez claude puis /login), puis rechargez la page.',
    check: 'Pour vérifier dans un terminal :',
  },
  howTitle: 'Comment fonctionne un audit IA',
  findingsTitle: 'Constats',
  noFindings: 'Aucun constat : Claude n’a rien trouvé à signaler.',
  progressFiles: (n: number) => `${n} ${n === 1 ? 'fichier lu' : 'fichiers lus'}`,
  progressSearches: (n: number) => `${n} ${n === 1 ? 'recherche' : 'recherches'}`,
  ideasTitle: 'Idées d’audits',
  ideasText:
    'Des audits prêts à l’emploi. Ajoutez-les avec Claude Code, ou copiez la règle dans code-atlas.json.',
  inConfig: 'déjà dans la config',
  copyRule: 'Copier la règle',
  ruleCopied: 'Règle copiée',
  addPrompt: (p: { root: string; target: string; rule: string; describe: string }) =>
    [
      `Dans le projet ${p.root}, ajoute cette règle d’audit IA au tableau « rules » de ${p.target}, sans rien changer d’autre :`,
      p.rule,
      `Si le fichier n’a pas de tableau « rules », lance d’abord ${p.describe} : sans tableau, les règles par défaut s’appliquent, garde-les en plus de celle-ci.`,
      'Relance ensuite la commande pour vérifier que la config reste valide.',
    ].join('\n'),
  ideas: [
    {
      id: 'AI-ERRORS',
      title: 'Gestion des erreurs',
      text: 'Catch vides, erreurs avalées, messages sans contexte.',
      severity: 'medium',
      prompt:
        'Relis la gestion des erreurs : catch vides ou qui avalent l’erreur, promesses non attendues, messages d’erreur sans contexte, erreurs transformées en succès. Ignore les catch laissés vides volontairement et commentés.',
    },
    {
      id: 'AI-NAMING',
      title: 'Nommage',
      text: 'Noms trompeurs, vagues ou abrégés.',
      severity: 'low',
      prompt:
        'Repère les noms trompeurs ou vagues : fonctions dont le nom ne dit pas ce qu’elles font, booléens sans préfixe is/has/can, abréviations obscures, noms génériques (data, info, utils, helper). Propose un meilleur nom dans chaque constat.',
    },
    {
      id: 'AI-SECURITY',
      title: 'Sécurité',
      text: 'Secrets en dur, injections, vérifications désactivées.',
      severity: 'high',
      prompt:
        'Cherche les failles évidentes : secrets ou clés écrits en dur, entrées utilisateur injectées dans du HTML, du SQL ou une commande shell, vérifications TLS ou d’authentification désactivées, données sensibles dans les logs.',
    },
    {
      id: 'AI-RESPONSIBILITY',
      title: 'Responsabilités',
      text: 'Fichiers et fonctions qui font trop de choses.',
      severity: 'medium',
      prompt:
        'Repère les fichiers et composants qui mélangent plusieurs responsabilités (interface, accès réseau, logique métier), et les fonctions de plus de 50 lignes qui font plusieurs choses. Indique comment découper.',
    },
    {
      id: 'AI-DEAD',
      title: 'Code mort et doublons',
      text: 'Code jamais utilisé, blocs copiés-collés.',
      severity: 'low',
      prompt:
        'Repère le code mort (fonctions jamais appelées, branches impossibles, paramètres ignorés) et les blocs dupliqués de plus de 10 lignes qui devraient être factorisés.',
    },
    {
      id: 'AI-CONVENTIONS',
      title: 'Conventions du projet',
      text: 'Le code face au CLAUDE.md et à la doc du projet.',
      severity: 'medium',
      prompt:
        'Lis le CLAUDE.md et la documentation du projet, puis signale le code qui ne respecte pas les conventions écrites. Cite la convention concernée dans chaque constat.',
    },
    {
      id: 'AI-TESTS',
      title: 'Tests manquants',
      text: 'Logique métier sans test, tests qui ne vérifient rien.',
      severity: 'medium',
      prompt:
        'Repère la logique métier non triviale (calculs, parsing, règles de gestion) qui n’a aucun test, et les tests qui ne vérifient rien. Indique le cas à tester dans chaque constat.',
    },
    {
      id: 'AI-A11Y',
      title: 'Accessibilité',
      text: 'Images sans alternative, boutons sans nom, focus perdu.',
      severity: 'medium',
      prompt:
        'Dans les composants d’interface, repère les problèmes d’accessibilité : images sans texte alternatif, boutons sans nom accessible, éléments cliquables non focusables, formulaires sans label, contenu qui ne dépend que de la couleur.',
    },
  ],
  intro:
    'Un audit IA est une règle que Claude vérifie en lisant votre code, là où un script ne sait pas juger : un nom trompeur, une fonction qui fait trois choses, une feature qui fouille dans les entrailles d’une autre. Vous écrivez la consigne ; code-atlas lance Claude, récupère ses constats et les note comme n’importe quelle règle.',
  points: [
    [
      'Relu par Claude',
      'Claude Code explore le projet en lecture seule, comme un relecteur humain.',
    ],
    ['Des constats précis', 'Chaque problème revient avec un fichier, une ligne et un message.'],
    [
      'Noté, jamais bloquant',
      'Les constats comptent dans la famille « Audits IA », mais --check les ignore : deux passages peuvent différer.',
    ],
  ],
  pipelineTitle: 'Comment se déroule un audit',
  pipeline: [
    [
      'Le prompt',
      'code-atlas assemble la consigne de la règle et un cadre commun : périmètre, rigueur, format, langue.',
    ],
    [
      'Claude Code, en lecture seule',
      'Lancé sans interface dans le dossier du projet, avec trois outils seulement : Read, Grep, Glob. Il ne peut rien modifier.',
    ],
    [
      'Une réponse structurée',
      'Claude doit répondre dans le format JSON imposé : une liste de constats { fichier, ligne, message }.',
    ],
    [
      'Score et historique',
      'Le résultat est gardé par commit et devient « périmé » quand le code change. Il pèse dans le score Audits IA.',
    ],
  ],
  inputsTitle: 'Ce que Claude reçoit',
  inputs: [
    [
      'Le prompt système',
      'Celui de Claude Code, inchangé. Il charge aussi le CLAUDE.md du projet s’il existe : l’audit connaît alors vos conventions.',
    ],
    [
      'Le prompt de l’audit',
      'La consigne écrite dans la règle, suivie du cadre ajouté par code-atlas. Le texte exact figure sur chaque audit plus bas.',
    ],
    [
      'Le format de réponse',
      'Un schéma JSON imposé avec --json-schema : Claude ne peut rendre qu’une liste de constats.',
    ],
    [
      'Les outils et les limites',
      'Read, Grep et Glob uniquement ; aucun serveur MCP, aucune commande slash, aucune session sauvegardée ; un plafond de dépense par audit.',
    ],
  ],
  frame: 'Le cadre que code-atlas ajoute à chaque prompt',
  showSchema: 'Voir le schéma',
  hideSchema: 'Masquer le schéma',
  listTitle: 'Les audits de ce projet',
  listText:
    'Chaque audit est une règle « ai » de code-atlas.json. Lancez-le ici ou depuis l’onglet Règles.',
  none: 'Aucun audit IA dans la config.',
  rulePrompt: 'La consigne de la règle',
  showFull: 'Voir le prompt complet',
  hideFull: 'Masquer le prompt complet',
  showCommand: 'Voir la commande',
  hideCommand: 'Masquer la commande',
  run: 'Lancer l’audit',
  results: 'Voir les constats',
  lastRun: (when: string) => `Dernier passage ${when}`,
  neverRun: 'Jamais lancé',
  model: 'Modèle',
  cap: 'Plafond',
  settingsTitle: 'Réglages',
  settingsText:
    'Les valeurs par défaut de tous les audits, dans la clé « ai » de code-atlas.json. Chaque règle peut fixer son propre modèle et son propre plafond.',
  costTitle: 'Coût et sécurité',
  cost: [
    'Un audit utilise votre propre connexion Claude Code : code-atlas ne gère aucune clé.',
    'Le plafond est vérifié entre deux étapes de Claude : un audit peut finir un peu au-dessus.',
    'Rien ne part tout seul : un audit se lance sur un clic, après confirmation de son budget.',
  ],
  createTitle: 'Écrire votre propre audit',
  createText:
    'Ajoutez une règle « "kind": "ai" » à code-atlas.json. Le prompt dit à Claude quoi chercher ; code-atlas fournit le reste.',
  example: JSON.stringify(example, null, 2),
  createPrompt: (root: string, describe: string) =>
    [
      `Dans le projet ${root}, ajoute à code-atlas.json une règle d’audit IA (« kind »: « ai », famille « ai ») qui vérifie <ce que tu veux>.`,
      `Lance d’abord ${describe} : elle donne le format des règles (dont « ai ») et l’état actuel du projet.`,
      'Écris un prompt précis : ce qu’il faut chercher, ce qui ne compte pas comme un problème, et comment formuler un constat.',
      'Garde le JSON valide.',
    ].join('\n'),
}
