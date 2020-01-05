import * as vscode from 'vscode'

interface Config {
  showUpdatesAtStart: boolean
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
  }

  currentConfig = newConfig
}
