import * as vscode from 'vscode'

interface Config {
  showUpdatesAtStart: boolean
  skipNpmConfig: boolean
  majorUpgradeColorOverwrite: string
  minorUpgradeColorOverwrite: string
  patchUpgradeColorOverwrite: string
  prereleaseUpgradeColorOverwrite: string
  decorationString: string
  ignorePatterns: string[]
  ignoreVersions: Record<string, string | undefined>
}

let currentConfig: Config | undefined

export const getConfig = (): Config => {
  if (currentConfig === undefined) {
    reloadConfig()
  }
  return currentConfig as Config
}

export const reloadConfig = () => {
  const config = vscode.workspace.getConfiguration('package-json-upgrade')
  const newConfig: Config = {
    showUpdatesAtStart: config.get<boolean>('showUpdatesAtStart') === true,
    skipNpmConfig: config.get<boolean>('skipNpmConfig') === true,
    majorUpgradeColorOverwrite: config.get<string>('majorUpgradeColorOverwrite') ?? '',
    minorUpgradeColorOverwrite: config.get<string>('minorUpgradeColorOverwrite') ?? '',
    patchUpgradeColorOverwrite: config.get<string>('patchUpgradeColorOverwrite') ?? '',
    prereleaseUpgradeColorOverwrite: config.get<string>('prereleaseUpgradeColorOverwrite') ?? '',
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    decorationString: config.get<string>('decorationString') || '\t\tUpdate available: %s',
    ignorePatterns: config.get<string[]>('ignorePatterns') ?? [],
    ignoreVersions: config.get<Record<string, string | undefined>>('ignoreVersions') ?? {},
  }

  currentConfig = newConfig
}
