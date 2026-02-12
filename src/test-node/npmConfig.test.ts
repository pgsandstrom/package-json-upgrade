import { before, describe, test } from 'node:test'

import * as assert from 'assert'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { Config, setConfig } from '../config'
import { getNpmConfig } from '../npmConfig'

describe('npmConfig', () => {
  before(() => {
    const config: Config = {
      showUpdatesAtStart: true,
      showOverviewRulerColor: true,
      skipNpmConfig: false,
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

  test('should read registry from project .npmrc', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npmconfig-test-'))
    try {
      fs.writeFileSync(path.join(tmpDir, '.npmrc'), 'registry=https://custom.example.com/\n')
      const conf = getNpmConfig(path.join(tmpDir, 'package.json'))
      assert.strictEqual(conf.registry, 'https://custom.example.com/')
    } finally {
      fs.rmSync(tmpDir, { recursive: true })
    }
  })

  test('should read scoped registry from project .npmrc', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npmconfig-test-'))
    try {
      fs.writeFileSync(path.join(tmpDir, '.npmrc'), '@myorg:registry=https://npm.myorg.com/\n')
      const conf = getNpmConfig(path.join(tmpDir, 'package.json'))
      assert.strictEqual(conf['@myorg:registry'], 'https://npm.myorg.com/')
    } finally {
      fs.rmSync(tmpDir, { recursive: true })
    }
  })
})
