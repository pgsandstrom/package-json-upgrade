import * as assert from 'assert'

import {
  getPossibleUpgrades,
  NpmData,
  DependencyUpdateInfo,
  getPossibleUpgradesWithIgnoredVersions,
  getLatestVersionWithIgnoredVersions,
  VersionData,
} from '../../npm'

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

suite('Npm Test Suite', () => {
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
      major: undefined,
      minor: { name: 'dependencyName', version: '2.1.1' },
      patch: undefined,
      prerelease: { name: 'dependencyName', version: '2.0.0' },
      validVersion: true,
      existingVersion: true,
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
})
