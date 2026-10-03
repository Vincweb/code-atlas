export type EngineErrorKind =
  'typescript-missing' | 'typescript-no-api' | 'tsconfig-missing' | 'tsconfig-invalid'

export class EngineError extends Error {
  kind: EngineErrorKind

  constructor(kind: EngineErrorKind, message: string) {
    super(message)
    this.name = 'EngineError'
    this.kind = kind
  }
}
