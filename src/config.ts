import * as vscode from 'vscode'

interface Config {
  showUpdatesAtStart: boolean
  skipNpmConfig: boolean
  majorUpgradeColorOverwrite: string
  minorUpgradeColorOverwrite: string
  patchUpgradeColorOverwrite: string
  prereleaseUpgradeColorOverwrite: string
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
  }

  currentConfig = newConfig
}
