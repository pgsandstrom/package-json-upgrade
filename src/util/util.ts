import { Dict } from '../types'

export const objectKeys = <T>(obj: T): Array<keyof T> => {
  const entries = Object.keys(obj)
  return entries as Array<keyof T>
}

export function objectEntries<K extends string | number | symbol, V>(
  obj: Dict<K, V>,
): Array<[K, V]> {
  const entries = Object.entries(obj)
  return entries as Array<[K, V]>
}

export const replaceLastOccuranceOf = (s: string, replace: string, replaceWith: string) => {
  const indexOfReplace = s.lastIndexOf(replace)
  if (indexOfReplace !== -1) {
    return s.substr(0, indexOfReplace) + replaceWith + s.substr(indexOfReplace + replace.length)
  } else {
    return s
  }
}
