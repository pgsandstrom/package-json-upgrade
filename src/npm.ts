import { isBefore, subMinutes } from 'date-fns'
import fetch, { Response } from 'node-fetch'
import { diff, gt, ReleaseType, valid } from 'semver'
import * as vscode from 'vscode'
import { Dict, StrictDict } from './types'

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
  homepage: string
}

interface NpmError {
  error: string
}

interface CacheItem {
  date: Date
  npmData: NpmData
}

const npmCache: Dict<string, CacheItem> = {}

export const getCachedNpmData = (dependencyName: string) => {
  return npmCache[dependencyName]
}

// export type ReleaseType = "major" | "premajor" | "minor" | "preminor" | "patch" | "prepatch" | "prerelease";

const ACCEPTABLE_UPGRADES = ['major', 'minor', 'patch']

export const getPossibleUpgrades = (npmData: NpmData, currentVersion: string) => {
  if (valid(currentVersion) === null) {
    // TODO currently invalid versions will be shown as latest due to this
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
  const json = JSON.parse(text) as PackageJson
  const dependencies = {
    ...json.dependencies,
    ...json.devDependencies,
  }

  const promises = Object.entries(dependencies).map(([dependencyName, _version]) => {
    const cache = npmCache[dependencyName]
    if (cache === undefined || isBefore(cache.date, cacheCutoff)) {
      return fetchNpmData(dependencyName)
    } else {
      return Promise.resolve()
    }
  })

  return Promise.all(promises)
}

const fetchNpmData = async (dependencyName: string) => {
  // console.log(`Fetching npm data for ${dependencyName}`)
  const lol: Response = await fetch(`https://registry.npmjs.org/${dependencyName}`)
  const json = (await lol.json()) as NpmData | NpmError

  // TODO do something smart if we cant find a dependency. Show error decorator?
  if (isNpmData(json)) {
    npmCache[dependencyName] = {
      date: new Date(),
      npmData: json,
    }
  }
}

const isNpmData = (object: NpmData | NpmError): object is NpmData => {
  // tslint:disable-next-line: strict-type-predicates
  return (object as NpmData).versions !== undefined
}
