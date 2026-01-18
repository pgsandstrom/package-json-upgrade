import { getCacheEntry, setCacheEntry } from './githubCache'
import { githubFetch } from './githubGateway'
import { logDebug, logError } from './log'
import { NpmData } from './npm'

export const getChangelogUrl = (npmData: NpmData): string | undefined => {
  const githubUrl = getGithubUrl(npmData)
  if (githubUrl === undefined) {
    return undefined
  }
  const regexResult = /https?:\/\/github\.com\/([-\w.]+)\/([-\w.]+)/.exec(githubUrl)
  if (regexResult === null) {
    return undefined
  }
  const repoKey = `${regexResult[1]}/${regexResult[2]}`

  if (getCacheEntry('changelog', repoKey) === true) {
    return `${githubUrl}/blob/master/CHANGELOG.md`
  }
  if (getCacheEntry('releases', repoKey) === true) {
    return `${githubUrl}/releases`
  }
  return undefined
}

export const retrieveAndCacheChangelog = async (npmData: NpmData) => {
  const githubUrl = getGithubUrl(npmData)
  if (githubUrl === undefined) {
    return
  }
  const regexResult = /https?:\/\/github\.com\/([-\w.]+)\/([-\w.]+)/.exec(githubUrl)
  if (regexResult == null) {
    return
  }

  const baseGithubUrl = githubUrl
  const repoKey = `${regexResult[1]}/${regexResult[2]}`

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
  const changelogUrl = `${baseGithubUrl}/blob/master/CHANGELOG.md`
  const result = await githubFetch(changelogUrl)

  if (result.status === 'rate-limited') {
    logDebug(`skipping CHANGELOG.md fetch for ${baseGithubUrl} due to rate limit`)
    return false
  }

  if (result.status === 'error') {
    logError(`fetch CHANGELOG.md for ${baseGithubUrl} threw error`, result.error)
    return false
  }

  const response = result.response
  logDebug(`fetched CHANGELOG.md for ${baseGithubUrl}, got ${response.status}`)
  if (response.status >= 200 && response.status < 300) {
    setCacheEntry('changelog', repoKey, true)
    return true
  } else if (response.status === 404) {
    // No CHANGELOG.md found, cache that and check releases
    setCacheEntry('changelog', repoKey, false)
  }
  return false
}

const retrieveReleasePage = async (repoKey: string, baseGithubUrl: string): Promise<boolean> => {
  const apiUrl = `https://api.github.com/repos/${repoKey}/releases?per_page=1`
  const result = await githubFetch(apiUrl, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'package-json-upgrade-vscode',
    },
  })

  if (result.status === 'rate-limited') {
    logDebug(`skipping release page fetch for ${baseGithubUrl} due to rate limit`)
    return false
  }

  if (result.status === 'error') {
    logError(`fetch release page for ${baseGithubUrl} threw error`, result.error)
    return false
  }

  const response = result.response
  logDebug(`fetched release page for ${baseGithubUrl}, got ${response.status}`)
  if (response.status >= 200 && response.status < 300) {
    const releases = (await response.json()) as unknown[]
    if (Array.isArray(releases) && releases.length > 0) {
      setCacheEntry('releases', repoKey, true)
      return true
    }
    setCacheEntry('releases', repoKey, false)
  }
  return false
}

/**
 * Extracts the GitHub URL from npm package data.
 * Tries homepage first, then falls back to the repository field.
 * Handles various repository URL formats:
 * - git+https://github.com/owner/repo.git
 * - git://github.com/owner/repo.git
 * - https://github.com/owner/repo
 * - github:owner/repo
 * - git+ssh://git@github.com/owner/repo.git
 */
export const getGithubUrl = (npmData: NpmData): string | undefined => {
  // Try homepage first
  if (npmData.homepage !== undefined) {
    const match = /https?:\/\/github\.com\/[\w.-]+\/[\w.-]+/.exec(npmData.homepage)
    if (match) {
      return match[0]
    }
  }

  // Fall back to repository field
  const repoUrl =
    typeof npmData.repository === 'string' ? npmData.repository : npmData.repository?.url

  if (repoUrl === undefined) {
    return undefined
  }

  // Handle URLs containing github.com (various formats)
  // Capture repo name including dots (e.g., next.js), then strip .git suffix if present
  const githubMatch = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/.exec(repoUrl)
  if (githubMatch) {
    return `https://github.com/${githubMatch[1]}/${githubMatch[2]}`
  }

  // Handle "github:owner/repo" shorthand
  const shortMatch = /^github:([^/]+)\/(.+)$/.exec(repoUrl)
  if (shortMatch) {
    return `https://github.com/${shortMatch[1]}/${shortMatch[2]}`
  }

  return undefined
}
