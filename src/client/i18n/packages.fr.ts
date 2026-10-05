import type { packagesEn } from './packages.en'

export const packagesFr: typeof packagesEn = {
  scope: 'Package',
  whole: (n: number) => `Tout le dépôt · ${n} packages`,
  title: 'Packages',
  intro:
    'Chaque package est noté sur ses propres violations, comme s’il était analysé seul. Le score du dépôt est leur moyenne pondérée par les lignes : un gros monorepo n’est pas pénalisé pour sa seule taille.',
  head: { name: 'Package', files: 'Fichiers', lines: 'Lignes', score: 'Score' },
  search: 'Chercher un package…',
  noMatch: 'Aucun package ne correspond.',
  open: 'Ouvrir ce package',
  back: '← Tout le dépôt',
  breakdown: 'Par package',
  elsewhere: (n: number) =>
    `${n} ${n === 1 ? 'violation n’appartient' : 'violations n’appartiennent'} à aucun package en particulier`,
  score: (name: string) => `Score de ${name}`,
  weighted: (n: number) => `Moyenne de ${n} packages, pondérée par leurs lignes.`,
}
