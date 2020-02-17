import * as config from 'libnpmconfig'
import { getConfig } from './config'

let skippedNpmConfig: boolean | undefined
let conf: unknown

export const getNpmConfig = () => {
  const skipNpmConfig = getConfig().skipNpmConfig
  if (skippedNpmConfig === undefined || skipNpmConfig !== skippedNpmConfig) {
    if (getConfig().skipNpmConfig) {
      conf = {}
      console.log('Defaulting to empty config')
    } else {
      conf = config.read({
        // here we can override config
        // currently disable cache since it seems to be buggy with npm-registry-fetch
        cache: null,
        // registry: 'https://registry.npmjs.org',
      })
      console.log(`read config from npm: ${JSON.stringify(conf)}`)
    }
    skippedNpmConfig = getConfig().skipNpmConfig
  }
  return conf
}
