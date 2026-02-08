import npmConf from '@pnpm/npm-conf'
import * as npmRegistryFetch from 'npm-registry-fetch'

import { getConfig } from './config'
import { Dict } from './types'

let skippedNpmConfigLastTime: boolean | undefined

const packageJsonPathToConfMap: Dict<string, npmRegistryFetch.Options> = {}

export const getNpmConfig = (packageJsonPath: string): npmRegistryFetch.Options => {
  let conf = packageJsonPathToConfMap[packageJsonPath]
  const skipNpmConfig = getConfig().skipNpmConfig
  if (conf === undefined || skipNpmConfig !== skippedNpmConfigLastTime) {
    if (skipNpmConfig) {
      conf = {}
    } else {
      const result = npmConf({
        // currently disable cache since it seems to be buggy with npm-registry-fetch
        // the bug was supposedly fixed here: https://github.com/npm/npm-registry-fetch/issues/23
        // but I still have issues, and not enough time to investigate
        // TODO: Investigate why the cache causes issues
        // Maybe we can use cache when we can finally update npm-registry-fetch (currently resting at v14 due to esm issues)
        cache: null,
        prefix: packageJsonPath,
      })
      conf = result.config.snapshot as npmRegistryFetch.Options
      packageJsonPathToConfMap[packageJsonPath] = conf
    }

    skippedNpmConfigLastTime = skipNpmConfig
  }
  return conf
}
