import * as assert from 'assert'

import { readFileSync } from 'fs'
import { getPnpmWorkspaceDependencyInformation } from '../pnpm'

describe('pnpmWorkspace', () => {
  test('should be able to correctly parse a simple pnpm-workspace.yaml', () => {
    const pnpmWorkspaceBuffer = readFileSync('./src/test-jest/testdata/pnpm-workspace-test1.yaml')
    const pnpmWorkspace = pnpmWorkspaceBuffer.toString()
    const result = getPnpmWorkspaceDependencyInformation(pnpmWorkspace)
    const dependencies = result.map((r) => r.deps).flat()
    if (
      !dependencies.some(
        (dep) =>
          dep.dependencyName === 'npm-registry-fetch' &&
          dep.currentVersion === '12.0.0' &&
          dep.line === 8,
      )
    ) {
      assert.fail('did not find npm-registry-fetch')
    }

    if (
      !dependencies.some(
        (dep) =>
          dep.dependencyName === '@types/npm-registry-fetch' &&
          dep.currentVersion === '8.0.4' &&
          dep.line === 17,
      )
    ) {
      assert.fail('did not find @types/npm-registry-fetch')
    }

    assert.ok('nice')
  })
})
