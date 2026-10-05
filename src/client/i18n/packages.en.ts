/** The words of a monorepo's packages: the picker, the table, the scores. */
export const packagesEn = {
  scope: 'Package',
  whole: (n: number) => `Whole repository · ${n} packages`,
  title: 'Packages',
  intro:
    'Each package is scored on its own violations, as if analyzed alone. The repository’s score is their average weighted by lines: a large monorepo is not marked down for its size alone.',
  head: { name: 'Package', files: 'Files', lines: 'Lines', score: 'Score' },
  search: 'Find a package…',
  noMatch: 'No package matches.',
  open: 'Open this package',
  back: '← Whole repository',
  breakdown: 'By package',
  elsewhere: (n: number) =>
    `${n} ${n === 1 ? 'violation belongs' : 'violations belong'} to no single package`,
  score: (name: string) => `Score of ${name}`,
  weighted: (n: number) => `Average of ${n} packages, weighted by their lines.`,
}
