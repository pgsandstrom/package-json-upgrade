import * as fs from 'fs'
import * as path from 'path'

interface WorkspaceCache {
  packages: Map<string, string>
  mtime: number
}

const workspaceCache = new Map<string, WorkspaceCache>()

export interface WorkspaceVersionResolution {
  version: string
  isWorkspace: boolean
}

/**
 * Resolves a workspace: protocol version to the actual version from the local workspace package.
 * Returns undefined if the version is not a workspace reference or cannot be resolved.
 */
export const resolveWorkspaceVersion = (
  version: string,
  dependencyName: string,
  packageJsonPath: string,
): WorkspaceVersionResolution | undefined => {
  if (!version.startsWith('workspace:')) {
    return undefined
  }

  const workspaceRoot = findPnpmWorkspaceRoot(packageJsonPath)
  if (workspaceRoot === undefined) {
    return undefined
  }

  const workspacePackages = getWorkspacePackages(workspaceRoot)
  const workspaceVersion = workspacePackages.get(dependencyName)
  if (workspaceVersion === undefined) {
    return undefined
  }

  const explicitSpecifier = version.slice('workspace:'.length)

  // For workspace:*, workspace:^, workspace:~ — use the resolved workspace package version
  if (explicitSpecifier === '*' || explicitSpecifier === '^' || explicitSpecifier === '~') {
    return { version: workspaceVersion, isWorkspace: true }
  }

  // For workspace:1.2.3 or workspace:^1.2.3 — use the explicit version
  // (the user has pinned a specific version in the workspace reference)
  return { version: explicitSpecifier, isWorkspace: true }
}

/**
 * Clears the workspace cache. Useful for testing.
 */
export const clearWorkspaceCache = () => {
  workspaceCache.clear()
}

const findPnpmWorkspaceRoot = (packageJsonPath: string): string | undefined => {
  let dir = path.dirname(packageJsonPath)
  while (dir !== path.dirname(dir)) {
    const pnpmWorkspacePath = path.join(dir, 'pnpm-workspace.yaml')
    if (fs.existsSync(pnpmWorkspacePath)) {
      return dir
    }
    dir = path.dirname(dir)
  }
  return undefined
}

const getWorkspacePackages = (workspaceRoot: string): Map<string, string> => {
  const pnpmWorkspacePath = path.join(workspaceRoot, 'pnpm-workspace.yaml')

  if (!fs.existsSync(pnpmWorkspacePath)) {
    return new Map()
  }

  const mtime = fs.statSync(pnpmWorkspacePath).mtimeMs
  const cache = workspaceCache.get(workspaceRoot)

  if (cache !== undefined && cache.mtime >= mtime) {
    return cache.packages
  }

  const content = fs.readFileSync(pnpmWorkspacePath, 'utf-8')
  const patterns = parsePnpmWorkspaceYaml(content)
  const packages = new Map<string, string>()

  for (const pattern of patterns) {
    const pkgJsonPaths = resolveGlob(workspaceRoot, pattern)
    for (const pkgJsonPath of pkgJsonPaths) {
      try {
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8')) as {
          name?: string
          version?: string
        }
        if (pkgJson.name !== undefined && pkgJson.version !== undefined) {
          packages.set(pkgJson.name, pkgJson.version)
        }
      } catch {
        // ignore invalid or unreadable package.json files
      }
    }
  }

  workspaceCache.set(workspaceRoot, { packages, mtime })
  return packages
}

const parsePnpmWorkspaceYaml = (content: string): string[] => {
  const lines = content.split('\n')
  let inPackages = false
  const patterns: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === 'packages:') {
      inPackages = true
      continue
    }
    if (inPackages) {
      if (trimmed.startsWith('- ')) {
        const raw = trimmed.slice(2).trim()
        // Remove surrounding quotes if present
        const value = raw.replace(/^['"]|['"]$/g, '')
        if (value.length > 0) {
          patterns.push(value)
        }
      } else if (trimmed !== '' && !trimmed.startsWith('#')) {
        // We've left the packages array
        inPackages = false
      }
    }
  }

  return patterns
}

const resolveGlob = (basePath: string, pattern: string): string[] => {
  const parts = pattern.split('/').filter((p) => p !== '')
  return resolveGlobRecursive(basePath, parts)
}

const resolveGlobRecursive = (currentPath: string, parts: string[]): string[] => {
  if (parts.length === 0) {
    const pkgJson = path.join(currentPath, 'package.json')
    return fs.existsSync(pkgJson) ? [pkgJson] : []
  }

  const [head, ...tail] = parts

  if (head === '**') {
    const results: string[] = []
    // Match zero or more directory levels
    results.push(...resolveGlobRecursive(currentPath, tail))
    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== 'node_modules') {
          results.push(...resolveGlobRecursive(path.join(currentPath, entry.name), parts))
        }
      }
    } catch {
      // ignore directories we can't read
    }
    return results
  }

  if (head === '*') {
    const results: string[] = []
    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          results.push(...resolveGlobRecursive(path.join(currentPath, entry.name), tail))
        }
      }
    } catch {
      // ignore directories we can't read
    }
    return results
  }

  // Literal directory name
  const nextPath = path.join(currentPath, head)
  if (!fs.existsSync(nextPath)) {
    return []
  }
  return resolveGlobRecursive(nextPath, tail)
}
