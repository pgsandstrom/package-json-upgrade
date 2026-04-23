import { before, describe, test } from 'node:test'

import * as assert from 'assert'
import { readFileSync } from 'fs'
import * as path from 'path'

import { Config, getConfig, setConfig } from '../config'
import { getDependencyInformation } from '../packageJson'
import { clearWorkspaceCache } from '../workspace'

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

  test('should support catalog section and skip catalog: version references', () => {
    setConfig({
      ...getConfig(),
      dependencyGroups: ['dependencies', 'devDependencies', 'catalog'],
    })

    const packageJson = JSON.stringify({
      name: 'test',
      catalog: {
        lodash: '4.17.21',
        react: '18.2.0',
      },
      dependencies: {
        lodash: 'catalog:',
        react: 'catalog:',
        express: '4.18.2',
      },
      devDependencies: {
        typescript: '5.0.0',
      },
    })

    const result = getDependencyInformation(packageJson)
    const allDeps = result.map((r) => r.deps).flat()

    // catalog entries with real versions should be included
    assert.ok(allDeps.some((d) => d.dependencyName === 'lodash' && d.currentVersion === '4.17.21'))
    assert.ok(allDeps.some((d) => d.dependencyName === 'react' && d.currentVersion === '18.2.0'))

    // dependencies with "catalog:" references should be filtered out
    assert.ok(
      !allDeps.some((d) => d.dependencyName === 'lodash' && d.currentVersion === 'catalog:'),
    )
    assert.ok(!allDeps.some((d) => d.dependencyName === 'react' && d.currentVersion === 'catalog:'))

    // regular dependencies should still work
    assert.ok(allDeps.some((d) => d.dependencyName === 'express' && d.currentVersion === '4.18.2'))
    assert.ok(
      allDeps.some((d) => d.dependencyName === 'typescript' && d.currentVersion === '5.0.0'),
    )

    // named catalog references like "catalog:default" should also be filtered
    const packageJsonNamed = JSON.stringify({
      name: 'test',
      dependencies: {
        lodash: 'catalog:default',
      },
    })

    setConfig({
      ...getConfig(),
      dependencyGroups: ['dependencies'],
    })

    const namedResult = getDependencyInformation(packageJsonNamed)
    const namedDeps = namedResult.map((r) => r.deps).flat()
    assert.strictEqual(namedDeps.length, 0)

    // Restore default config
    setConfig({
      ...getConfig(),
      dependencyGroups: ['dependencies', 'devDependencies'],
    })
  })

  test('should support catalogs section with arbitrarily named catalogs', () => {
    setConfig({
      ...getConfig(),
      dependencyGroups: ['dependencies', 'catalogs'],
    })

    const packageJson = JSON.stringify({
      name: 'test',
      catalogs: {
        default: {
          lodash: '4.17.21',
        },
        react17: {
          react: '^17.0.2',
          'react-dom': '^17.0.2',
        },
      },
      dependencies: {
        lodash: 'catalog:',
        react: 'catalog:react17',
      },
    })

    const result = getDependencyInformation(packageJson)
    const allDeps = result.map((r) => r.deps).flat()

    assert.ok(allDeps.some((d) => d.dependencyName === 'lodash' && d.currentVersion === '4.17.21'))
    assert.ok(allDeps.some((d) => d.dependencyName === 'react' && d.currentVersion === '^17.0.2'))
    assert.ok(
      allDeps.some((d) => d.dependencyName === 'react-dom' && d.currentVersion === '^17.0.2'),
    )
    assert.ok(!allDeps.some((d) => d.currentVersion === 'catalog:'))
    assert.ok(!allDeps.some((d) => d.currentVersion === 'catalog:react17'))

    setConfig({
      ...getConfig(),
      dependencyGroups: ['dependencies', 'devDependencies'],
    })
  })

  test('should support dot-path dependency groups for nested workspace catalogs', () => {
    setConfig({
      ...getConfig(),
      dependencyGroups: ['dependencies', 'workspaces.catalog', 'workspaces.catalogs'],
    })

    const packageJson = JSON.stringify({
      name: 'test',
      workspaces: {
        catalog: {
          axios: '^1.11.0',
        },
        catalogs: {
          legacy: {
            react: '^17.0.2',
          },
        },
      },
      dependencies: {
        axios: 'catalog:',
        react: 'catalog:legacy',
      },
    })

    const result = getDependencyInformation(packageJson)
    const allDeps = result.map((r) => r.deps).flat()

    assert.ok(allDeps.some((d) => d.dependencyName === 'axios' && d.currentVersion === '^1.11.0'))
    assert.ok(allDeps.some((d) => d.dependencyName === 'react' && d.currentVersion === '^17.0.2'))
    assert.ok(!allDeps.some((d) => d.currentVersion === 'catalog:'))
    assert.ok(!allDeps.some((d) => d.currentVersion === 'catalog:legacy'))

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

  test('should skip workspace dependencies when no packageJsonPath is provided', () => {
    setConfig({
      ...getConfig(),
      dependencyGroups: ['dependencies'],
    })

    const packageJson = JSON.stringify({
      name: 'test',
      dependencies: {
        lodash: 'workspace:*',
        express: '4.18.2',
      },
    })

    const result = getDependencyInformation(packageJson)
    const deps = result.map((r) => r.deps).flat()

    assert.strictEqual(deps.length, 1)
    assert.strictEqual(deps[0].dependencyName, 'express')

    setConfig({
      ...getConfig(),
      dependencyGroups: ['dependencies', 'devDependencies'],
    })
  })

  test('should resolve workspace dependencies when packageJsonPath is provided', () => {
    clearWorkspaceCache()
    setConfig({
      ...getConfig(),
      dependencyGroups: ['dependencies'],
    })

    const packageJson = JSON.stringify({
      name: 'consumer',
      dependencies: {
        'pkg-a': 'workspace:*',
        'pkg-b': 'workspace:^',
        express: '4.18.2',
      },
    })

    const packageJsonPath = path.resolve('./src/test-node/testdata/packages/consumer/package.json')
    const result = getDependencyInformation(packageJson, packageJsonPath)
    const deps = result.map((r) => r.deps).flat()

    assert.strictEqual(deps.length, 3)

    const pkgA = deps.find((d) => d.dependencyName === 'pkg-a')
    assert.ok(pkgA)
    assert.strictEqual(pkgA.currentVersion, '1.0.0')
    assert.strictEqual(pkgA.isWorkspace, true)

    const pkgB = deps.find((d) => d.dependencyName === 'pkg-b')
    assert.ok(pkgB)
    assert.strictEqual(pkgB.currentVersion, '2.5.0')
    assert.strictEqual(pkgB.isWorkspace, true)

    const express = deps.find((d) => d.dependencyName === 'express')
    assert.ok(express)
    assert.strictEqual(express.currentVersion, '4.18.2')
    assert.strictEqual(express.isWorkspace, undefined)

    setConfig({
      ...getConfig(),
      dependencyGroups: ['dependencies', 'devDependencies'],
    })
  })

  test('should skip workspace dependencies that cannot be resolved', () => {
    clearWorkspaceCache()
    setConfig({
      ...getConfig(),
      dependencyGroups: ['dependencies'],
    })

    const packageJson = JSON.stringify({
      name: 'consumer',
      dependencies: {
        'non-existent-pkg': 'workspace:*',
        express: '4.18.2',
      },
    })

    const packageJsonPath = path.resolve('./src/test-node/testdata/packages/consumer/package.json')
    const result = getDependencyInformation(packageJson, packageJsonPath)
    const deps = result.map((r) => r.deps).flat()

    assert.strictEqual(deps.length, 1)
    assert.strictEqual(deps[0].dependencyName, 'express')

    setConfig({
      ...getConfig(),
      dependencyGroups: ['dependencies', 'devDependencies'],
    })
  })

  test('should resolve catalog dependencies from pnpm-workspace.yaml when packageJsonPath is provided', () => {
    clearWorkspaceCache()
    setConfig({
      ...getConfig(),
      dependencyGroups: ['dependencies'],
    })

    const packageJson = JSON.stringify({
      name: 'consumer',
      dependencies: {
        react: 'catalog:',
        lodash: 'catalog:default',
        axios: 'catalog:default',
        express: '4.18.2',
      },
    })

    const packageJsonPath = path.resolve(
      './src/test-node/testdata/catalog-workspace/packages/consumer/package.json',
    )
    const result = getDependencyInformation(packageJson, packageJsonPath)
    const deps = result.map((r) => r.deps).flat()

    assert.strictEqual(deps.length, 4)

    const react = deps.find((d) => d.dependencyName === 'react')
    assert.ok(react)
    assert.strictEqual(react.currentVersion, '^19.2.5')
    assert.strictEqual(react.isCatalog, true)

    const lodash = deps.find((d) => d.dependencyName === 'lodash')
    assert.ok(lodash)
    assert.strictEqual(lodash.currentVersion, '4.17.21')
    assert.strictEqual(lodash.isCatalog, true)

    const axios = deps.find((d) => d.dependencyName === 'axios')
    assert.ok(axios)
    assert.strictEqual(axios.currentVersion, '^1.11.0')
    assert.strictEqual(axios.isCatalog, true)

    const express = deps.find((d) => d.dependencyName === 'express')
    assert.ok(express)
    assert.strictEqual(express.currentVersion, '4.18.2')
    assert.strictEqual(express.isCatalog, undefined)

    setConfig({
      ...getConfig(),
      dependencyGroups: ['dependencies', 'devDependencies'],
    })
  })

  test('should resolve named catalog dependencies from pnpm-workspace.yaml', () => {
    clearWorkspaceCache()
    setConfig({
      ...getConfig(),
      dependencyGroups: ['dependencies'],
    })

    const packageJson = JSON.stringify({
      name: 'consumer',
      dependencies: {
        react: 'catalog:legacy',
        'react-dom': 'catalog:legacy',
      },
    })

    const packageJsonPath = path.resolve(
      './src/test-node/testdata/catalog-workspace/packages/consumer/package.json',
    )
    const result = getDependencyInformation(packageJson, packageJsonPath)
    const deps = result.map((r) => r.deps).flat()

    assert.strictEqual(deps.length, 2)

    const react = deps.find((d) => d.dependencyName === 'react')
    assert.ok(react)
    assert.strictEqual(react.currentVersion, '^17.0.2')
    assert.strictEqual(react.isCatalog, true)

    const reactDom = deps.find((d) => d.dependencyName === 'react-dom')
    assert.ok(reactDom)
    assert.strictEqual(reactDom.currentVersion, '^17.0.2')
    assert.strictEqual(reactDom.isCatalog, true)

    setConfig({
      ...getConfig(),
      dependencyGroups: ['dependencies', 'devDependencies'],
    })
  })

  test('should skip catalog dependencies when packageJsonPath is not provided', () => {
    setConfig({
      ...getConfig(),
      dependencyGroups: ['dependencies'],
    })

    const packageJson = JSON.stringify({
      name: 'test',
      dependencies: {
        react: 'catalog:',
        express: '4.18.2',
      },
    })

    const result = getDependencyInformation(packageJson)
    const deps = result.map((r) => r.deps).flat()

    assert.strictEqual(deps.length, 1)
    assert.strictEqual(deps[0].dependencyName, 'express')

    setConfig({
      ...getConfig(),
      dependencyGroups: ['dependencies', 'devDependencies'],
    })
  })
})
