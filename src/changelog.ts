import { getCacheEntry, setCacheEntry } from './githubCache'
import { logDebug, logError } from './log'
import { NpmData } from './npm'

export const getChangelogUrl = (homepage: string | undefined): string | undefined => {
  if (homepage === undefined) {
    return undefined
  }
  const regexResult = /(https?:\/\/github\.com\/([-\w.]+)\/([-\w.]+))(#[-\w/.]*)?/.exec(homepage)
  if (regexResult === null) {
    return undefined
  }
  const baseGithubUrl = regexResult[1]
  const repoKey = `${regexResult[2]}/${regexResult[3]}`

  if (getCacheEntry('changelog', repoKey) === true) {
    return `${baseGithubUrl}/blob/master/CHANGELOG.md`
  }
  if (getCacheEntry('releases', repoKey) === true) {
    return `${baseGithubUrl}/releases`
  }
  return undefined
}

export const retrieveAndCacheChangelog = async (npmData: NpmData) => {
  if (npmData.homepage === undefined) {
    return
  }
  const regexResult = /(https?:\/\/github\.com\/([-\w.]+)\/([-\w.]+))(#[-\w/.]*)?/.exec(
    npmData.homepage,
  )
  if (regexResult == null) {
    return
  }

  const baseGithubUrl = regexResult[1]
  const repoKey = `${regexResult[2]}/${regexResult[3]}`

  const cachedChangelog = getCacheEntry('changelog', repoKey)
  // If we have CHANGELOG.md cached, return it
  if (cachedChangelog === true) {
    return `${baseGithubUrl}/blob/master/CHANGELOG.md`
  }

  // If no CHANGELOG.md cache is present, fetch it
  if (cachedChangelog === undefined) {
    const gotChangelog = await retrieveChangelog(repoKey, baseGithubUrl)
    if (gotChangelog) {
      return
    }
  }

  // this is the case where CHANGELOG.md doesnt exist. Check for release page.

  const cachedReleases = getCacheEntry('releases', repoKey)
  if (cachedReleases === true) {
    return `${baseGithubUrl}/releases`
  }
  if (cachedReleases === false) {
    return undefined
  }

  // Release page not cached, need to fetch
  await retrieveReleasePage(repoKey, baseGithubUrl)
}

const retrieveChangelog = async (repoKey: string, baseGithubUrl: string): Promise<boolean> => {
  try {
    const changelogUrl = `${baseGithubUrl}/blob/master/CHANGELOG.md`
    const response = await fetch(changelogUrl)
    logDebug(`fetched CHANGELOG.md for ${baseGithubUrl}, got ${response.status}`)
    if (response.status >= 200 && response.status < 300) {
      setCacheEntry('changelog', repoKey, true)
      return true
    } else if (response.status === 404) {
      // No CHANGELOG.md found, cache that and check releases
      setCacheEntry('changelog', repoKey, false)
    }
  } catch (e) {
    logError(`fetch CHANGELOG.md for ${baseGithubUrl} threw error`, e)
  }
  return false
}

const retrieveReleasePage = async (repoKey: string, baseGithubUrl: string): Promise<boolean> => {
  try {
    const apiUrl = `https://api.github.com/repos/${repoKey}/releases?per_page=1`
    const response = await fetch(apiUrl, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'package-json-upgrade-vscode',
      },
    })
    logDebug(`fetched release page for ${baseGithubUrl}, got ${response.status}`)
    if (response.status >= 200 && response.status < 300) {
      const releases = (await response.json()) as unknown[]
      if (Array.isArray(releases) && releases.length > 0) {
        setCacheEntry('releases', repoKey, true)
        return true
      }
      setCacheEntry('releases', repoKey, false)
    }
  } catch (e) {
    logError(`fetch release page for ${baseGithubUrl} threw error`, e)
  }
  return false
}
