import * as config from 'libnpmconfig'
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      conf = config
        .read(
          {
            // here we can override config
            // currently disable cache since it seems to be buggy with npm-registry-fetch
            // the bug was supposedly fixed here: https://github.com/npm/npm-registry-fetch/issues/23
            // but I still have issues, and not enough time to investigate
            // TODO: Investigate why the cache causes issues
            cache: null,
            // registry: 'https://registry.npmjs.org',
          },
          { cwd: packageJsonPath },
        )
        .toJSON() as npmRegistryFetch.Options
      packageJsonPathToConfMap[packageJsonPath] = conf
    }

    skippedNpmConfigLastTime = skipNpmConfig
  }
  return conf
}
