import fetch from 'node-fetch'
import * as npmRegistryFetch from 'npm-registry-fetch'
import { ReleaseType, SemVer, coerce, diff, gt, lte, satisfies, valid, validRange } from 'semver'
import { getConfig } from './config'
import { getNpmConfig } from './npmConfig'
import { AsyncState, Dict, Loader, StrictDict } from './types'

export interface NpmLoader<T> {
  asyncstate: AsyncState
  startTime: number
  promise?: Promise<unknown>
  item?: T
}

interface PackageJson {
  dependencies?: StrictDict<string, PackageJsonDependency>
  devDependencies?: StrictDict<string, PackageJsonDependency>
  peerDependencies?: StrictDict<string, PackageJsonDependency>
  optionalDependencies?: StrictDict<string, PackageJsonDependency>
  overrides?: StrictDict<string, PackageJsonDependency>
  resolutions?: StrictDict<string, PackageJsonDependency>
}

interface PackageJsonDependency {
  versions: StrictDict<string, NpmData>
}

export interface NpmData {
  'dist-tags': {
    latest: string
    next?: string // not used currently
  }
  versions: {
    [key in string]: VersionData
  }
  homepage?: string
  // repository: {
  //   type: string
  //   url: string
  // }
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
  validVersion: boolean // if the current version is valid semver
  existingVersion: boolean // if the current version exists on npm
}

export interface CacheItem {
  date: Date
  npmData: NpmData
}

let npmCache: Dict<string, NpmLoader<CacheItem>> = {}

// dependencyname pointing to a potential changelog
let changelogCache: Dict<string, Loader<string>> = {}

export const cleanNpmCache = () => {
  npmCache = {}
  changelogCache = {}
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

export const getCachedChangelog = (dependencyName: string) => {
  return changelogCache[dependencyName]
}

export const getLatestVersion = (
  npmData: NpmData,
  rawCurrentVersion: string,
  dependencyName: string,
): VersionData | undefined => {
  const ignoredVersions = getConfig().ignoreVersions[dependencyName]
  return getLatestVersionWithIgnoredVersions(
    npmData,
    rawCurrentVersion,
    dependencyName,
    ignoredVersions,
  )
}

export const getLatestVersionWithIgnoredVersions = (
  npmData: NpmData,
  rawCurrentVersion: string,
  dependencyName: string,
  ignoredVersions: string | undefined | string[],
): VersionData | undefined => {
  const possibleUpgrades = getPossibleUpgradesWithIgnoredVersions(
    npmData,
    rawCurrentVersion,
    dependencyName,
    ignoredVersions,
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
  const ignoredVersions = getConfig().ignoreVersions[dependencyName]
  return getPossibleUpgradesWithIgnoredVersions(
    npmData,
    rawCurrentVersion,
    dependencyName,
    ignoredVersions,
  )
}

export const getPossibleUpgradesWithIgnoredVersions = (
  npmData: NpmData,
  rawCurrentVersion: string,
  dependencyName: string,
  ignoredVersions: string | undefined | string[],
): DependencyUpdateInfo => {
  if (rawCurrentVersion === '*' || rawCurrentVersion === 'x') {
    return { validVersion: true, existingVersion: true }
  }

  const exactVersion = getExactVersion(rawCurrentVersion)

  const currentVersionIsPrerelease = isVersionPrerelease(exactVersion)

  const coercedVersion = currentVersionIsPrerelease ? exactVersion : coerce(exactVersion)
  if (coercedVersion === null) {
    return { validVersion: false, existingVersion: false }
  }

  const existingVersion = Object.values(npmData.versions).some(
    (version) => version.version === exactVersion,
  )

  const possibleUpgrades = getRawPossibleUpgradeList(
    npmData,
    dependencyName,
    ignoredVersions,
    coercedVersion,
  )

  const helper = (releaseTypeList: ReleaseType[]) => {
    const matchingUpgradeTypes = possibleUpgrades.filter((version) => {
      const diffType = diff(version.version, coercedVersion)
      return diffType !== null && releaseTypeList.includes(diffType)
    })
    return matchingUpgradeTypes.length === 0
      ? undefined
      : matchingUpgradeTypes.reduce((a, b) => (gt(a.version, b.version) ? a : b))
  }

  // If we are at a prerelease, then show all pre-x.
  // This is partially done to account for when there are only pre-x versions.
  const majorUpgrade = helper(currentVersionIsPrerelease ? ['major', 'premajor'] : ['major'])
  const minorUpgrade = helper(currentVersionIsPrerelease ? ['minor', 'preminor'] : ['minor'])
  const patchUpgrade = helper(currentVersionIsPrerelease ? ['patch', 'prepatch'] : ['patch'])
  const prereleaseUpgrade = currentVersionIsPrerelease ? helper(['prerelease']) : undefined
  return {
    major: majorUpgrade,
    minor: minorUpgrade,
    patch: patchUpgrade,
    prerelease: prereleaseUpgrade,
    validVersion: true,
    existingVersion,
  }
}

const getRawPossibleUpgradeList = (
  npmData: NpmData,
  dependencyName: string,
  ignoredVersions: string | undefined | string[],
  coercedVersion: string | SemVer,
) => {
  const latest = npmData['dist-tags'].latest
  return Object.values(npmData.versions)
    .filter((version) => valid(version.version))
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
      `invalid semver range detected in ignored version for depedency ${dependencyName}: ${ignoredVersion}`,
    )
    return true
  }
  return satisfies(version.version, ignoredVersion)
}

export const refreshPackageJsonData = (
  packageJsonString: string,
  packageJsonFilePath: string,
): Promise<void>[] => {
  const cacheCutoff = new Date(new Date().getTime() - 1000 * 60 * 120) // 120 minutes

  try {
    const json = JSON.parse(packageJsonString) as PackageJson
    const dependencies = {
      ...json.dependencies,
      ...json.devDependencies,
      ...json.peerDependencies,
      ...json.optionalDependencies,
      ...json.overrides,
      ...json.resolutions,
    }

    const promises = Object.keys(dependencies)
      .map((dependencyName) => {
        const cache = npmCache[dependencyName]
        if (
          cache === undefined ||
          cache.asyncstate === AsyncState.NotStarted ||
          (cache.item !== undefined && cache.item.date.getTime() < cacheCutoff.getTime())
        ) {
          return fetchNpmData(dependencyName, packageJsonFilePath)
        } else {
          return npmCache[dependencyName]?.promise
        }
      })
      .filter((p): p is Promise<void> => p !== undefined)

    return promises
  } catch (e) {
    console.warn(`Failed to parse package.json: ${packageJsonFilePath}`)
    return [Promise.resolve()]
  }
}

const fetchNpmData = (dependencyName: string, packageJsonPath: string) => {
  if (
    npmCache[dependencyName] !== undefined &&
    (npmCache[dependencyName].asyncstate === AsyncState.InProgress ||
      npmCache[dependencyName].asyncstate === AsyncState.Rejected)
  ) {
    return npmCache[dependencyName].promise
  }

  const conf = { ...getNpmConfig(packageJsonPath), spec: dependencyName }
  const promise = npmRegistryFetch.json(dependencyName, conf) as unknown as Promise<NpmData>

  const startTime = new Date().getTime()
  npmCache[dependencyName] = {
    asyncstate: AsyncState.InProgress,
    promise,
    startTime,
  }

  promise
    .then((json) => {
      if (changelogCache[dependencyName] === undefined) {
        // we currently do not wait for this to speed things up
        void findChangelog(dependencyName, json)
      }
      npmCache[dependencyName] = {
        asyncstate: AsyncState.Fulfilled,
        startTime,
        item: {
          date: new Date(),
          npmData: json,
        },
      }
    })
    .catch((e) => {
      /* eslint-disable */
      console.error(`failed to load dependency ${dependencyName}`)
      console.error(`status code: ${e?.statusCode}`)
      console.error(`uri: ${e?.uri}`)
      console.error(`message: ${e?.message}`)
      console.error(`config used: ${JSON.stringify(conf, null, 2)}`)
      console.error(`Entire error: ${JSON.stringify(e, null, 2)}`)
      /* eslint-enable */
      npmCache[dependencyName] = {
        asyncstate: AsyncState.Rejected,
        startTime,
      }
    })

  return promise
}

const findChangelog = async (dependencyName: string, npmData: NpmData) => {
  if (npmData.homepage === undefined) {
    return
  }
  // TODO support other stuff than github?
  const regexResult = /(https?:\/\/github\.com\/[-\w/.]*\/[-\w/.]*)(#[-\w/.]*)?/.exec(
    npmData.homepage,
  )
  if (regexResult === null) {
    return
  }

  changelogCache[dependencyName] = {
    asyncstate: AsyncState.InProgress,
  }
  const baseGithubUrl = regexResult[1]
  const changelogUrl = `${baseGithubUrl}/blob/master/CHANGELOG.md`
  const result = await fetch(changelogUrl)
  if (result.status >= 200 && result.status < 300) {
    changelogCache[dependencyName] = {
      asyncstate: AsyncState.Fulfilled,
      item: changelogUrl,
    }
  } else {
    changelogCache[dependencyName] = {
      asyncstate: AsyncState.Rejected,
    }
  }
}
