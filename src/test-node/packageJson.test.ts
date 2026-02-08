import { before, describe, test } from 'node:test'

import * as assert from 'assert'
import { readFileSync } from 'fs'

import { Config, getConfig, setConfig } from '../config'
import { getDependencyInformation } from '../packageJson'

describe('packageJson', () => {
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
    }
    setConfig(config)
  })

  test('should be able to correctly parse a simple package.json', () => {
    const packageJsonBuffer = readFileSync('./src/test-node/testdata/package-test1.json')
    const packageJson = packageJsonBuffer.toString()
    const result = getDependencyInformation(packageJson)
    const dependencies = result.map((r) => r.deps).flat()
    if (
      !dependencies.some(
        (dep) =>
          dep.dependencyName === 'npm-registry-fetch' &&
          dep.currentVersion === '12.0.0' &&
          dep.line === 22,
      )
    ) {
      assert.fail('did not find npm-registry-fetch')
    }

    if (
      !dependencies.some(
        (dep) =>
          dep.dependencyName === '@types/npm-registry-fetch' &&
          dep.currentVersion === '8.0.4' &&
          dep.line === 30,
      )
    ) {
      assert.fail('did not find @types/npm-registry-fetch')
    }

    assert.ok('nice')
  })

  test('should respect dependencyGroups config for custom groups', () => {
    const packageJson = JSON.stringify({
      name: 'test',
      dependencies: {
        lodash: '4.17.21',
      },
      devDependencies: {
        typescript: '5.0.0',
      },
      peerDependencies: {
        react: '18.2.0',
      },
      optionalDependencies: {
        fsevents: '2.3.3',
      },
    })

    // Default config: only dependencies + devDependencies
    const defaultResult = getDependencyInformation(packageJson)
    const defaultDeps = defaultResult.map((r) => r.deps).flat()
    assert.strictEqual(defaultResult.length, 2)
    assert.ok(defaultDeps.some((d) => d.dependencyName === 'lodash'))
    assert.ok(defaultDeps.some((d) => d.dependencyName === 'typescript'))
    assert.ok(!defaultDeps.some((d) => d.dependencyName === 'react'))
    assert.ok(!defaultDeps.some((d) => d.dependencyName === 'fsevents'))

    // Include peerDependencies and optionalDependencies
    setConfig({
      ...getConfig(),
      dependencyGroups: [
        'dependencies',
        'devDependencies',
        'peerDependencies',
        'optionalDependencies',
      ],
    })

    const expandedResult = getDependencyInformation(packageJson)
    const expandedDeps = expandedResult.map((r) => r.deps).flat()
    assert.strictEqual(expandedResult.length, 4)
    assert.ok(expandedDeps.some((d) => d.dependencyName === 'lodash'))
    assert.ok(expandedDeps.some((d) => d.dependencyName === 'typescript'))
    assert.ok(expandedDeps.some((d) => d.dependencyName === 'react'))
    assert.ok(expandedDeps.some((d) => d.dependencyName === 'fsevents'))

    // Only peerDependencies
    setConfig({
      ...getConfig(),
      dependencyGroups: ['peerDependencies'],
    })

    const peerOnlyResult = getDependencyInformation(packageJson)
    const peerOnlyDeps = peerOnlyResult.map((r) => r.deps).flat()
    assert.strictEqual(peerOnlyResult.length, 1)
    assert.strictEqual(peerOnlyDeps.length, 1)
    assert.strictEqual(peerOnlyDeps[0].dependencyName, 'react')

    // Restore default config
    setConfig({
      ...getConfig(),
      dependencyGroups: ['dependencies', 'devDependencies'],
    })
  })

  test('should be able to correctly parse another simple package.json', () => {
    const packageJsonBuffer = readFileSync('./src/test-node/testdata/package-test2.json')
    const packageJson = packageJsonBuffer.toString()
    const result = getDependencyInformation(packageJson)
    assert.deepStrictEqual(result, [
      {
        deps: [
          { currentVersion: '7.2.0', dependencyName: '@types/glob', line: 12 },
          { currentVersion: '2.6.7', dependencyName: 'node-fetch', line: 13 },
        ],
        startLine: 11,
      },
    ])
  })
})
