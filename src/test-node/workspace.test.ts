import { before, describe, test } from 'node:test'

import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

import { clearWorkspaceCache, resolveWorkspaceVersion } from '../workspace'

const testdataDir = path.resolve('./src/test-node/testdata')

const writeYaml = (content: string) => {
  fs.writeFileSync(path.join(testdataDir, 'pnpm-workspace.yaml'), content)
  clearWorkspaceCache()
}

const restoreYaml = () => {
  fs.writeFileSync(
    path.join(testdataDir, 'pnpm-workspace.yaml'),
    'packages:\n  - \'packages/*\'\n  - "apps/*"\n  - components/**\n',
  )
  clearWorkspaceCache()
}

describe('workspace', () => {
  before(() => {
    clearWorkspaceCache()
  })

  test('should return undefined for non-workspace versions', () => {
    const result = resolveWorkspaceVersion(
      '^1.2.3',
      'some-pkg',
      path.join(testdataDir, 'dummy.json'),
    )
    assert.strictEqual(result, undefined)
  })

  test('should resolve workspace:* to the local package version', () => {
    const result = resolveWorkspaceVersion(
      'workspace:*',
      'pkg-a',
      path.join(testdataDir, 'packages', 'consumer', 'package.json'),
    )
    assert.deepStrictEqual(result, { version: '1.0.0', isWorkspace: true })
  })

  test('should resolve workspace:^ to the local package version', () => {
    const result = resolveWorkspaceVersion(
      'workspace:^',
      'pkg-b',
      path.join(testdataDir, 'packages', 'consumer', 'package.json'),
    )
    assert.deepStrictEqual(result, { version: '2.5.0', isWorkspace: true })
  })

  test('should resolve workspace:~ to the local package version', () => {
    const result = resolveWorkspaceVersion(
      'workspace:~',
      'app',
      path.join(testdataDir, 'packages', 'consumer', 'package.json'),
    )
    assert.deepStrictEqual(result, { version: '0.1.0', isWorkspace: true })
  })

  test('should resolve workspace:1.2.3 to the explicit version', () => {
    const result = resolveWorkspaceVersion(
      'workspace:1.2.3',
      'pkg-a',
      path.join(testdataDir, 'packages', 'consumer', 'package.json'),
    )
    assert.deepStrictEqual(result, { version: '1.2.3', isWorkspace: true })
  })

  test('should resolve workspace:^1.2.3 to the explicit version', () => {
    const result = resolveWorkspaceVersion(
      'workspace:^1.2.3',
      'pkg-a',
      path.join(testdataDir, 'packages', 'consumer', 'package.json'),
    )
    assert.deepStrictEqual(result, { version: '^1.2.3', isWorkspace: true })
  })

  test('should resolve deep workspace packages with ** glob', () => {
    const result = resolveWorkspaceVersion(
      'workspace:*',
      'button',
      path.join(testdataDir, 'packages', 'consumer', 'package.json'),
    )
    assert.deepStrictEqual(result, { version: '3.0.0-beta.1', isWorkspace: true })
  })

  test('should return undefined when workspace package is not found', () => {
    const result = resolveWorkspaceVersion(
      'workspace:*',
      'non-existent-pkg',
      path.join(testdataDir, 'packages', 'consumer', 'package.json'),
    )
    assert.strictEqual(result, undefined)
  })

  test('should return undefined when no pnpm-workspace.yaml exists', () => {
    const result = resolveWorkspaceVersion(
      'workspace:*',
      'pkg-a',
      path.join('/tmp', 'no-workspace', 'package.json'),
    )
    assert.strictEqual(result, undefined)
  })

  test('should handle yaml with comments and mixed quotes', () => {
    writeYaml(`packages:
  # main packages
  - 'packages/*'
  - "apps/*"
  # components are nested
  - components/**
`)

    const result = resolveWorkspaceVersion(
      'workspace:*',
      'pkg-b',
      path.join(testdataDir, 'packages', 'consumer', 'package.json'),
    )
    assert.deepStrictEqual(result, { version: '2.5.0', isWorkspace: true })

    restoreYaml()
  })

  test('should handle empty packages array', () => {
    writeYaml('packages:\n')

    const result = resolveWorkspaceVersion(
      'workspace:*',
      'pkg-a',
      path.join(testdataDir, 'packages', 'consumer', 'package.json'),
    )
    assert.strictEqual(result, undefined)

    restoreYaml()
  })

  test('should use cache on repeated lookups', () => {
    clearWorkspaceCache()

    const first = resolveWorkspaceVersion(
      'workspace:*',
      'pkg-a',
      path.join(testdataDir, 'packages', 'consumer', 'package.json'),
    )
    assert.deepStrictEqual(first, { version: '1.0.0', isWorkspace: true })

    const second = resolveWorkspaceVersion(
      'workspace:*',
      'pkg-b',
      path.join(testdataDir, 'packages', 'consumer', 'package.json'),
    )
    assert.deepStrictEqual(second, { version: '2.5.0', isWorkspace: true })
  })
})
