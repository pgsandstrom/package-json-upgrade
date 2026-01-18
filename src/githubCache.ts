import * as vscode from 'vscode'

import { logError } from './log'

const GITHUB_CACHE_KEY = 'githubCache'

const TEST_CLEAR_CACHE_ON_STARTUP = false as boolean

const TTL_MIN_DAYS = 20
const TTL_MAX_DAYS = 40

const daysToMs = (days: number) => Math.floor(days * 24 * 60 * 60 * 1000)

const getRandomTtl = () => {
  const range = TTL_MAX_DAYS - TTL_MIN_DAYS
  const randomDays = TTL_MIN_DAYS + Math.random() * range
  return daysToMs(randomDays)
}

interface CacheEntry {
  value: boolean
  expiresAt: number
}

type CacheType = 'releases' | 'changelog'

type GithubCache = {
  [K in CacheType]: { [key: string]: CacheEntry | undefined }
}

let globalState: vscode.Memento | undefined

const getCache = (): GithubCache => {
  return globalState?.get<GithubCache>(GITHUB_CACHE_KEY) ?? { releases: {}, changelog: {} }
}

const saveCache = (cache: GithubCache) => {
  if (globalState === undefined) {
    return
  }
  void globalState.update(GITHUB_CACHE_KEY, cache)
}

const cleanExpiredEntries = () => {
  const cache = getCache()
  const now = Date.now()
  let changed = false

  const cleanedCache: GithubCache = { releases: {}, changelog: {} }

  for (const type of ['releases', 'changelog'] as const) {
    for (const [key, entry] of Object.entries(cache[type])) {
      if (entry !== undefined && entry.expiresAt >= now) {
        cleanedCache[type][key] = entry
      } else {
        changed = true
      }
    }
  }

  if (changed) {
    saveCache(cleanedCache)
  }
}

export const initGithubCache = (state: vscode.Memento) => {
  globalState = state

  if (TEST_CLEAR_CACHE_ON_STARTUP) {
    logError('CLEARING ENTIRE CACHE!!')
    globalState.update(GITHUB_CACHE_KEY, { releases: {}, changelog: {} })
  }

  cleanExpiredEntries()
}

export const getCacheEntry = (type: CacheType, repoKey: string): boolean | undefined => {
  const cache = getCache()
  const entry = cache[type][repoKey]
  if (entry === undefined || entry.expiresAt < Date.now()) {
    return undefined
  }
  return entry.value
}

export const setCacheEntry = (type: CacheType, repoKey: string, value: boolean) => {
  if (globalState === undefined) {
    return
  }
  const cache = getCache()
  cache[type][repoKey] = {
    value,
    expiresAt: Date.now() + getRandomTtl(),
  }
  saveCache(cache)
}
