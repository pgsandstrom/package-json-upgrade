import * as assert from 'assert'

import { getPossibleUpgrades, NpmData, DependencyUpdateInfo } from '../../npm'

const testRofl: NpmData = {
  'dist-tags': {
    latest: '1.1.0',
  },
  versions: {
    '1.0.0': {
      name: 'test1',
      version: '1.0.0',
    },
    '1.0.1': {
      name: 'test1',
      version: '1.0.1',
    },
    '1.1.0': {
      name: 'test1',
      version: '1.1.0',
    },
    '1.1.1': {
      name: 'test1',
      version: '1.1.1',
    },
    '2.0.0-alpha.1': {
      name: 'test1',
      version: '2.0.0-alpha.1',
    },
    '2.0.0-alpha.2': {
      name: 'test1',
      version: '2.0.0-alpha.2',
    },
    '2.0.0': {
      name: 'test1',
      version: '2.0.0',
    },
    '2.1.0': {
      name: 'test1',
      version: '2.1.0',
    },
    '2.1.1': {
      name: 'test1',
      version: '2.1.1',
    },
    '3.0.0-alpha.1': {
      name: 'test1',
      version: '3.0.0-alpha.1',
    },
    '3.0.0-alpha.2': {
      name: 'test1',
      version: '3.0.0-alpha.2',
    },
  },
  repository: {
    type: 'git',
    url: 'git://asdf.com/asdf.git',
  },
}

suite('Npm Test Suite', () => {
  test('Major upgrade', () => {
    const result: DependencyUpdateInfo = getPossibleUpgrades(testRofl, '1.1.1')
    const expected: DependencyUpdateInfo = {
      major: { name: 'test1', version: '2.1.1' },
      minor: undefined,
      patch: undefined,
      prerelease: undefined,
      validVersion: true,
    }
    assert.deepStrictEqual(result, expected)
  })

  test('Minor upgrade', () => {
    const result: DependencyUpdateInfo = getPossibleUpgrades(testRofl, '2.0.0')
    const expected: DependencyUpdateInfo = {
      major: undefined,
      minor: { name: 'test1', version: '2.1.1' },
      patch: undefined,
      prerelease: undefined,
      validVersion: true,
    }
    assert.deepStrictEqual(result, expected)
  })

  test('Patch upgrade', () => {
    const result: DependencyUpdateInfo = getPossibleUpgrades(testRofl, '2.1.0')
    const expected: DependencyUpdateInfo = {
      major: undefined,
      minor: undefined,
      patch: { name: 'test1', version: '2.1.1' },
      prerelease: undefined,
      validVersion: true,
    }
    assert.deepStrictEqual(result, expected)
  })

  test('Many upgrades', () => {
    const result: DependencyUpdateInfo = getPossibleUpgrades(testRofl, '1.0.0')
    const expected: DependencyUpdateInfo = {
      major: { name: 'test1', version: '2.1.1' },
      minor: { name: 'test1', version: '1.1.1' },
      patch: { name: 'test1', version: '1.0.1' },
      prerelease: undefined,
      validVersion: true,
    }
    assert.deepStrictEqual(result, expected)
  })

  test('Invalid version', () => {
    const result: DependencyUpdateInfo = getPossibleUpgrades(testRofl, 'tjena')
    const expected: DependencyUpdateInfo = {
      validVersion: false,
    }
    assert.deepStrictEqual(result, expected)
  })

  test('Prerelease upgrade', () => {
    const result: DependencyUpdateInfo = getPossibleUpgrades(testRofl, '3.0.0-alpha.1')
    const expected: DependencyUpdateInfo = {
      major: undefined,
      minor: undefined,
      patch: undefined,
      prerelease: { name: 'test1', version: '3.0.0-alpha.2' },
      validVersion: true,
    }
    assert.deepEqual(result, expected)
  })

  test('Prerelease upgrade to final', () => {
    const result: DependencyUpdateInfo = getPossibleUpgrades(testRofl, '2.0.0-alpha.1')
    const expected: DependencyUpdateInfo = {
      major: undefined,
      minor: undefined,
      patch: undefined,
      prerelease: { name: 'test1', version: '2.0.0' },
      validVersion: true,
    }
    assert.deepEqual(result, expected)
  })
})
