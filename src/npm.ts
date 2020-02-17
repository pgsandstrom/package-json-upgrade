import * as config from 'libnpmconfig'
import fetch from 'node-fetch'
import * as npmRegistryFetch from 'npm-registry-fetch'
import { coerce, diff, gt, prerelease, ReleaseType, valid } from 'semver'
import * as vscode from 'vscode'
import { AsyncState, Dict, Loader, StrictDict } from './types'

interface PackageJson {
  dependencies: StrictDict<string, PackageJsonDependency>
  devDependencies: StrictDict<string, PackageJsonDependency>
}

interface PackageJsonDependency {
  versions: StrictDict<string, NpmData>
}

interface NpmData {
  versions: {
    [key in string]: VersionData
  }
  homepage?: string
}

interface VersionData {
  name: string
  version: string
}

interface DependencyUpdateInfo {
  major?: VersionData
  minor?: VersionData
  patch?: VersionData
  validVersion: boolean
}

interface CacheItem {
  date: Date
  npmData: NpmData
}

const npmCache: Dict<string, Loader<CacheItem>> = {}

// dependencyname pointing to a potential changelog
const changelogCache: Dict<string, Loader<string>> = {}

export const getCachedNpmData = (dependencyName: string) => {
  return npmCache[dependencyName]
}

export const getCachedChangelog = (dependencyName: string) => {
  return changelogCache[dependencyName]
}

// export type ReleaseType = "major" | "premajor" | "minor" | "preminor" | "patch" | "prepatch" | "prerelease";

const ACCEPTABLE_UPGRADES = ['major', 'minor', 'patch']

export const getLatestVersion = (npmData: NpmData) => {
  const versions = Object.values<VersionData>(npmData.versions)
  if (versions.length === 0) {
    return undefined
  } else {
    return versions
      .filter(item => prerelease(item.version) === null)
      .reduce((a, b) => (gt(a.version, b.version) ? a : b))
  }
}

export const getPossibleUpgrades = (
  npmData: NpmData,
  rawCurrentVersion: string,
): DependencyUpdateInfo => {
  if (rawCurrentVersion === '*' || rawCurrentVersion === 'x') {
    return { validVersion: true }
  }

  const currentVersion = coerce(rawCurrentVersion)
  if (currentVersion === null) {
    return { validVersion: false }
  }
  const possibleUpgrades = Object.values(npmData.versions)
    .filter(version => valid(version.version))
    .filter(version => gt(version.version, currentVersion))
    .filter(version => {
      const upgrade = diff(version.version, currentVersion)
      return upgrade !== null && ACCEPTABLE_UPGRADES.includes(upgrade)
    })

  const helper = (releaseType: ReleaseType) => {
    const matchingUpgradeTypes = possibleUpgrades.filter(
      version => diff(version.version, currentVersion) === releaseType,
    )
    return matchingUpgradeTypes.length === 0
      ? undefined
      : matchingUpgradeTypes.reduce((a, b) => (gt(a.version, b.version) ? a : b))
  }

  const majorUpgrade = helper('major')
  const minorUpgrade = helper('minor')
  const patchUpgrade = helper('patch')

  return {
    major: majorUpgrade,
    minor: minorUpgrade,
    patch: patchUpgrade,
    validVersion: true,
  }
}

export const refreshPackageJsonData = (packageJson: vscode.TextDocument) => {
  const cacheCutoff = new Date(new Date().getTime() - 1000 * 60 * 120) // 120 minutes

  const text = packageJson.getText()
  try {
    const json = JSON.parse(text) as PackageJson
    const dependencies = {
      ...json.dependencies,
      ...json.devDependencies,
    }

    const promises = Object.entries(dependencies).map(([dependencyName, _version]) => {
      const cache = npmCache[dependencyName]
      if (
        cache === undefined ||
        cache.item === undefined ||
        cache.item.date.getTime() < cacheCutoff.getTime()
      ) {
        return fetchNpmData(dependencyName)
      } else {
        return Promise.resolve()
      }
    })

    return Promise.all(promises)
  } catch (e) {
    console.warn(`Failed to parse package.json: ${packageJson.uri.fsPath}`)
    return Promise.resolve()
  }
}

const conf = config.read({
  // here we can override config
  // currently disable cache since it seems to be buggy with npm-registry-fetch
  cache: null,
  // registry: 'https://registry.npmjs.org',
})
// console.log(JSON.stringify(conf))

const fetchNpmData = async (dependencyName: string) => {
  if (
    npmCache[dependencyName] !== undefined &&
    (npmCache[dependencyName]?.asyncstate === AsyncState.InProgress ||
      npmCache[dependencyName]?.asyncstate === AsyncState.Rejected)
  ) {
    return
  }
  npmCache[dependencyName] = {
    asyncstate: AsyncState.InProgress,
  }
  try {
    const json = (await npmRegistryFetch.json(dependencyName, conf)) as NpmData
    if (changelogCache[dependencyName] === undefined) {
      findChangelog(dependencyName, json)
    }
    npmCache[dependencyName] = {
      asyncstate: AsyncState.Fulfilled,
      item: {
        date: new Date(),
        npmData: json,
      },
    }
  } catch (e) {
    console.debug(`failed to load dependency ${dependencyName}. Error: ${JSON.stringify(e)}`)
    npmCache[dependencyName] = {
      asyncstate: AsyncState.Rejected,
    }
  }
}

const findChangelog = async (dependencyName: string, npmData: NpmData) => {
  if (npmData.homepage === undefined) {
    return
  }
  // TODO support other stuff than github?
  const regexResult = /(https?:\/\/github\.com\/[a-zA-z0-9_-]*\/[a-zA-z0-9_-]*)(#[a-zA-z0-9_-]*)?/.exec(
    npmData.homepage,
  )
  if (regexResult !== null) {
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
}
