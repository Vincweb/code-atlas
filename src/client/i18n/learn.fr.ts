import type { learnEn } from './learn.en'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export const learnFr: typeof learnEn = {
  bands: { good: 'Bon', warn: 'À surveiller', bad: 'À traiter', none: 'Incomplet' },
  verdict: {
    good: 'Le code est en bonne forme.',
    warn: 'Le code tient, mais certains points se dégradent.',
    bad: 'Le code demande de l’attention.',
    none: 'Aucune règle n’a encore de résultat.',
  },
  strongest: (family: string, score: number) => `Point fort : ${family} (${score}).`,
  weakest: (family: string, score: number) => `Point faible : ${family} (${score}).`,
  tally: (failing: number, total: number, pending: number) =>
    `${plural(failing, 'règle en échec', 'règles en échec')} sur ${total}${
      pending ? `, ${plural(pending, 'pas encore lancée', 'pas encore lancées')}` : ''
    }.`,
  sinceBaseline: (diff: number) =>
    diff === 0
      ? 'Identique à la référence.'
      : `${diff > 0 ? '+' : ''}${diff} points depuis la référence.`,

  howTitle: 'Comment ce score est-il calculé ?',
  how: [
    'Chaque règle part de 100 et perd la moitié de sa note à chaque palier de problèmes : 1 pour une règle critique, 3 pour une haute, 6 pour une moyenne, 12 pour une basse. Une note n’atteint jamais zéro : chaque correction se voit.',
    'Une famille est la moyenne de ses règles, pondérée par leur sévérité (critique ×8, haute ×4, moyenne ×2, basse ×1). Une règle pas encore lancée ne compte pas.',
    'Le score global est la moyenne des familles qui ont un résultat.',
  ],
  tableHead: ['Sévérité', 'Note divisée par deux tous les', 'Poids dans sa famille'] as [
    string,
    string,
    string,
  ],
  problems: (n: number) => plural(n, 'problème', 'problèmes'),
  scale: '80 et plus : bon · de 50 à 79 : à surveiller · moins de 50 : à traiter.',

  familiesTitle: 'Les familles',
  familyText: {
    architecture:
      'Le respect de vos couches : ce qui remonte, ce qui fait l’aller-retour, les cycles.',
    'clean-code':
      'La lisibilité du code : taille des fichiers, complexité et signature des fonctions, motifs proscrits.',
    tooling: 'Les commandes de votre projet — lint, types, tests — lancées comme des règles.',
    ai: 'Des relectures par Claude, à la demande, de ce qu’une règle ne sait pas mesurer.',
  },
  familyIdle: {
    tooling: 'Pas encore lancées : les commandes se lancent depuis l’onglet Règles.',
    ai: 'Pas encore lancés : chaque audit coûte un peu, il se lance à la demande.',
    other: 'Pas encore de résultat.',
  },
  seeRules: 'Voir les règles',

  prioritiesTitle: 'Par où commencer',
  prioritiesText:
    'Les règles en échec qui pèsent le plus sur le score, de la plus rentable à corriger à la moins rentable.',
  noPriorities: 'Aucune règle en échec : rien d’urgent.',
  gain: (points: number) => `jusqu’à +${points} sur sa famille`,
  what: 'Ce que ça veut dire',
  why: 'Pourquoi c’est important',
  fix: 'Comment corriger',
  seeCases: (n: number) => (n === 1 ? 'Voir le cas' : `Voir les ${n} cas`),
  seeGraph: 'Voir dans le graphe',
  kinds: {
    layers: {
      what: 'Un import qui va d’une couche basse vers une couche plus haute.',
      why: 'Le bas de la pile ne devrait rien savoir du haut : sinon, changer un écran casse le socle.',
      fix: 'Descendre le code partagé, ou inverser la dépendance (callback, injection, événement).',
    },
    mutual: {
      what: 'Deux features de la même couche qui s’importent l’une l’autre.',
      why: 'Elles ne peuvent plus évoluer, se tester ni se déplacer séparément.',
      fix: 'Extraire leur partie commune dans une troisième feature, ou ne garder qu’un sens.',
    },
    siblings: {
      what: 'Une feature qui en importe une autre de sa couche, là où elles devraient rester indépendantes.',
      why: 'Chaque lien entre features sœurs rend la suivante plus difficile à isoler.',
      fix: 'Passer par une couche plus basse (UI partagée, état) plutôt que d’aller chercher chez la voisine.',
    },
    'no-cycle': {
      what: 'Une boucle d’imports entre fichiers : A importe B, qui finit par importer A.',
      why: 'L’ordre de chargement devient fragile et le code impossible à découper.',
      fix: 'Sortir le morceau commun dans un fichier que les deux importent.',
    },
    'forbid-import': {
      what: 'Un import que votre config interdit explicitement.',
      why: 'C’est une frontière que vous avez décidé de protéger.',
      fix: 'La franchir par l’interface prévue pour ça.',
    },
    'max-lines': {
      what: 'Un fichier plus long que la limite.',
      why: 'Un long fichier mélange souvent plusieurs responsabilités et se relit mal.',
      fix: 'Le découper par responsabilité : un composant, un hook ou un utilitaire par fichier.',
    },
    complexity: {
      what: 'Une fonction avec trop de chemins possibles (if, boucles, ?:, &&…).',
      why: 'Chaque chemin est un cas à comprendre et à tester ; au-delà de 15, les bugs s’y cachent.',
      fix: 'Extraire des sous-fonctions, sortir tôt, remplacer des conditions par une table.',
    },
    'max-params': {
      what: 'Une fonction qui prend trop de paramètres.',
      why: 'L’appel devient illisible et l’ordre des arguments une source d’erreurs.',
      fix: 'Regrouper les paramètres dans un objet nommé.',
    },
    pattern: {
      what: 'Un motif de code que vous avez choisi d’interdire (any, par exemple).',
      why: 'Il contourne une garantie, souvent celle du typage.',
      fix: 'Remplacer chaque occurrence par la forme sûre.',
    },
    command: {
      what: 'Une commande de votre projet a échoué.',
      why: 'Un lint, un typage ou un test rouge, c’est un problème que vos outils ont déjà trouvé.',
      fix: 'Ouvrir la sortie de la commande dans l’onglet Règles et corriger les erreurs listées.',
    },
    ai: {
      what: 'Un problème relevé par Claude en relisant le code.',
      why: 'Il couvre ce qu’une règle automatique ne sait pas mesurer : nommage, responsabilités, intentions.',
      fix: 'Lire chaque constat : ce sont des pistes à juger, pas des verdicts.',
    },
  },

  stepsTitle: 'Prochaines étapes',
  stepsDone: (done: number, total: number) => `${done} sur ${total} faites`,
  steps: {
    layers: {
      title: 'Décrire vos couches',
      done: 'Vos couches sont décrites.',
      todo: 'Sans couches, code-atlas ne sait pas ce qui est en haut ou en bas. Partez du brouillon généré.',
      action: 'Ouvrir la config',
    },
    commands: {
      title: 'Lancer vos commandes',
      done: 'Vos commandes ont tourné.',
      todo: 'Lint, types, tests : lancez-les une fois pour compléter la famille Outillage.',
      action: 'Aller aux règles',
    },
    ai: {
      title: 'Essayer un audit IA',
      done: 'Un audit IA a déjà tourné.',
      todo: 'Claude relit le code sous un angle précis, avec un budget plafonné.',
      action: 'Aller aux règles',
    },
    baseline: {
      title: 'Enregistrer une référence',
      done: 'Une référence existe : les écarts se mesurent depuis elle.',
      todo: 'Figez l’état actuel ; ensuite, seule une dégradation fera échouer la CI.',
    },
    ci: {
      title: 'Brancher la CI',
      text: 'Ajoutez cette commande à votre pipeline : elle échoue dès qu’une règle a plus de violations que la référence.',
    },
  },

  figuresTitle: 'Le projet en chiffres',
  figures: {
    files: 'fichiers source analysés',
    lines: 'lignes, commentaires compris',
    imports: 'liens entre fichiers à l’exécution',
    typeImports: 'imports de types, qui ne couplent rien une fois compilés',
    features: 'features, d’après votre config',
    functions: 'fonctions mesurées',
    cycles: 'boucles d’imports entre fichiers',
  },

  glossaryTitle: 'Lexique',
  glossary: [
    [
      'Feature',
      'Un dossier qui regroupe une fonctionnalité, défini par les motifs « features » de la config.',
    ],
    [
      'Couche',
      'Un niveau de l’architecture. Une feature ne devrait dépendre que des couches sous elle.',
    ],
    ['Dépendance remontante', 'Un import qui va du bas de la pile vers le haut.'],
    ['Aller-retour', 'Deux features qui s’importent mutuellement.'],
    [
      'Features sœurs',
      'Les features d’une même couche marquée « siblings », qui devraient rester indépendantes.',
    ],
    [
      'Instabilité',
      'La part des dépendances sortantes : proche de 0, un socle dont tout dépend ; proche de 1, une feature qui dépend de tout.',
    ],
    ['Complexité', 'Le nombre de chemins d’exécution d’une fonction.'],
    ['Référence', 'Un instantané des violations, commité, auquel --check se compare.'],
  ],
}
