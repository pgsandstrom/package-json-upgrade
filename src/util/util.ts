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
