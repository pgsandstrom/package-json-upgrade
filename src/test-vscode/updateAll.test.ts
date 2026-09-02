/// <reference types="mocha" />
import * as assert from 'assert'
import * as vscode from 'vscode'

import { Config, setConfig } from '../config'
import { CacheItem, NpmLoader, setCachedNpmData } from '../npm'
import { AsyncState, Dict } from '../types'
import { updateAll } from '../updateAll'

const packageJsonTestContent = `
{
  "dependencies": {
  },
  "devDependencies": {
    "@emotion/babel-plugin": "^11.0.0-next.12"
  }
}
`

const workspaceFileDependencyLine = `  '@emotion/babel-plugin': ^11.0.0-next.12`

const workspaceFileTestContent = `packages:
  - 'packages/*'

catalog:
${workspaceFileDependencyLine}
`

const createConfig = (dependencyGroups: string[]): Config => {
  return {
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
}

// A fresh cache per test. The extension is active while these tests run, so it will
// happily replace entries in whatever cache object we hand it.
const createNpmCache = (): Dict<string, NpmLoader<CacheItem>> => {
  return {
    '@emotion/babel-plugin': {
      asyncstate: AsyncState.Fulfilled,
      startTime: 0,
      item: {
        date: new Date('2020-09-14T11:01:26.768Z'),
        npmData: {
          'dist-tags': { next: '11.0.0-next.10', latest: '11.0.0-next.17' },
          versions: {
            '11.0.0-next.10': {
              name: '@emotion/babel-plugin',
              version: '11.0.0-next.10',
            },
            '11.0.0-next.11': {
              name: '@emotion/babel-plugin',
              version: '11.0.0-next.11',
            },
            '11.0.0-next.12': {
              name: '@emotion/babel-plugin',
              version: '11.0.0-next.12',
            },
            '11.0.0-next.13': {
              name: '@emotion/babel-plugin',
              version: '11.0.0-next.13',
            },
            '11.0.0-next.15': {
              name: '@emotion/babel-plugin',
              version: '11.0.0-next.15',
            },
            '11.0.0-next.16': {
              name: '@emotion/babel-plugin',
              version: '11.0.0-next.16',
            },
            '11.0.0-next.17': {
              name: '@emotion/babel-plugin',
              version: '11.0.0-next.17',
            },
          },
          homepage: 'https://emotion.sh',
        },
      },
    },
  }
}

suite('UpdateAll Test Suite', () => {
  test('When all releases are prereleases', async function () {
    setConfig(createConfig(['dependencies', 'devDependencies']))

    const uri = vscode.Uri.parse(`./tmp/package.json`)
    await vscode.workspace.fs.writeFile(uri, Buffer.from(packageJsonTestContent))
    const packageJsonTest = await vscode.workspace.openTextDocument(uri)
    const textDocument = await vscode.window.showTextDocument(packageJsonTest)

    const expected = [
      {
        range: [
          { line: 5, character: 0 },
          { line: 5, character: 46 },
        ],
        text: '    "@emotion/babel-plugin": "^11.0.0-next.17"',
      },
    ]

    setCachedNpmData(createNpmCache())

    const result = updateAll(textDocument)

    assert.deepStrictEqual(JSON.stringify(result), JSON.stringify(expected))
  })

  test('When updating a catalog in pnpm-workspace.yaml', async function () {
    setConfig(createConfig(['dependencies', 'devDependencies', 'catalog', 'catalogs']))

    const uri = vscode.Uri.parse(`./tmp/pnpm-workspace.yaml`)
    await vscode.workspace.fs.writeFile(uri, Buffer.from(workspaceFileTestContent))
    const workspaceFileTest = await vscode.workspace.openTextDocument(uri)
    const textDocument = await vscode.window.showTextDocument(workspaceFileTest)

    const expected = [
      {
        range: [
          { line: 4, character: 0 },
          { line: 4, character: workspaceFileDependencyLine.length },
        ],
        text: `  '@emotion/babel-plugin': ^11.0.0-next.17`,
      },
    ]

    setCachedNpmData(createNpmCache())

    const result = updateAll(textDocument)

    assert.deepStrictEqual(JSON.stringify(result), JSON.stringify(expected))
  })
})
