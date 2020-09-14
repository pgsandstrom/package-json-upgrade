import { CacheItem, NpmData, VersionData } from './npm'
import { Dict, Loader } from './types'
import { objectEntries } from './util/util'

// removes all data that we dont use
export const trimNpmCache = (
  cache: Dict<string, Loader<CacheItem>>,
): Dict<string, Loader<CacheItem>> => {
  //
  return objectEntries(cache).reduce<Dict<string, Loader<CacheItem>>>(
    (partialCache, [key, value]) => {
      return {
        ...partialCache,
        [key]: {
          asyncstate: value.asyncstate,
          item: value.item ? trimCacheItem(value.item) : undefined,
        },
      }
    },
    {},
  )
}

const trimCacheItem = (cacheItem: CacheItem): CacheItem => {
  return {
    date: cacheItem.date,
    npmData: trimNpmData(cacheItem.npmData),
  }
}

export const trimNpmData = (npmData: NpmData): NpmData => {
  return {
    'dist-tags': npmData['dist-tags'],
    versions: objectEntries(npmData.versions).reduce(
      (partialNpmData, [key, value]) => ({ ...partialNpmData, [key]: trimNpmVersion(value) }),
      {},
    ),
    homepage: npmData.homepage,
  }
}

export const trimNpmVersion = (versionData: VersionData): VersionData => {
  return {
    name: versionData.name,
    version: versionData.version,
  }
}
