import * as vscode from 'vscode'
import * as assert from 'assert'

import { updateAll } from '../../updateAll'
import { setCachedNpmData } from '../../npm'
import { AsyncState } from '../../types'
import { Config, setConfig } from '../../config'

const packageJsonTestContent = `
{
  "dependencies": {
  },
  "devDependencies": {
    "@emotion/babel-plugin": "^11.0.0-next.12"
  }
}
`

const npmCache = {
  '@emotion/babel-plugin': {
    asyncstate: AsyncState.Fulfilled,
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

suite('UpdateAll Test Suite', () => {
  test('When all releases are prereleases', async function () {
    const config: Config = {
      showUpdatesAtStart: true,
      skipNpmConfig: true,
      majorUpgradeColorOverwrite: '',
      minorUpgradeColorOverwrite: '',
      patchUpgradeColorOverwrite: '',
      prereleaseUpgradeColorOverwrite: '',
      decorationString: '',
      ignorePatterns: [],
      ignoreVersions: {},
    }
    setConfig(config)

    this.timeout(0)
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

    setCachedNpmData(npmCache)

    const result = updateAll(textDocument)

    assert.deepStrictEqual(JSON.stringify(result), JSON.stringify(expected))
  })
})
