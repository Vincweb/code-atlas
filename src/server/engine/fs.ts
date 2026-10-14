import fs from 'node:fs'

/** A folder's entries, or none when it cannot be read. */
export const entriesOf = (dir: string) => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
}

/** Whether a path is a folder; false when it is missing or cannot be read. */
export const isDirectory = (dir: string) => {
  try {
    return fs.statSync(dir).isDirectory()
  } catch {
    return false
  }
}
