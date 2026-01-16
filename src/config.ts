export interface Config {
  showUpdatesAtStart: boolean
  showOverviewRulerColor: boolean
  skipNpmConfig: boolean
  majorUpgradeColorOverwrite: string
  minorUpgradeColorOverwrite: string
  patchUpgradeColorOverwrite: string
  prereleaseUpgradeColorOverwrite: string
  decorationString: string
  ignorePatterns: string[]
  ignoreVersions: Record<string, string | undefined | string[]>
  msUntilRowLoading: number
}

let currentConfig: Config | undefined

export const getConfig = (): Config => {
  if (currentConfig === undefined) {
    throw new Error('config should be loaded')
  }
  return currentConfig
}

export const setConfig = (newConfig: Config) => {
  currentConfig = newConfig
}
