import { isBefore, subMinutes } from 'date-fns'
import fetch, { Response } from 'node-fetch'
import { diff, gt, ReleaseType, valid } from 'semver'
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
    [key in string]: { name: string; version: string }
  }
  homepage?: string
}

interface NpmError {
  error: string
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

export const getPossibleUpgrades = (npmData: NpmData, currentVersion: string) => {
  if (valid(currentVersion) === null) {
    // Currently invalid versions will be shown the same as latest due to this
    return {}
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
  }
}

export const refreshPackageJsonData = (packageJson: vscode.TextDocument) => {
  const cacheCutoff = subMinutes(new Date(), 120)

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
        isBefore(cache.item.date, cacheCutoff)
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
  const response: Response = await fetch(`https://registry.npmjs.org/${dependencyName}`)
  const json = (await response.json()) as NpmData | NpmError

  if (isNpmData(json)) {
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
  } else {
    console.log(`failed to load dependency ${dependencyName}`)
    npmCache[dependencyName] = {
      asyncstate: AsyncState.Rejected,
    }
  }
}

const isNpmData = (object: NpmData | NpmError): object is NpmData => {
  // tslint:disable-next-line: strict-type-predicates
  return (object as NpmData).versions !== undefined
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
