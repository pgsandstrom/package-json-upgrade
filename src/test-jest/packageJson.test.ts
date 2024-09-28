import * as assert from 'assert'

import { readFileSync } from 'fs'
import { getPackageJsonDependencyInformation } from '../packageJson'

describe('packageJson', () => {
  test('should be able to correctly parse a simple package.json', () => {
    const packageJsonBuffer = readFileSync('./src/test-jest/testdata/package-test1.json')
    const packageJson = packageJsonBuffer.toString()
    const result = getPackageJsonDependencyInformation(packageJson)
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

  test('should be able to correctly parse another simple package.json', () => {
    const packageJsonBuffer = readFileSync('./src/test-jest/testdata/package-test2.json')
    const packageJson = packageJsonBuffer.toString()
    const result = getPackageJsonDependencyInformation(packageJson)
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
