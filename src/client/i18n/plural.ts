/** "1 file", "3 files": the count and the noun that agrees with it. */
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
