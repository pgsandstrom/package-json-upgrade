import { after, before, describe, test } from 'node:test'

import * as assert from 'assert'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { Config, setConfig } from '../config'
import { getNpmConfig } from '../npmConfig'

describe('npmConfig', () => {
  // `npm run` (and some CI setups) inject npm_config_* env vars that take precedence over .npmrc files
  const savedEnv: Record<string, string | undefined> = {}

  before(() => {
    for (const key of Object.keys(process.env)) {
      if (/^npm_config_/i.test(key)) {
        savedEnv[key] = process.env[key]
        Reflect.deleteProperty(process.env, key)
      }
    }

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
      minimumReleaseAge: 0,
      minimumReleaseAgeExclude: [],
      changelogUrls: {},
    }
    setConfig(config)
  })

  after(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      process.env[key] = value
    }
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
