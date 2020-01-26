import * as vscode from 'vscode'

interface Config {
  showUpdatesAtStart: boolean
  majorUpgradeColorOverwrite: string
  minorUpgradeColorOverwrite: string
  patchUpgradeColorOverwrite: string
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
    majorUpgradeColorOverwrite: config.get<string>('majorUpgradeColorOverwrite') ?? '',
    minorUpgradeColorOverwrite: config.get<string>('minorUpgradeColorOverwrite') ?? '',
    patchUpgradeColorOverwrite: config.get<string>('patchUpgradeColorOverwrite') ?? '',
  }

  currentConfig = newConfig
}
