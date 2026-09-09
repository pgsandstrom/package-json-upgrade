/// <reference types="mocha" />
import * as assert from 'assert'
import * as vscode from 'vscode'

import { Config, setConfig } from '../config'
import { CacheItem, NpmLoader, setCachedNpmData } from '../npm'
import { clearDecorations, getDecoratedLines } from '../texteditor'
import { AsyncState, Dict } from '../types'

const packageJsonContent = `{
  "dependencies": {
    "lodash": "^4.17.0"
  }
}
`

const workspaceFileContent = `packages:
  - 'packages/*'

catalog:
  lodash: ^4.17.0
`

const createConfig = (): Config => {
  return {
    showUpdatesAtStart: true,
    showOverviewRulerColor: true,
    skipNpmConfig: true,
    majorUpgradeColorOverwrite: '',
    minorUpgradeColorOverwrite: '',
    patchUpgradeColorOverwrite: '',
    prereleaseUpgradeColorOverwrite: '',
    decorationString: '\t-> %s',
    ignorePatterns: [],
    ignoreVersions: {},
    msUntilRowLoading: 0,
    dependencyGroups: ['dependencies', 'devDependencies', 'catalog', 'catalogs'],
    minimumReleaseAge: 0,
    minimumReleaseAgeExclude: [],
  }
}

// The date has to be recent, or refreshDependencies considers the entry stale and
// starts a real network fetch.
const createNpmCache = (): Dict<string, NpmLoader<CacheItem>> => {
  return {
    lodash: {
      asyncstate: AsyncState.Fulfilled,
      startTime: 0,
      item: {
        date: new Date(),
        npmData: {
          'dist-tags': { latest: '4.17.21' },
          versions: {
            '4.17.0': { name: 'lodash', version: '4.17.0' },
            '4.17.21': { name: 'lodash', version: '4.17.21' },
          },
        },
      },
    },
  }
}

const waitForDecorations = async (documents: vscode.TextDocument[]) => {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    if (documents.every((document) => getDecoratedLines(document).length > 0)) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }

  const undecorated = documents
    .filter((document) => getDecoratedLines(document).length === 0)
    .map((document) => document.fileName)
  assert.fail(`timed out waiting for decorations, still undecorated: ${undecorated.join(', ')}`)
}

const openInColumn = async (path: string, content: string, column: vscode.ViewColumn) => {
  const uri = vscode.Uri.parse(path)
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content))
  const document = await vscode.workspace.openTextDocument(uri)
  await vscode.window.showTextDocument(document, column)
  return document
}

suite('Decoration repaint Test Suite', () => {
  test('A visible file keeps its decorations when another file is focused', async function () {
    // Painting is asynchronous, so the assertions poll. Outlast that poll, or a
    // failure shows up as a mocha timeout instead of saying which file went blank.
    this.timeout(20000)

    setConfig(createConfig())
    setCachedNpmData(createNpmCache())

    const packageJson = await openInColumn(
      './tmp/repaint/package.json',
      packageJsonContent,
      vscode.ViewColumn.One,
    )
    const workspaceFile = await openInColumn(
      './tmp/repaint/pnpm-workspace.yaml',
      workspaceFileContent,
      vscode.ViewColumn.Two,
    )

    // Opening the second file has to leave the first one decorated. Waiting for both
    // here also means no paint from opening them is still in flight, so what the
    // assertions below see can only have been painted by the focus change.
    await waitForDecorations([packageJson, workspaceFile])

    clearDecorations()

    // Focusing one of the two used to clear every decoration and then repaint only
    // the focused file, leaving the other one blank for as long as it stayed open.
    await vscode.window.showTextDocument(packageJson, vscode.ViewColumn.One)

    await waitForDecorations([packageJson, workspaceFile])

    assert.deepStrictEqual(getDecoratedLines(packageJson), [2])
    assert.deepStrictEqual(getDecoratedLines(workspaceFile), [4])
  })
})
