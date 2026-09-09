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
