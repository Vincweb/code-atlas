/** What went wrong, from whatever was thrown: an Error's message, anything else as text. */
export const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error)
