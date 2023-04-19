export interface Config {
  showUpdatesAtStart: boolean
  skipNpmConfig: boolean
  majorUpgradeColorOverwrite: string
  minorUpgradeColorOverwrite: string
  patchUpgradeColorOverwrite: string
  prereleaseUpgradeColorOverwrite: string
  decorationString: string
  ignorePatterns: string[]
  ignoreVersions: Record<string, string | undefined | string[]>
}

let currentConfig: Config | undefined

export const getConfig = (): Config => {
  if (currentConfig === undefined) {
    throw 'config should be loaded'
  }
  return currentConfig
}

export const setConfig = (newConfig: Config) => {
  currentConfig = newConfig
}
