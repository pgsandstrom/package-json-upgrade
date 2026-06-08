import { before, describe, test } from 'node:test'

import * as assert from 'assert'

import { Config, setConfig } from '../config'
import {
  DependencyUpdateInfo,
  getLatestVersionWithIgnoredVersions,
  getPossibleUpgrades,
  getPossibleUpgradesWithIgnoredVersions,
  isRegistryVersion,
  NpmData,
  VersionData,
} from '../npm'

const testData: NpmData = {
  'dist-tags': {
    latest: '2.1.1',
  },
  versions: {
    '1.0.0': {
      name: 'dependencyName',
      version: '1.0.0',
    },
    '1.0.1': {
      name: 'dependencyName',
      version: '1.0.1',
    },
    '1.1.0': {
      name: 'dependencyName',
      version: '1.1.0',
    },
    '1.1.1': {
      name: 'dependencyName',
      version: '1.1.1',
    },
    '2.0.0-alpha.1': {
      name: 'dependencyName',
      version: '2.0.0-alpha.1',
    },
    '2.0.0-alpha.2': {
      name: 'dependencyName',
      version: '2.0.0-alpha.2',
    },
    '2.0.0': {
      name: 'dependencyName',
      version: '2.0.0',
    },
    '2.1.0': {
      name: 'dependencyName',
      version: '2.1.0',
    },
    '2.1.1': {
      name: 'dependencyName',
      version: '2.1.1',
    },
    '3.0.0-alpha.1': {
      name: 'dependencyName',
      version: '3.0.0-alpha.1',
    },
    '3.0.0-alpha.2': {
      name: 'dependencyName',
      version: '3.0.0-alpha.2',
    },
  },
}

describe('Npm Test Suite', () => {
  before(() => {
    const config: Config = {
      showUpdatesAtStart: true,
      showOverviewRulerColor: true,
      skipNpmConfig: true,
      majorUpgradeColorOverwrite: '',
      minorUpgradeColorOverwrite: '',
      patchUpgradeColorOverwrite: '',
      prereleaseUpgradeColorOverwrite: '',
      decorationString: '',
      ignorePatterns: [],
      ignoreVersions: {},
      msUntilRowLoading: 6000,
      dependencyGroups: ['dependencies', 'devDependencies'],
      minimumReleaseAge: 0,
      minimumReleaseAgeExclude: [],
    }
    setConfig(config)
  })

  test('Major upgrade', () => {
    const result: DependencyUpdateInfo = getPossibleUpgrades(testData, '1.1.1', 'dependencyName')
    const expected: DependencyUpdateInfo = {
      major: { name: 'dependencyName', version: '2.1.1' },
      minor: undefined,
      patch: undefined,
      prerelease: undefined,
      validVersion: true,
      existingVersion: true,
    }
    assert.deepStrictEqual(result, expected)
  })

  test('Minor upgrade', () => {
    const result: DependencyUpdateInfo = getPossibleUpgrades(testData, '2.0.0', 'dependencyName')
    const expected: DependencyUpdateInfo = {
      major: undefined,
      minor: { name: 'dependencyName', version: '2.1.1' },
      patch: undefined,
      prerelease: undefined,
      validVersion: true,
      existingVersion: true,
    }
    assert.deepStrictEqual(result, expected)
  })

  test('Patch upgrade', () => {
    const result: DependencyUpdateInfo = getPossibleUpgrades(testData, '2.1.0', 'dependencyName')
    const expected: DependencyUpdateInfo = {
      major: undefined,
      minor: undefined,
      patch: { name: 'dependencyName', version: '2.1.1' },
      prerelease: undefined,
      validVersion: true,
      existingVersion: true,
    }
    assert.deepStrictEqual(result, expected)
  })

  test('Many upgrades', () => {
    const result: DependencyUpdateInfo = getPossibleUpgrades(testData, '1.0.0', 'dependencyName')
    const expected: DependencyUpdateInfo = {
      major: { name: 'dependencyName', version: '2.1.1' },
      minor: { name: 'dependencyName', version: '1.1.1' },
      patch: { name: 'dependencyName', version: '1.0.1' },
      prerelease: undefined,
      validVersion: true,
      existingVersion: true,
    }
    assert.deepStrictEqual(result, expected)
  })

  test('Invalid version', () => {
    const result: DependencyUpdateInfo = getPossibleUpgrades(
      testData,
      'non-existing-version',
      'dependencyName',
    )
    const expected: DependencyUpdateInfo = {
      validVersion: false,
      existingVersion: false,
    }
    assert.deepStrictEqual(result, expected)
  })

  test('Prerelease upgrade', () => {
    const result: DependencyUpdateInfo = getPossibleUpgrades(
      testData,
      '3.0.0-alpha.1',
      'dependencyName',
    )
    const expected: DependencyUpdateInfo = {
      major: undefined,
      minor: undefined,
      patch: undefined,
      prerelease: { name: 'dependencyName', version: '3.0.0-alpha.2' },
      validVersion: true,
      existingVersion: true,
    }
    assert.deepStrictEqual(result, expected)
  })

  test('Prerelease upgrade with inexact version', () => {
    const result: DependencyUpdateInfo = getPossibleUpgrades(
      testData,
      '^3.0.0-alpha.1',
      'dependencyName',
    )
    const expected: DependencyUpdateInfo = {
      major: undefined,
      minor: undefined,
      patch: undefined,
      prerelease: { name: 'dependencyName', version: '3.0.0-alpha.2' },
      validVersion: true,
      existingVersion: true,
    }
    assert.deepStrictEqual(result, expected)
  })

  test('Prerelease upgrade to final', () => {
    const result: DependencyUpdateInfo = getPossibleUpgrades(
      testData,
      '2.0.0-alpha.1',
      'dependencyName',
    )
    const expected: DependencyUpdateInfo = {
      existingVersion: true,
      major: { name: 'dependencyName', version: '2.1.1' },
      minor: undefined,
      patch: undefined,
      prerelease: { name: 'dependencyName', version: '2.0.0-alpha.2' },
      validVersion: true,
    }
    assert.deepStrictEqual(result, expected)
  })

  const testDataWithLatest: NpmData = {
    'dist-tags': {
      latest: '1.0.0',
    },
    versions: {
      '1.0.0': {
        name: 'dependencyName',
        version: '1.0.0',
      },
      '2.0.0': {
        name: 'dependencyName',
        version: '2.0.0',
      },
      '2.0.1': {
        name: 'dependencyName',
        version: '2.0.1',
      },
    },
  }

  test('Latest dist-tag blocks major upgrade', () => {
    const result: DependencyUpdateInfo = getPossibleUpgrades(
      testDataWithLatest,
      '1.0.0',
      'dependencyName',
    )
    const expected: DependencyUpdateInfo = {
      major: undefined,
      minor: undefined,
      patch: undefined,
      prerelease: undefined,
      validVersion: true,
      existingVersion: true,
    }
    assert.deepStrictEqual(result, expected)
  })

  test('Latest dist-tag ignored if current version is already higher than latest dist-tag', () => {
    const result: DependencyUpdateInfo = getPossibleUpgrades(
      testDataWithLatest,
      '2.0.0',
      'dependencyName',
    )
    const expected: DependencyUpdateInfo = {
      major: undefined,
      minor: undefined,
      patch: { name: 'dependencyName', version: '2.0.1' },
      prerelease: undefined,
      validVersion: true,
      existingVersion: true,
    }
    assert.deepStrictEqual(result, expected)
  })

  const testDataWithOnlyPrereleases: NpmData = {
    'dist-tags': {
      latest: '2.0.0-build100',
    },
    versions: {
      '1.0.0-build100': {
        name: 'dependencyName',
        version: '1.0.0-build100',
      },
      '2.0.0-build100': {
        name: 'dependencyName',
        version: '2.0.0-build100',
      },
    },
  }

  test('Should work even if all releases are pre-releases', () => {
    const result: DependencyUpdateInfo = getPossibleUpgrades(
      testDataWithOnlyPrereleases,
      '1.0.1-build100',
      'dependencyName',
    )
    const expected: DependencyUpdateInfo = {
      major: {
        name: 'dependencyName',
        version: '2.0.0-build100',
      },
      minor: undefined,
      patch: undefined,
      prerelease: undefined,
      validVersion: true,
      existingVersion: false,
    }
    assert.deepStrictEqual(result, expected)
  })

  test('Ignored versions should work', () => {
    const result: DependencyUpdateInfo = getPossibleUpgradesWithIgnoredVersions(
      testData,
      '1.1.1',
      'dependencyName',
      '>=2.1.1',
    )
    const expected: DependencyUpdateInfo = {
      major: { name: 'dependencyName', version: '2.1.0' },
      minor: undefined,
      patch: undefined,
      prerelease: undefined,
      validVersion: true,
      existingVersion: true,
    }
    assert.deepStrictEqual(result, expected)
  })

  test('Multiple ignored versions should work', () => {
    const result: DependencyUpdateInfo = getPossibleUpgradesWithIgnoredVersions(
      testData,
      '1.1.1',
      'dependencyName',
      ['=2.1.1', '=2.1.0'],
    )
    const expected: DependencyUpdateInfo = {
      major: { name: 'dependencyName', version: '2.0.0' },
      minor: undefined,
      patch: undefined,
      prerelease: undefined,
      validVersion: true,
      existingVersion: true,
    }
    assert.deepStrictEqual(result, expected)
  })

  test('getLatestVersion major', () => {
    const result: VersionData | undefined = getLatestVersionWithIgnoredVersions(
      testData,
      '1.1.1',
      'dependencyName',
      ['=2.1.1', '=2.1.0'],
    )
    const expected: VersionData = {
      name: 'dependencyName',
      version: '2.0.0',
    }
    assert.deepStrictEqual(result, expected)
  })

  test('getLatestVersion patch', () => {
    const result: VersionData | undefined = getLatestVersionWithIgnoredVersions(
      testData,
      '2.1.0',
      'dependencyName',
      [],
    )
    const expected: VersionData = {
      name: 'dependencyName',
      version: '2.1.1',
    }
    assert.deepStrictEqual(result, expected)
  })

  test('getLatestVersion star', () => {
    const result: VersionData | undefined = getLatestVersionWithIgnoredVersions(
      testData,
      '*',
      'dependencyName',
      [],
    )
    assert.deepStrictEqual(result, undefined)
  })

  test('existingVersion should work with caret', () => {
    const result: DependencyUpdateInfo = getPossibleUpgrades(testData, '^1.1.1', 'dependencyName')
    const expected: DependencyUpdateInfo = {
      major: { name: 'dependencyName', version: '2.1.1' },
      minor: undefined,
      patch: undefined,
      prerelease: undefined,
      validVersion: true,
      existingVersion: true,
    }
    assert.deepStrictEqual(result, expected)
  })

  test('existingVersion should work with tilde', () => {
    const result: DependencyUpdateInfo = getPossibleUpgrades(testData, '~1.1.1', 'dependencyName')
    const expected: DependencyUpdateInfo = {
      major: { name: 'dependencyName', version: '2.1.1' },
      minor: undefined,
      patch: undefined,
      prerelease: undefined,
      validVersion: true,
      existingVersion: true,
    }
    assert.deepStrictEqual(result, expected)
  })

  test('existingVersion should be true when version does not exist', () => {
    const result: DependencyUpdateInfo = getPossibleUpgrades(testData, '1.1.11', 'dependencyName')
    const expected: DependencyUpdateInfo = {
      major: { name: 'dependencyName', version: '2.1.1' },
      minor: undefined,
      patch: undefined,
      prerelease: undefined,
      validVersion: true,
      existingVersion: false,
    }
    assert.deepStrictEqual(result, expected)
  })

  // Mirrors TypeScript's 5.0 line, which started at 5.0.2 (5.0.0/5.0.1 were never published).
  const tildeBaseMissingData: NpmData = {
    'dist-tags': { latest: '6.0.0' },
    versions: {
      '5.0.2': { name: 'dependencyName', version: '5.0.2' },
      '5.0.3': { name: 'dependencyName', version: '5.0.3' },
      '5.0.4': { name: 'dependencyName', version: '5.0.4' },
      '6.0.0': { name: 'dependencyName', version: '6.0.0' },
    },
  }

  test('existingVersion should be true for a tilde range whose exact base version is unpublished', () => {
    // ~5.0.0 is satisfied by 5.0.4 even though 5.0.0 was never published.
    const result: DependencyUpdateInfo = getPossibleUpgrades(
      tildeBaseMissingData,
      '~5.0.0',
      'dependencyName',
    )
    assert.strictEqual(result.existingVersion, true)
    assert.deepStrictEqual(result.patch, { name: 'dependencyName', version: '5.0.4' })
  })

  test('existingVersion should be true for a caret range whose exact base version is unpublished', () => {
    const result: DependencyUpdateInfo = getPossibleUpgrades(
      tildeBaseMissingData,
      '^5.0.0',
      'dependencyName',
    )
    assert.strictEqual(result.existingVersion, true)
  })

  test('version such as 1.x should be correctly identified as a current version', () => {
    const result: DependencyUpdateInfo = getPossibleUpgrades(testData, '1.x', 'dependencyName')
    const expected: DependencyUpdateInfo = {
      major: { name: 'dependencyName', version: '2.1.1' },
      minor: { name: 'dependencyName', version: '1.1.1' },
      patch: { name: 'dependencyName', version: '1.0.1' },
      prerelease: undefined,
      validVersion: true,
      existingVersion: true,
    }
    assert.deepStrictEqual(result, expected)
  })

  // Age filter fixtures: "NOW" is 2026-04-23T12:00:00Z; versions are dated relative to that.
  const NOW = new Date('2026-04-23T12:00:00Z').getTime()
  const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString()
  const MINUTES = 60 * 1000
  const DAYS = 24 * 60 * MINUTES

  const ageTestData: NpmData = {
    'dist-tags': { latest: '2.1.1' },
    versions: {
      '2.0.0': { name: 'dependencyName', version: '2.0.0' },
      '2.1.0': { name: 'dependencyName', version: '2.1.0' },
      '2.1.1': { name: 'dependencyName', version: '2.1.1' },
    },
    time: {
      '2.0.0': iso(60 * DAYS),
      '2.1.0': iso(30 * DAYS),
      '2.1.1': iso(1 * DAYS), // published 1 day ago — younger than 7-day threshold
    },
  }

  test('minimumReleaseAge holds back the freshest patch and surfaces the eligible one', () => {
    const result = getPossibleUpgradesWithIgnoredVersions(
      ageTestData,
      '2.0.0',
      'dependencyName',
      undefined,
      {
        minimumReleaseAgeMinutes: 7 * 24 * 60,
        excludedPackages: [],
        now: NOW,
      },
    )
    assert.deepStrictEqual(result.minor, { name: 'dependencyName', version: '2.1.0' })
    assert.deepStrictEqual(result.minorLatest, { name: 'dependencyName', version: '2.1.1' })
    // No patch bucket since current is 2.0.0 (2.1.x is a minor bump).
    assert.strictEqual(result.patch, undefined)
    assert.strictEqual(result.patchLatest, undefined)
  })

  test('minimumReleaseAge older than any version leaves eligible = latest and no held-back fields', () => {
    const result = getPossibleUpgradesWithIgnoredVersions(
      ageTestData,
      '2.0.0',
      'dependencyName',
      undefined,
      {
        minimumReleaseAgeMinutes: 1, // 1 minute — every published version passes
        excludedPackages: [],
        now: NOW,
      },
    )
    assert.deepStrictEqual(result.minor, { name: 'dependencyName', version: '2.1.1' })
    assert.strictEqual(result.minorLatest, undefined)
  })

  test('minimumReleaseAgeExclude bypasses the age filter for a package', () => {
    const result = getPossibleUpgradesWithIgnoredVersions(
      ageTestData,
      '2.0.0',
      'dependencyName',
      undefined,
      {
        minimumReleaseAgeMinutes: 7 * 24 * 60,
        excludedPackages: ['dependencyName'],
        now: NOW,
      },
    )
    assert.deepStrictEqual(result.minor, { name: 'dependencyName', version: '2.1.1' })
    assert.strictEqual(result.minorLatest, undefined)
  })

  test('minimumReleaseAge of 0 disables the filter', () => {
    const result = getPossibleUpgradesWithIgnoredVersions(
      ageTestData,
      '2.0.0',
      'dependencyName',
      undefined,
      {
        minimumReleaseAgeMinutes: 0,
        excludedPackages: [],
        now: NOW,
      },
    )
    assert.deepStrictEqual(result.minor, { name: 'dependencyName', version: '2.1.1' })
    assert.strictEqual(result.minorLatest, undefined)
  })

  test('versions with missing publish time pass through the age filter', () => {
    const partialTimeData: NpmData = {
      'dist-tags': { latest: '2.1.1' },
      versions: {
        '2.0.0': { name: 'dependencyName', version: '2.0.0' },
        '2.1.1': { name: 'dependencyName', version: '2.1.1' },
      },
      time: {
        '2.0.0': iso(60 * DAYS),
        // 2.1.1 has no publish time — should not be hidden.
      },
    }
    const result = getPossibleUpgradesWithIgnoredVersions(
      partialTimeData,
      '2.0.0',
      'dependencyName',
      undefined,
      {
        minimumReleaseAgeMinutes: 7 * 24 * 60,
        excludedPackages: [],
        now: NOW,
      },
    )
    assert.deepStrictEqual(result.minor, { name: 'dependencyName', version: '2.1.1' })
    assert.strictEqual(result.minorLatest, undefined)
  })

  test('minimumReleaseAge held-back surfaces across major/minor/patch buckets independently', () => {
    const multiBucket: NpmData = {
      'dist-tags': { latest: '3.0.0' },
      versions: {
        '1.0.0': { name: 'dependencyName', version: '1.0.0' },
        '1.0.1': { name: 'dependencyName', version: '1.0.1' },
        '1.0.2': { name: 'dependencyName', version: '1.0.2' },
        '1.1.0': { name: 'dependencyName', version: '1.1.0' },
        '1.1.1': { name: 'dependencyName', version: '1.1.1' },
        '2.0.0': { name: 'dependencyName', version: '2.0.0' },
        '3.0.0': { name: 'dependencyName', version: '3.0.0' },
      },
      time: {
        '1.0.0': iso(60 * DAYS),
        '1.0.1': iso(30 * DAYS),
        '1.0.2': iso(1 * DAYS), // held back
        '1.1.0': iso(30 * DAYS),
        '1.1.1': iso(2 * DAYS), // held back
        '2.0.0': iso(30 * DAYS),
        '3.0.0': iso(3 * DAYS), // held back
      },
    }
    const result = getPossibleUpgradesWithIgnoredVersions(
      multiBucket,
      '1.0.0',
      'dependencyName',
      undefined,
      {
        minimumReleaseAgeMinutes: 7 * 24 * 60,
        excludedPackages: [],
        now: NOW,
      },
    )
    assert.deepStrictEqual(result.major, { name: 'dependencyName', version: '2.0.0' })
    assert.deepStrictEqual(result.majorLatest, { name: 'dependencyName', version: '3.0.0' })
    assert.deepStrictEqual(result.minor, { name: 'dependencyName', version: '1.1.0' })
    assert.deepStrictEqual(result.minorLatest, { name: 'dependencyName', version: '1.1.1' })
    assert.deepStrictEqual(result.patch, { name: 'dependencyName', version: '1.0.1' })
    assert.deepStrictEqual(result.patchLatest, { name: 'dependencyName', version: '1.0.2' })
  })

  test('minimumReleaseAge that filters out the whole bucket leaves eligible undefined but latest populated', () => {
    const allFresh: NpmData = {
      'dist-tags': { latest: '2.0.1' },
      versions: {
        '2.0.0': { name: 'dependencyName', version: '2.0.0' },
        '2.0.1': { name: 'dependencyName', version: '2.0.1' },
      },
      time: {
        '2.0.0': iso(2 * DAYS), // all patches are younger than threshold
        '2.0.1': iso(1 * DAYS),
      },
    }
    const result = getPossibleUpgradesWithIgnoredVersions(
      allFresh,
      '2.0.0',
      'dependencyName',
      undefined,
      {
        minimumReleaseAgeMinutes: 7 * 24 * 60,
        excludedPackages: [],
        now: NOW,
      },
    )
    assert.strictEqual(result.patch, undefined)
    assert.deepStrictEqual(result.patchLatest, { name: 'dependencyName', version: '2.0.1' })
  })
})

describe('isRegistryVersion', () => {
  test('plain semver ranges are fetched from the registry', () => {
    assert.strictEqual(isRegistryVersion('1.2.3'), true)
    assert.strictEqual(isRegistryVersion('^1.2.3'), true)
    assert.strictEqual(isRegistryVersion('~1.2.3'), true)
    assert.strictEqual(isRegistryVersion('>=1.2.3'), true)
    assert.strictEqual(isRegistryVersion('1.x'), true)
    assert.strictEqual(isRegistryVersion('1.2'), true)
    assert.strictEqual(isRegistryVersion('v1.2.3'), true)
    assert.strictEqual(isRegistryVersion('1.2.3-beta.1'), true)
    assert.strictEqual(isRegistryVersion('1.2.3 - 2.0.0'), true)
  })

  // workspace: refers to a local monorepo package, never the registry. All forms
  // must be skipped so they don't trigger a fetch and show "Dependency not found".
  test('all workspace: forms are skipped', () => {
    assert.strictEqual(isRegistryVersion('workspace:*'), false)
    assert.strictEqual(isRegistryVersion('workspace:^'), false)
    assert.strictEqual(isRegistryVersion('workspace:~'), false)
    assert.strictEqual(isRegistryVersion('workspace:whatever'), false)
    // These coerce to a valid semver, so they would slip through a naive coerce check.
    assert.strictEqual(isRegistryVersion('workspace:1.2.3'), false)
    assert.strictEqual(isRegistryVersion('workspace:^1.2.3'), false)
  })

  test('catalog: references are skipped', () => {
    // By the time refreshPackageJsonData calls this, resolvable catalog refs have
    // already been replaced with their real version. An unresolved "catalog:" must
    // not be fetched. "catalog:react17" coerces to "17.0.0", so a naive coerce
    // check would let it through.
    assert.strictEqual(isRegistryVersion('catalog:'), false)
    assert.strictEqual(isRegistryVersion('catalog:react17'), false)
  })

  // git/github/url/file specs embed a version that coerce() happily extracts (e.g.
  // "4.17.0" out of the github spec below), but they don't resolve from the
  // registry, so they must be skipped.
  test('git, github and url specs are skipped', () => {
    assert.strictEqual(isRegistryVersion('github:lodash/lodash#v4.17.0'), false)
    assert.strictEqual(isRegistryVersion('lodash/lodash#v4.17.0'), false)
    assert.strictEqual(isRegistryVersion('user/repo#semver:^1.2.3'), false)
    assert.strictEqual(isRegistryVersion('git+ssh://git@github.com/user/repo.git#1.2.3'), false)
    assert.strictEqual(isRegistryVersion('file:./foo.tgz'), false)
    assert.strictEqual(isRegistryVersion('npm:foo@1.2.3'), false)
  })

  // Bare wildcards and blanks aren't fetched today (there's no concrete version to
  // compare against); preserve that even though validRange normalizes them to "*".
  test('bare wildcards and empty versions are skipped', () => {
    assert.strictEqual(isRegistryVersion('*'), false)
    assert.strictEqual(isRegistryVersion('x'), false)
    assert.strictEqual(isRegistryVersion('X'), false)
    assert.strictEqual(isRegistryVersion(''), false)
    assert.strictEqual(isRegistryVersion('latest'), false)
  })
})
