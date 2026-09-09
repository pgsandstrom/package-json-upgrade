import * as npmRegistryFetch from 'npm-registry-fetch'
import {
  coerce,
  diff,
  eq,
  gt,
  lte,
  ReleaseType,
  satisfies,
  SemVer,
  valid,
  validRange,
} from 'semver'

import { retrieveAndCacheChangelog } from './changelog'
import { getConfig } from './config'
import { logError } from './log'
import { getNpmConfig } from './npmConfig'
import { AsyncState, Dict } from './types'

export interface NpmLoader<T> {
  asyncstate: AsyncState
  startTime: number
  promise?: Promise<unknown>
  item?: T
  // Only set when asyncstate is Rejected. Describes why the registry fetch failed.
  error?: FetchError
}

export enum FetchErrorType {
  NotFound = 'NOT_FOUND',
  Unauthorized = 'UNAUTHORIZED',
  RateLimited = 'RATE_LIMITED',
  ServerError = 'SERVER_ERROR',
  Timeout = 'TIMEOUT',
  Network = 'NETWORK',
  Unknown = 'UNKNOWN',
}

export interface FetchError {
  type: FetchErrorType
  // Short, user-facing text shown inline as a decoration.
  message: string
}

export interface NpmData {
  'dist-tags': {
    latest: string
    next?: string // not used currently
  }
  // "versions" is undefined only in weird edge cases, not completely sure when. Maybe when packages has been removed from the registry?
  versions?: {
    [key in string]: VersionData
  }
  homepage?: string
  repository?:
    | {
        type?: string
        url?: string
        directory?: string
      }
    | string
  // ISO-8601 publish timestamps keyed by version (plus 'created' / 'modified' entries).
  time?: {
    [key in string]: string
  }
}

export interface VersionData {
  name: string
  version: string
}

export interface DependencyUpdateInfo {
  major?: VersionData
  minor?: VersionData
  patch?: VersionData
  prerelease?: VersionData
  // Per-bucket "true latest" — only set when higher than the eligible upgrade, i.e. held back by minimumReleaseAge.
  majorLatest?: VersionData
  minorLatest?: VersionData
  patchLatest?: VersionData
  prereleaseLatest?: VersionData
  validVersion: boolean // if the current version is valid semver
  existingVersion: boolean // if the current version exists
}

export interface CacheItem {
  date: Date
  npmData: NpmData
}

let npmCache: Dict<string, NpmLoader<CacheItem>> = {}

export const cleanNpmCache = () => {
  npmCache = {}
}

export const getAllCachedNpmData = () => {
  return npmCache
}

export const getCachedNpmData = (dependencyName: string) => {
  return npmCache[dependencyName]
}

export const setCachedNpmData = (newNpmCache: Dict<string, NpmLoader<CacheItem>>) => {
  npmCache = newNpmCache
}

export interface ReleaseAgeFilter {
  minimumReleaseAgeMinutes: number
  excludedPackages: string[]
  now?: number // override for tests; defaults to Date.now()
}

export const getLatestVersion = (
  npmData: NpmData,
  rawCurrentVersion: string,
  dependencyName: string,
): VersionData | undefined => {
  const config = getConfig()
  const ignoredVersions = config.ignoreVersions[dependencyName]
  return getLatestVersionWithIgnoredVersions(
    npmData,
    rawCurrentVersion,
    dependencyName,
    ignoredVersions,
    {
      minimumReleaseAgeMinutes: config.minimumReleaseAge,
      excludedPackages: config.minimumReleaseAgeExclude,
    },
  )
}

export const getLatestVersionWithIgnoredVersions = (
  npmData: NpmData,
  rawCurrentVersion: string,
  dependencyName: string,
  ignoredVersions: string | undefined | string[],
  ageFilter?: ReleaseAgeFilter,
): VersionData | undefined => {
  const possibleUpgrades = getPossibleUpgradesWithIgnoredVersions(
    npmData,
    rawCurrentVersion,
    dependencyName,
    ignoredVersions,
    ageFilter,
  )
  return (
    possibleUpgrades.major ??
    possibleUpgrades.minor ??
    possibleUpgrades.patch ??
    possibleUpgrades.prerelease
  )
}

export const getExactVersion = (rawVersion: string) => {
  return rawVersion.startsWith('~') || rawVersion.startsWith('^')
    ? rawVersion.substring(1)
    : rawVersion
}

export const isVersionPrerelease = (rawVersion: string) => {
  const version = getExactVersion(rawVersion)
  // regex gotten from https://github.com/semver/semver/blob/master/semver.md
  const result: RegExpExecArray | null =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/.exec(
      version,
    )
  if (result === null) {
    return false
  }
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return result[4] != null
}

export const getPossibleUpgrades = (
  npmData: NpmData,
  rawCurrentVersion: string,
  dependencyName: string,
): DependencyUpdateInfo => {
  const config = getConfig()
  const ignoredVersions = config.ignoreVersions[dependencyName]
  return getPossibleUpgradesWithIgnoredVersions(
    npmData,
    rawCurrentVersion,
    dependencyName,
    ignoredVersions,
    {
      minimumReleaseAgeMinutes: config.minimumReleaseAge,
      excludedPackages: config.minimumReleaseAgeExclude,
    },
  )
}

export const getPossibleUpgradesWithIgnoredVersions = (
  npmData: NpmData,
  rawCurrentVersion: string,
  dependencyName: string,
  ignoredVersions: string | undefined | string[],
  ageFilter?: ReleaseAgeFilter,
): DependencyUpdateInfo => {
  if (rawCurrentVersion === '*' || rawCurrentVersion === 'x') {
    return { validVersion: true, existingVersion: true }
  }

  if (!npmData.versions) {
    return { validVersion: true, existingVersion: true }
  }

  const exactVersion = getExactVersion(rawCurrentVersion)

  const currentVersionIsPrerelease = isVersionPrerelease(exactVersion)

  const coercedVersion = currentVersionIsPrerelease ? exactVersion : coerce(exactVersion)
  if (coercedVersion === null) {
    return { validVersion: false, existingVersion: false }
  }

  // A range such as "~5.0.0" or "^5.0.0" is "found" as long as some published
  // version satisfies it, even if the exact base version (e.g. 5.0.0) was never
  // published. Fall back to exact equality when the raw version isn't a valid range.
  const isRange = validRange(rawCurrentVersion) !== null
  const existingVersion = Object.values(npmData.versions).some((version) => {
    if (isRange) {
      return satisfies(version.version, rawCurrentVersion)
    } else {
      return eq(version.version, coercedVersion)
    }
  })

  const possibleUpgrades = getRawPossibleUpgradeList(
    npmData,
    dependencyName,
    ignoredVersions,
    coercedVersion,
  )

  const eligibleUpgrades = filterByReleaseAge(possibleUpgrades, npmData, dependencyName, ageFilter)

  const pickHighest = (source: VersionData[], releaseTypeList: ReleaseType[]) => {
    const matchingUpgradeTypes = source.filter((version) => {
      const diffType = diff(version.version, coercedVersion)
      return diffType !== null && releaseTypeList.includes(diffType)
    })
    return matchingUpgradeTypes.length === 0
      ? undefined
      : matchingUpgradeTypes.reduce((a, b) => (gt(a.version, b.version) ? a : b))
  }

  // If we are at a prerelease, then show all pre-x.
  // This is partially done to account for when there are only pre-x versions.
  const majorTypes: ReleaseType[] = currentVersionIsPrerelease ? ['major', 'premajor'] : ['major']
  const minorTypes: ReleaseType[] = currentVersionIsPrerelease ? ['minor', 'preminor'] : ['minor']
  const patchTypes: ReleaseType[] = currentVersionIsPrerelease ? ['patch', 'prepatch'] : ['patch']
  const prereleaseTypes: ReleaseType[] = ['prerelease']

  const majorUpgrade = pickHighest(eligibleUpgrades, majorTypes)
  const minorUpgrade = pickHighest(eligibleUpgrades, minorTypes)
  const patchUpgrade = pickHighest(eligibleUpgrades, patchTypes)
  const prereleaseUpgrade = currentVersionIsPrerelease
    ? pickHighest(eligibleUpgrades, prereleaseTypes)
    : undefined

  // Only compute per-bucket "latest" when the age filter could have held something back.
  const ageFilterActive = eligibleUpgrades !== possibleUpgrades
  const heldBack = (eligible: VersionData | undefined, trueLatest: VersionData | undefined) =>
    trueLatest !== undefined && (eligible === undefined || gt(trueLatest.version, eligible.version))
      ? trueLatest
      : undefined

  const majorLatest = ageFilterActive
    ? heldBack(majorUpgrade, pickHighest(possibleUpgrades, majorTypes))
    : undefined
  const minorLatest = ageFilterActive
    ? heldBack(minorUpgrade, pickHighest(possibleUpgrades, minorTypes))
    : undefined
  const patchLatest = ageFilterActive
    ? heldBack(patchUpgrade, pickHighest(possibleUpgrades, patchTypes))
    : undefined
  const prereleaseLatest =
    ageFilterActive && currentVersionIsPrerelease
      ? heldBack(prereleaseUpgrade, pickHighest(possibleUpgrades, prereleaseTypes))
      : undefined

  return {
    major: majorUpgrade,
    minor: minorUpgrade,
    patch: patchUpgrade,
    prerelease: prereleaseUpgrade,
    ...(majorLatest !== undefined ? { majorLatest } : {}),
    ...(minorLatest !== undefined ? { minorLatest } : {}),
    ...(patchLatest !== undefined ? { patchLatest } : {}),
    ...(prereleaseLatest !== undefined ? { prereleaseLatest } : {}),
    validVersion: true,
    existingVersion,
  }
}

// Matches pnpm's minimumReleaseAge exclude patterns, which support `*` wildcards
// (e.g. "@my-org/*" or "eslint*"). Patterns without a wildcard match the package
// name exactly.
const isPackageExcluded = (dependencyName: string, excludedPackages: string[]): boolean => {
  return excludedPackages.some((pattern) => {
    if (!pattern.includes('*')) {
      return pattern === dependencyName
    }
    const escaped = pattern.replace(/[.+^${}()|[\]\\?]/g, '\\$&').replace(/\*/g, '.*')
    return new RegExp(`^${escaped}$`).test(dependencyName)
  })
}

const filterByReleaseAge = (
  upgrades: VersionData[],
  npmData: NpmData,
  dependencyName: string,
  ageFilter: ReleaseAgeFilter | undefined,
): VersionData[] => {
  if (ageFilter === undefined || ageFilter.minimumReleaseAgeMinutes <= 0) {
    return upgrades
  }
  if (isPackageExcluded(dependencyName, ageFilter.excludedPackages)) {
    return upgrades
  }
  const now = ageFilter.now ?? Date.now()
  const minAgeMs = ageFilter.minimumReleaseAgeMinutes * 60 * 1000
  const timeMap = npmData.time
  return upgrades.filter((version) => {
    const publishedAt = timeMap?.[version.version]
    if (publishedAt === undefined) {
      // Missing publish metadata — be permissive rather than hiding the upgrade.
      return true
    }
    const publishedMs = new Date(publishedAt).getTime()
    if (Number.isNaN(publishedMs)) {
      return true
    }
    return now - publishedMs >= minAgeMs
  })
}

const getRawPossibleUpgradeList = (
  npmData: NpmData,
  dependencyName: string,
  ignoredVersions: string | undefined | string[],
  coercedVersion: string | SemVer,
): VersionData[] => {
  const latest = npmData['dist-tags'].latest
  if (!npmData.versions) {
    return []
  }

  return Object.values(npmData.versions)
    .filter((version) => valid(version.version) != null)
    .filter((version) => gt(version.version, coercedVersion))
    .filter((version) => {
      if (ignoredVersions === undefined) {
        return true
      }
      if (Array.isArray(ignoredVersions)) {
        for (const ignoredVersion of ignoredVersions) {
          if (isVersionIgnored(version, dependencyName, ignoredVersion)) {
            return false
          }
        }
        return true
      } else {
        return !isVersionIgnored(version, dependencyName, ignoredVersions)
      }
    })
    .filter((version) => {
      // If the current version is higher than latest, then we ignore the latest tag.
      // Otherwise, remove all versions higher than the latest tag
      return gt(coercedVersion, latest) || lte(version.version, latest)
    })
}

const isVersionIgnored = (version: VersionData, dependencyName: string, ignoredVersion: string) => {
  if (validRange(ignoredVersion) === null) {
    console.warn(
      `invalid semver range detected in ignored version for dependency ${dependencyName}: ${ignoredVersion}`,
    )
    return true
  }
  return satisfies(version.version, ignoredVersion)
}

// Decides whether a version string refers to something we can look up in the npm
// registry. Non-registry versions are skipped so we don't try to fetch them and
// end up showing "Dependency not found".
//
// We require two checks because each catches what the other misses:
//   - validRange() rejects everything that isn't a plain semver range: pnpm
//     "workspace:"/"catalog:" protocols, "file:"/"link:" specs, git/url/github
//     specs, and local paths. coerce() alone is too lenient here — it would happily
//     extract "4.17.0" from "github:lodash/lodash#v4.17.0" (or "17.0.0" from
//     "catalog:react17") and trigger a bogus fetch.
//   - coerce() rejects the bare wildcards and empty/blank strings ("*", "x", "X",
//     "") that validRange() normalizes to "*". We don't fetch those today and
//     fetching them would only produce noise (no real upgrade to show).
export const isRegistryVersion = (version: string): boolean => {
  return validRange(version) != null && valid(coerce(version)) != null
}

/**
 * Starts (or reuses) a registry fetch for every dependency given, and returns the
 * fetches still in flight. The dependencies are the ones we are about to decorate,
 * so what we fetch and what we show can never drift apart.
 *
 * Versions arrive here already resolved: a package.json `catalog:` ref is turned
 * into its real version (or dropped) by toDependency while parsing, and a catalog
 * entry in pnpm-workspace.yaml never references a catalog itself. isRegistryVersion
 * is the single guard on what we fetch, and it skips an unresolved `catalog:` along
 * with every other non-registry spec.
 */
export const refreshDependencies = (
  dependencies: readonly (readonly [string, string])[],
  filePath: string,
): Promise<void>[] => {
  const cacheCutoff = new Date(new Date().getTime() - 1000 * 60 * 120) // 120 minutes
  const fetchedDependencies = new Set<string>()

  return dependencies
    .filter(([_dependencyName, version]) => isRegistryVersion(version))
    .filter(([dependencyName, _version]) => {
      // The cache is keyed by name only, so one fetch covers every occurrence.
      if (fetchedDependencies.has(dependencyName)) {
        return false
      }
      fetchedDependencies.add(dependencyName)
      return true
    })
    .map(([dependencyName, _version]) => {
      const cache = npmCache[dependencyName]
      if (
        cache === undefined ||
        cache.asyncstate === AsyncState.NotStarted ||
        (cache.item !== undefined && cache.item.date.getTime() < cacheCutoff.getTime())
      ) {
        return fetchNpmData(dependencyName, filePath)
      } else {
        return npmCache[dependencyName]?.promise
      }
    })
    .filter((p): p is Promise<void> => p !== undefined)
}

const getNumberProp = (e: unknown, prop: string): number | undefined => {
  if (e !== null && typeof e === 'object' && prop in e) {
    const value = (e as Record<string, unknown>)[prop]
    if (typeof value === 'number') {
      return value
    }
  }
  return undefined
}

const fetchNpmData = (dependencyName: string, packageJsonPath: string) => {
  if (
    npmCache[dependencyName] !== undefined &&
    (npmCache[dependencyName].asyncstate === AsyncState.InProgress ||
      npmCache[dependencyName].asyncstate === AsyncState.Rejected)
  ) {
    return npmCache[dependencyName].promise
  }

  const conf = {
    ...getNpmConfig(packageJsonPath),
    spec: dependencyName,
    // TODO could it be worth it to have a random timeout if there are many timeouts?
    timeout: 10_000,
    fetchRetries: 1,
  }
  const promise = npmRegistryFetch.json(dependencyName, conf) as unknown as Promise<NpmData>

  const startTime = new Date().getTime()
  npmCache[dependencyName] = {
    asyncstate: AsyncState.InProgress,
    promise,
    startTime,
  }

  promise
    .then((json) => {
      // Populate changelog cache (not awaited to speed things up)
      void retrieveAndCacheChangelog(json)
      npmCache[dependencyName] = {
        asyncstate: AsyncState.Fulfilled,
        startTime,
        item: {
          date: new Date(),
          npmData: json,
        },
      }
    })
    .catch((e: unknown) => {
      const fetchError = categorizeFetchError(e)
      logError(`failed to load dependency ${dependencyName} (${fetchError.type})`, e)

      npmCache[dependencyName] = {
        asyncstate: AsyncState.Rejected,
        startTime,
        error: fetchError,
      }
    })

  return promise
}

export const categorizeFetchError = (e: unknown): FetchError => {
  const code = getStringProp(e, 'code')
  const statusCode = getNumberProp(e, 'statusCode') ?? parseHttpStatusFromCode(code)

  // npm-registry-fetch (via minipass-fetch) marks timeouts with a type rather
  // than a status or transport code, so check it first — a timeout is more
  // specific than the generic network failure below.
  const errorType = getStringProp(e, 'type')
  if (errorType === 'request-timeout' || errorType === 'body-timeout') {
    return { type: FetchErrorType.Timeout, message: 'Registry request timed out' }
  }

  // We got an HTTP response, so the registry answered — categorize by status.
  if (statusCode !== undefined) {
    if (statusCode === 404) {
      // The package genuinely isn't there.
      return { type: FetchErrorType.NotFound, message: 'Dependency not found' }
    }
    if (statusCode === 401 || statusCode === 403) {
      return { type: FetchErrorType.Unauthorized, message: 'Authorization failed' }
    }
    if (statusCode === 429) {
      return { type: FetchErrorType.RateLimited, message: 'Registry rate limit reached' }
    }
    if (statusCode >= 500) {
      return { type: FetchErrorType.ServerError, message: 'Registry server error' }
    }
    return { type: FetchErrorType.Unknown, message: 'Could not fetch dependency' }
  }

  // No HTTP response came back at all. Node attaches a `code` to transport-level
  // failures (DNS, TLS, connection refused, proxy errors, timeouts), so a code
  // without a status means we couldn't reach the registry. This deliberately
  // avoids enumerating specific codes — any of them implies a connectivity issue.
  if (code !== undefined) {
    return { type: FetchErrorType.Network, message: 'Could not reach registry' }
  }

  return { type: FetchErrorType.Unknown, message: 'Could not fetch dependency' }
}

const getStringProp = (e: unknown, prop: string): string | undefined => {
  if (e !== null && typeof e === 'object' && prop in e) {
    const value = (e as Record<string, unknown>)[prop]
    if (typeof value === 'string') {
      return value
    }
  }
  return undefined
}

// npm-registry-fetch sometimes exposes the HTTP status only via a code like
// "E404" rather than a numeric statusCode, so we parse it out as a fallback.
const parseHttpStatusFromCode = (code: string | undefined): number | undefined => {
  if (code === undefined) {
    return undefined
  }
  const match = /^E(\d{3})$/.exec(code)
  if (match === null) {
    return undefined
  }
  return Number(match[1])
}
