import { logDebug } from './log'

interface RateLimitState {
  retryAfter?: number // timestamp (ms) when we can retry
}

const rateLimitState: RateLimitState = {}

// Promise chain to serialize requests
let pending: Promise<void> = Promise.resolve()

export type GithubFetchResult =
  | { status: 'success'; response: Response }
  | { status: 'rate-limited' }
  | { status: 'error'; error: unknown }

export function githubFetch(url: string, init?: RequestInit): Promise<GithubFetchResult> {
  const resultPromise = pending.then(() => doFetch(url, init))
  // Chain continues regardless of success/failure
  pending = resultPromise.then(
    () => {},
    () => {},
  )
  return resultPromise
}

async function doFetch(url: string, init?: RequestInit): Promise<GithubFetchResult> {
  // If in backoff period, don't even try
  if (rateLimitState.retryAfter !== undefined && Date.now() < rateLimitState.retryAfter) {
    const waitSeconds = Math.ceil((rateLimitState.retryAfter - Date.now()) / 1000)
    logDebug(`GitHub rate limited, waiting ${waitSeconds}s before retrying`)
    return { status: 'rate-limited' }
  }

  try {
    const response = await fetch(url, init)

    // Check rate limit headers
    const remaining = response.headers.get('X-RateLimit-Remaining')
    const reset = response.headers.get('X-RateLimit-Reset')

    // Rate limited: 429 or 403 with remaining=0
    if (response.status === 429 || (response.status === 403 && remaining === '0')) {
      // Back off until reset time, or default 60s
      rateLimitState.retryAfter = reset != null ? parseInt(reset) * 1000 : Date.now() + 60_000
      const waitSeconds = Math.ceil((rateLimitState.retryAfter - Date.now()) / 1000)
      logDebug(`GitHub rate limit hit, backing off for ${waitSeconds}s`)
      return { status: 'rate-limited' }
    }

    // Clear backoff on successful request
    rateLimitState.retryAfter = undefined

    return { status: 'success', response }
  } catch (error) {
    return { status: 'error', error }
  }
}
