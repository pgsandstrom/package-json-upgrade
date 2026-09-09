import { beforeEach, describe, test } from 'node:test'

import * as assert from 'assert'
import { readFileSync } from 'fs'

import { Config, getConfig, setConfig } from '../config'
import { Dependency } from '../packageJson'
import {
  getWorkspaceFileDependencyInformation,
  isPnpmWorkspaceFile,
  replaceVersionInWorkspaceLine,
} from '../pnpmWorkspaceFile'

const setDependencyGroups = (dependencyGroups: string[]) => {
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
    dependencyGroups,
    minimumReleaseAge: 0,
    minimumReleaseAgeExclude: [],
  }
  setConfig(config)
}

const getDependencies = (yamlAsString: string): Dependency[] => {
  return getWorkspaceFileDependencyInformation(yamlAsString)
    .map((group) => group.deps)
    .flat()
}

const getDependency = (yamlAsString: string, dependencyName: string): Dependency => {
  const dependency = getDependencies(yamlAsString).find(
    (dep) => dep.dependencyName === dependencyName,
  )
  assert.ok(dependency !== undefined, `did not find dependency ${dependencyName}`)
  return dependency
}

// A document that looks like something a real project would have
const fullWorkspaceFile = `packages:
  - 'packages/*'
  - "apps/*"

# The versions everything should use
catalog:
  react: ^19.2.5
  lodash: 4.17.21
  '@types/node': ^22.0.0

catalogs:
  legacy:
    react: ^17.0.2
    "react-dom": ^17.0.2
  next:
    react: 20.0.0-beta.1
`

describe('pnpmWorkspaceFile', () => {
  beforeEach(() => {
    setDependencyGroups(['catalog', 'catalogs'])
  })

  test('should find every dependency of a full workspace file', () => {
    const dependencies = getDependencies(fullWorkspaceFile)
    assert.strictEqual(dependencies.length, 6)

    assert.deepStrictEqual(getDependency(fullWorkspaceFile, 'lodash'), {
      dependencyName: 'lodash',
      currentVersion: '4.17.21',
      line: 7,
    })
    assert.deepStrictEqual(getDependency(fullWorkspaceFile, '@types/node'), {
      dependencyName: '@types/node',
      currentVersion: '^22.0.0',
      line: 8,
    })
    assert.deepStrictEqual(getDependency(fullWorkspaceFile, 'react-dom'), {
      dependencyName: 'react-dom',
      currentVersion: '^17.0.2',
      line: 13,
    })
  })

  test('should place the group start line on the section key', () => {
    const groups = getWorkspaceFileDependencyInformation(fullWorkspaceFile)
    assert.strictEqual(groups.length, 2)
    // "catalog:" and "catalogs:"
    assert.deepStrictEqual(
      groups.map((group) => group.startLine),
      [5, 10],
    )
  })

  test('should give every occurrence of the same dependency its own line', () => {
    const dependencies = getDependencies(fullWorkspaceFile).filter(
      (dep) => dep.dependencyName === 'react',
    )
    assert.deepStrictEqual(dependencies, [
      { dependencyName: 'react', currentVersion: '^19.2.5', line: 6 },
      { dependencyName: 'react', currentVersion: '^17.0.2', line: 12 },
      { dependencyName: 'react', currentVersion: '20.0.0-beta.1', line: 15 },
    ])
  })

  test('should handle the same dependency having the same version several times', () => {
    const yamlAsString = `catalog:
  react: ^19.2.5
catalogs:
  legacy:
    react: ^19.2.5
`
    assert.deepStrictEqual(getDependencies(yamlAsString), [
      { dependencyName: 'react', currentVersion: '^19.2.5', line: 1 },
      { dependencyName: 'react', currentVersion: '^19.2.5', line: 4 },
    ])
  })

  test('should not be confused by named catalogs written before the default catalog', () => {
    const yamlAsString = `catalogs:
  legacy:
    react: ^17.0.2
catalog:
  react: ^19.2.5
`
    assert.deepStrictEqual(getDependencies(yamlAsString), [
      { dependencyName: 'react', currentVersion: '^19.2.5', line: 4 },
      { dependencyName: 'react', currentVersion: '^17.0.2', line: 2 },
    ])
  })

  test('should not confuse a catalog name with a dependency of the same name', () => {
    const yamlAsString = `catalog:
  legacy: ^1.0.0
catalogs:
  legacy:
    react: ^19.2.5
`
    assert.deepStrictEqual(getDependencies(yamlAsString), [
      { dependencyName: 'legacy', currentVersion: '^1.0.0', line: 1 },
      { dependencyName: 'react', currentVersion: '^19.2.5', line: 4 },
    ])
  })

  test('should handle quoted keys and quoted versions', () => {
    const yamlAsString = `catalog:
  "lodash": '4.17.21'
  '@types/node': "^22.0.0"
`
    assert.deepStrictEqual(getDependencies(yamlAsString), [
      { dependencyName: 'lodash', currentVersion: '4.17.21', line: 1 },
      { dependencyName: '@types/node', currentVersion: '^22.0.0', line: 2 },
    ])
  })

  test('should handle comments on and around dependency lines', () => {
    const yamlAsString = `# our dependencies
catalog:
  # the ui stuff
  react: ^19.2.5 # pinned to 19.2.5 on purpose

  lodash: 4.17.21
`
    assert.deepStrictEqual(getDependencies(yamlAsString), [
      { dependencyName: 'react', currentVersion: '^19.2.5', line: 3 },
      { dependencyName: 'lodash', currentVersion: '4.17.21', line: 5 },
    ])
  })

  test('should handle windows line breaks', () => {
    const yamlAsString = 'catalog:\r\n  react: ^19.2.5\r\n  lodash: 4.17.21\r\n'
    assert.deepStrictEqual(getDependencies(yamlAsString), [
      { dependencyName: 'react', currentVersion: '^19.2.5', line: 1 },
      { dependencyName: 'lodash', currentVersion: '4.17.21', line: 2 },
    ])
  })

  test('should handle indentation that is not two spaces', () => {
    const yamlAsString = `catalogs:
    legacy:
        react: ^17.0.2
`
    assert.deepStrictEqual(getDependencies(yamlAsString), [
      { dependencyName: 'react', currentVersion: '^17.0.2', line: 2 },
    ])
  })

  test('should not pick up dependency lookalikes outside of the dependency groups', () => {
    const yamlAsString = `packages:
  - 'packages/*'
onlyBuiltDependencies:
  - esbuild
someOtherSection:
  react: ^19.2.5
catalog:
  lodash: 4.17.21
`
    assert.deepStrictEqual(getDependencies(yamlAsString), [
      { dependencyName: 'lodash', currentVersion: '4.17.21', line: 7 },
    ])
  })

  test('should follow the dependencyGroups config', () => {
    const yamlAsString = `catalog:
  react: ^19.2.5
overrides:
  lodash: 4.17.21
`
    assert.deepStrictEqual(getDependencies(yamlAsString), [
      { dependencyName: 'react', currentVersion: '^19.2.5', line: 1 },
    ])

    setDependencyGroups(['catalog', 'catalogs', 'overrides'])
    assert.deepStrictEqual(getDependencies(yamlAsString), [
      { dependencyName: 'react', currentVersion: '^19.2.5', line: 1 },
      { dependencyName: 'lodash', currentVersion: '4.17.21', line: 3 },
    ])
  })

  test('should ignore dependency groups that are not in the file', () => {
    setDependencyGroups(['dependencies', 'devDependencies', 'catalog', 'catalogs'])
    const yamlAsString = `catalog:
  react: ^19.2.5
`
    const groups = getWorkspaceFileDependencyInformation(yamlAsString)
    assert.strictEqual(groups.length, 1)
    assert.strictEqual(groups[0].startLine, 0)
  })

  test('should keep an empty catalog as a group without dependencies', () => {
    const groups = getWorkspaceFileDependencyInformation(`catalog: {}\n`)
    assert.deepStrictEqual(groups, [{ startLine: 0, deps: [] }])
  })

  test('should skip dependencies without a line of their own', () => {
    // Flow style mappings are valid yaml, but there is no line to decorate
    const groups = getWorkspaceFileDependencyInformation(`catalog: { react: ^19.2.5 }\n`)
    assert.deepStrictEqual(groups, [{ startLine: 0, deps: [] }])
  })

  test('should skip values that are not strings', () => {
    const yamlAsString = `catalog:
  react: ^19.2.5
  lodash:
    - 4.17.21
`
    assert.deepStrictEqual(getDependencies(yamlAsString), [
      { dependencyName: 'react', currentVersion: '^19.2.5', line: 1 },
    ])
  })

  test('should return nothing for a file without dependency groups', () => {
    const yamlAsString = `packages:
  - 'packages/*'
`
    assert.deepStrictEqual(getWorkspaceFileDependencyInformation(yamlAsString), [])
  })

  test('should return nothing for invalid yaml', () => {
    assert.deepStrictEqual(
      getWorkspaceFileDependencyInformation('catalog:\n  react: ^19.2.5\n :\n- }{'),
      [],
    )
  })

  test('should return nothing for an empty file', () => {
    assert.deepStrictEqual(getWorkspaceFileDependencyInformation(''), [])
  })

  test('should return nothing for yaml that is not a mapping', () => {
    assert.deepStrictEqual(getWorkspaceFileDependencyInformation('- one\n- two\n'), [])
  })

  test('should handle the pnpm-workspace.yaml used by the other tests', () => {
    const yamlAsString = readFileSync(
      './src/test-node/testdata/catalog-workspace/pnpm-workspace.yaml',
    ).toString()

    assert.deepStrictEqual(getDependencies(yamlAsString), [
      { dependencyName: 'react', currentVersion: '^19.2.5', line: 4 },
      { dependencyName: 'lodash', currentVersion: '4.17.21', line: 5 },
      { dependencyName: 'axios', currentVersion: '^1.11.0', line: 9 },
      { dependencyName: 'react', currentVersion: '^17.0.2', line: 11 },
      { dependencyName: 'react-dom', currentVersion: '^17.0.2', line: 12 },
    ])
  })

  test('should not touch the config it reads', () => {
    const groupsBefore = [...getConfig().dependencyGroups]
    getWorkspaceFileDependencyInformation(fullWorkspaceFile)
    assert.deepStrictEqual(getConfig().dependencyGroups, groupsBefore)
  })

  describe('replaceVersionInWorkspaceLine', () => {
    test('should replace the version of a plain line', () => {
      assert.strictEqual(
        replaceVersionInWorkspaceLine('  react: ^19.2.5', '19.2.5', '19.3.0'),
        '  react: ^19.3.0',
      )
    })

    test('should replace the version and not a trailing comment repeating it', () => {
      assert.strictEqual(
        replaceVersionInWorkspaceLine(
          '  react: ^19.2.5 # see https://github.com/facebook/react/releases/tag/v19.2.5',
          '19.2.5',
          '19.3.0',
        ),
        '  react: ^19.3.0 # see https://github.com/facebook/react/releases/tag/v19.2.5',
      )
      assert.strictEqual(
        replaceVersionInWorkspaceLine(
          '  lodash: 4.17.21 # pinned to 4.17.21 until we drop node 14',
          '4.17.21',
          '4.18.0',
        ),
        '  lodash: 4.18.0 # pinned to 4.17.21 until we drop node 14',
      )
    })

    test('should replace the version of a quoted key and a quoted version', () => {
      assert.strictEqual(
        replaceVersionInWorkspaceLine(`  '@types/node': "^22.0.0" # 22.0.0`, '22.0.0', '23.1.0'),
        `  '@types/node': "^23.1.0" # 22.0.0`,
      )
    })

    test('should not be confused by a key that contains the version', () => {
      assert.strictEqual(
        replaceVersionInWorkspaceLine('  react-19.2.5: ^19.2.5', '19.2.5', '19.3.0'),
        '  react-19.2.5: ^19.3.0',
      )
    })

    test('should leave the line alone when the version is not in the value', () => {
      assert.strictEqual(
        replaceVersionInWorkspaceLine('  react: ^19.2.5', '1.0.0', '2.0.0'),
        '  react: ^19.2.5',
      )
    })

    test('should leave a line that is not a key line alone', () => {
      assert.strictEqual(
        replaceVersionInWorkspaceLine('  - react@19.2.5', '19.2.5', '19.3.0'),
        '  - react@19.2.5',
      )
    })
  })

  describe('isPnpmWorkspaceFile', () => {
    const check = (fileName: string) => {
      return isPnpmWorkspaceFile({ fileName } as Parameters<typeof isPnpmWorkspaceFile>[0])
    }

    test('should recognize pnpm workspace files', () => {
      assert.strictEqual(check('/home/user/project/pnpm-workspace.yaml'), true)
      assert.strictEqual(check('C:\\work\\project\\pnpm-workspace.yaml'), true)
      assert.strictEqual(check('pnpm-workspace.yaml'), true)
    })

    test('should not recognize pnpm-workspace.yml, which pnpm does not read', () => {
      assert.strictEqual(check('/home/user/project/pnpm-workspace.yml'), false)
      assert.strictEqual(check('C:\\work\\project\\pnpm-workspace.yml'), false)
    })

    test('should not recognize other files', () => {
      assert.strictEqual(check('/home/user/project/package.json'), false)
      assert.strictEqual(check('/home/user/project/docker-compose.yaml'), false)
      assert.strictEqual(check('/home/user/project/my-pnpm-workspace.yaml'), false)
      assert.strictEqual(check('/home/user/pnpm-workspace.yaml/package.json'), false)
    })
  })
})
