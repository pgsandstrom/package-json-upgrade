import * as vscode from 'vscode'

/**
 * True if the document is the named file, whatever directory it lives in.
 *
 * `document.fileName` is the platform path, so it is backslash separated on
 * Windows and slash separated everywhere else. Rather than checking for each
 * separator in turn we just take the last segment, which is correct on every
 * platform - Windows accepts both separators, the others only ever produce
 * slashes.
 */
export const endsWithFileName = (document: vscode.TextDocument, fileName: string): boolean => {
  const segments = document.fileName.split(/[\\/]/)
  return segments[segments.length - 1] === fileName
}

/**
 * Object.keys but keeps type safety
 */
export function objectKeys<T extends object>(obj: T): Array<keyof T> {
  const entries = Object.keys(obj)
  return entries as Array<keyof T>
}

/**
 * Object.entries but keeps type safety
 */
export function objectEntries<K extends string | number | symbol, V>(
  obj: Record<K, V>,
): Array<[K, V]> {
  const entries = Object.entries(obj)
  return entries as Array<[K, V]>
}

/**
 * True for plain objects/maps.
 */
export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Splits a dot separated config path such as `pnpm.overrides` into its segments.
 * Blank segments are dropped, so a stray dot or trailing whitespace in the user's
 * settings does not turn into a lookup for the empty key.
 */
export const toPath = (path: string): string[] => {
  return path
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
}

/**
 * Walks a parsed document along the given path, as produced by {@link toPath}.
 * Returns undefined as soon as the path leaves the object graph.
 */
export const getValueAtPath = (value: Record<string, unknown>, path: string[]): unknown => {
  let current: unknown = value
  for (const segment of path) {
    if (!isRecord(current)) {
      return undefined
    }
    current = current[segment]
  }
  return current
}

export const replaceLastOccuranceOf = (s: string, replace: string, replaceWith: string) => {
  const indexOfReplace = s.lastIndexOf(replace)
  if (indexOfReplace !== -1) {
    return (
      s.substring(0, indexOfReplace) + replaceWith + s.substring(indexOfReplace + replace.length)
    )
  } else {
    return s
  }
}
