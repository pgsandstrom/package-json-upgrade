import { before, describe, test } from 'node:test'

import * as assert from 'assert'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { clearWorkspaceCache, resolveCatalogVersion } from '../workspace'

const testdataDir = path.resolve('./src/test-node/testdata')
const catalogWorkspaceDir = path.resolve('./src/test-node/testdata/catalog-workspace')
const catalogWorkspaceFile = path.join(catalogWorkspaceDir, 'pnpm-workspace.yaml')

describe('workspace', () => {
  before(() => {
    clearWorkspaceCache()
  })

  test('should resolve catalog: to default catalog entry', () => {
    const result = resolveCatalogVersion(
      'catalog:',
      'react',
      path.join(catalogWorkspaceDir, 'packages', 'consumer', 'package.json'),
    )
    assert.deepStrictEqual(result, {
      version: '^19.2.5',
      isCatalog: true,
      definition: { filePath: catalogWorkspaceFile, line: 4 },
    })
  })

  test('should resolve catalog:default to default catalog entry', () => {
    const result = resolveCatalogVersion(
      'catalog:default',
      'lodash',
      path.join(catalogWorkspaceDir, 'packages', 'consumer', 'package.json'),
    )
    assert.deepStrictEqual(result, {
      version: '4.17.21',
      isCatalog: true,
      definition: { filePath: catalogWorkspaceFile, line: 5 },
    })
  })

  test('should resolve catalog:legacy to named catalog entry', () => {
    const result = resolveCatalogVersion(
      'catalog:legacy',
      'react',
      path.join(catalogWorkspaceDir, 'packages', 'consumer', 'package.json'),
    )
    assert.deepStrictEqual(result, {
      version: '^17.0.2',
      isCatalog: true,
      definition: { filePath: catalogWorkspaceFile, line: 12 },
    })
  })

  test('should resolve catalog:legacy for scoped package', () => {
    const result = resolveCatalogVersion(
      'catalog:legacy',
      'react-dom',
      path.join(catalogWorkspaceDir, 'packages', 'consumer', 'package.json'),
    )
    // The key is quoted in the file, so the line scan has to unquote it to match
    // the name js-yaml gives us.
    assert.deepStrictEqual(result, {
      version: '^17.0.2',
      isCatalog: true,
      definition: { filePath: catalogWorkspaceFile, line: 13 },
    })
  })

  test('should resolve a catalog entry that yaml would otherwise read as a number', () => {
    const result = resolveCatalogVersion(
      'catalog:',
      'typescript',
      path.join(catalogWorkspaceDir, 'packages', 'consumer', 'package.json'),
    )
    // 5.10, not the 5.1 that reading it as a number would give
    assert.deepStrictEqual(result, {
      version: '5.10',
      isCatalog: true,
      definition: { filePath: catalogWorkspaceFile, line: 6 },
    })
  })

  test('should point at the entry under catalogs.default', () => {
    const result = resolveCatalogVersion(
      'catalog:',
      'axios',
      path.join(catalogWorkspaceDir, 'packages', 'consumer', 'package.json'),
    )
    assert.deepStrictEqual(result, {
      version: '^1.11.0',
      isCatalog: true,
      definition: { filePath: catalogWorkspaceFile, line: 10 },
    })
  })

  test('should resolve a flow style catalog entry but offer no line to go to', () => {
    // The line scan goes by indentation, so it finds no line of its own for an entry
    // written inside a flow mapping. The version still resolves - we just have
    // nowhere to send anyone who wants to look at it.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'package-json-upgrade-'))
    const packageJsonPath = path.join(dir, 'packages', 'consumer', 'package.json')

    try {
      fs.writeFileSync(path.join(dir, 'pnpm-workspace.yaml'), 'catalog: { react: ^19.2.5 }\n')

      assert.deepStrictEqual(resolveCatalogVersion('catalog:', 'react', packageJsonPath), {
        version: '^19.2.5',
        isCatalog: true,
        definition: undefined,
      })
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
      clearWorkspaceCache()
    }
  })

  test('should return undefined for missing catalog entry', () => {
    const result = resolveCatalogVersion(
      'catalog:',
      'non-existent-pkg',
      path.join(testdataDir, 'packages', 'consumer', 'package.json'),
    )
    assert.strictEqual(result, undefined)
  })

  test('should return undefined for missing named catalog', () => {
    const result = resolveCatalogVersion(
      'catalog:missing',
      'react',
      path.join(testdataDir, 'packages', 'consumer', 'package.json'),
    )
    assert.strictEqual(result, undefined)
  })

  test('should return undefined when no pnpm-workspace.yaml exists', () => {
    const result = resolveCatalogVersion(
      'catalog:',
      'react',
      path.join('/tmp', 'no-workspace', 'package.json'),
    )
    assert.strictEqual(result, undefined)
  })

  test('should return undefined for non-catalog versions', () => {
    const result = resolveCatalogVersion('^1.2.3', 'react', path.join(testdataDir, 'dummy.json'))
    assert.strictEqual(result, undefined)
  })

  test('should ignore a pnpm-workspace.yml, which pnpm does not read', () => {
    // ws-yml only contains a pnpm-workspace.yml, and its catalog does have react. Ignoring that
    // file means the search walks on up to testdata/pnpm-workspace.yaml, which has no catalog.
    const result = resolveCatalogVersion(
      'catalog:',
      'react',
      path.join(testdataDir, 'ws-yml', 'packages', 'consumer', 'package.json'),
    )
    assert.strictEqual(result, undefined)
  })

  test('should pick up a pnpm-workspace.yaml created after the first lookup', () => {
    // We cache the workspace roots we find, but never the ones we do not. Caching a
    // miss would mean a package.json opened before its workspace file exists keeps
    // resolving catalog: to nothing until the window is reloaded.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'package-json-upgrade-'))
    const packageJsonPath = path.join(dir, 'packages', 'consumer', 'package.json')

    try {
      // No workspace file yet. Asserting on a dependency rather than on the root
      // itself keeps this true even if some ancestor of the temp dir has one.
      assert.strictEqual(resolveCatalogVersion('catalog:', 'react', packageJsonPath), undefined)

      fs.writeFileSync(path.join(dir, 'pnpm-workspace.yaml'), 'catalog:\n  react: ^19.2.5\n')

      assert.deepStrictEqual(resolveCatalogVersion('catalog:', 'react', packageJsonPath), {
        version: '^19.2.5',
        isCatalog: true,
        definition: { filePath: path.join(dir, 'pnpm-workspace.yaml'), line: 1 },
      })
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
      clearWorkspaceCache()
    }
  })

  test('should resolve a catalog with a duplicate key to the last of them', () => {
    // Without the json option js-yaml throws over the duplicate, and a package.json
    // next to this file would resolve none of its catalog: refs. Last wins, which is
    // the entry pnpm installs, and matches what we decorate in the workspace file.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'package-json-upgrade-'))
    const packageJsonPath = path.join(dir, 'packages', 'consumer', 'package.json')

    try {
      fs.writeFileSync(
        path.join(dir, 'pnpm-workspace.yaml'),
        'catalog:\n  react: ^19.0.0\n  lodash: 4.17.21\n  react: ^19.2.5\n',
      )

      // Line 3 is the last of the two react entries, so the version we resolved and
      // the line we would send someone to describe the same entry.
      assert.deepStrictEqual(resolveCatalogVersion('catalog:', 'react', packageJsonPath), {
        version: '^19.2.5',
        isCatalog: true,
        definition: { filePath: path.join(dir, 'pnpm-workspace.yaml'), line: 3 },
      })
      assert.deepStrictEqual(resolveCatalogVersion('catalog:', 'lodash', packageJsonPath), {
        version: '4.17.21',
        isCatalog: true,
        definition: { filePath: path.join(dir, 'pnpm-workspace.yaml'), line: 2 },
      })
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
      clearWorkspaceCache()
    }
  })

  test('should gracefully handle invalid yaml', () => {
    const catalogResult = resolveCatalogVersion(
      'catalog:',
      'react',
      path.join(testdataDir, 'ws-invalid', 'packages', 'consumer', 'package.json'),
    )
    assert.strictEqual(catalogResult, undefined)
  })
})
