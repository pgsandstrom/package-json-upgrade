import * as fs from 'fs'
import * as path from 'path'

interface WorkspaceCache {
  packages: Map<string, string>
  mtime: number
}

const workspaceCache = new Map<string, WorkspaceCache>()
const catalogCache = new Map<string, CatalogCache>()

interface CatalogCache {
  catalog: WorkspaceCatalog
  mtime: number
}

interface WorkspaceCatalog {
  default: Map<string, string>
  named: Map<string, Map<string, string>>
}

export interface CatalogVersionResolution {
  version: string
  isCatalog: boolean
}

/**
 * Resolves a catalog: protocol version using the root pnpm-workspace.yaml catalog sections.
 * Returns undefined if not in a workspace, the version is not a catalog reference,
 * or the referenced catalog entry cannot be found.
 */
export const resolveCatalogVersion = (
  version: string,
  dependencyName: string,
  packageJsonPath: string,
): CatalogVersionResolution | undefined => {
  if (!version.startsWith('catalog:')) {
    return undefined
  }

  const workspaceRoot = findPnpmWorkspaceRoot(packageJsonPath)
  if (workspaceRoot === undefined) {
    return undefined
  }

  const catalogName = version === 'catalog:' ? 'default' : version.slice('catalog:'.length)
  const workspaceCatalog = getWorkspaceCatalog(workspaceRoot)

  if (catalogName === 'default') {
    // catalog: or catalog:default — check top-level catalog first, then catalogs.default
    const resolved = workspaceCatalog.default.get(dependencyName)
    if (resolved !== undefined) {
      return { version: resolved, isCatalog: true }
    }
    const namedDefault = workspaceCatalog.named.get('default')
    if (namedDefault !== undefined) {
      const namedResolved = namedDefault.get(dependencyName)
      if (namedResolved !== undefined) {
        return { version: namedResolved, isCatalog: true }
      }
    }
  } else {
    const namedCatalog = workspaceCatalog.named.get(catalogName)
    if (namedCatalog !== undefined) {
      const resolved = namedCatalog.get(dependencyName)
      if (resolved !== undefined) {
        return { version: resolved, isCatalog: true }
      }
    }
  }

  return undefined
}

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
  catalogCache.clear()
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

const getWorkspaceCatalog = (workspaceRoot: string): WorkspaceCatalog => {
  const pnpmWorkspacePath = path.join(workspaceRoot, 'pnpm-workspace.yaml')

  if (!fs.existsSync(pnpmWorkspacePath)) {
    return { default: new Map(), named: new Map() }
  }

  const mtime = fs.statSync(pnpmWorkspacePath).mtimeMs
  const cache = catalogCache.get(workspaceRoot)

  if (cache !== undefined && cache.mtime >= mtime) {
    return cache.catalog
  }

  const content = fs.readFileSync(pnpmWorkspacePath, 'utf-8')
  const catalog = parsePnpmWorkspaceCatalogs(content)

  catalogCache.set(workspaceRoot, { catalog, mtime })
  return catalog
}

const parsePnpmWorkspaceCatalogs = (content: string): WorkspaceCatalog => {
  const lines = content.split('\n')
  const catalog = new Map<string, string>()
  const named = new Map<string, Map<string, string>>()

  let i = 0
  while (i < lines.length) {
    const trimmed = lines[i].trim()

    if (trimmed === 'catalog:') {
      const result = extractBlock(lines, i + 1)
      for (const [key, value] of result.entries) {
        catalog.set(key, value)
      }
      i = result.nextIndex
    } else if (trimmed === 'catalogs:') {
      const result = extractNestedBlocks(lines, i + 1)
      for (const [name, entries] of result.blocks) {
        named.set(name, entries)
      }
      i = result.nextIndex
    }

    i++
  }

  return { default: catalog, named }
}

interface BlockResult {
  entries: Array<[string, string]>
  nextIndex: number
}

const extractBlock = (lines: string[], startIdx: number): BlockResult => {
  const entries: Array<[string, string]> = []
  let i = startIdx
  let baseIndent = -1

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed === '' || trimmed.startsWith('#')) {
      i++
      continue
    }

    const indent = line.search(/\S/)
    if (baseIndent === -1) {
      baseIndent = indent
    } else if (indent < baseIndent) {
      break
    }

    const colonIdx = trimmed.indexOf(':')
    if (colonIdx > 0) {
      const key = trimmed
        .slice(0, colonIdx)
        .trim()
        .replace(/^['"]|['"]$/g, '')
      const value = trimmed
        .slice(colonIdx + 1)
        .trim()
        .replace(/^['"]|['"]$/g, '')
      if (value.length > 0) {
        entries.push([key, value])
      }
    }
    i++
  }

  return { entries, nextIndex: i - 1 }
}

interface NestedBlockResult {
  blocks: Array<[string, Map<string, string>]>
  nextIndex: number
}

const extractNestedBlocks = (lines: string[], startIdx: number): NestedBlockResult => {
  const blocks: Array<[string, Map<string, string>]> = []
  let i = startIdx
  let baseIndent = -1

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed === '' || trimmed.startsWith('#')) {
      i++
      continue
    }

    const indent = line.search(/\S/)
    if (baseIndent === -1) {
      baseIndent = indent
    } else if (indent < baseIndent) {
      break
    }

    const colonIdx = trimmed.indexOf(':')
    if (colonIdx > 0 && trimmed.slice(colonIdx + 1).trim() === '') {
      const name = trimmed.slice(0, colonIdx).trim()
      const result = extractBlock(lines, i + 1)
      const entries = new Map<string, string>()
      for (const [key, value] of result.entries) {
        entries.set(key, value)
      }
      blocks.push([name, entries])
      i = result.nextIndex + 1
      continue
    }

    i++
  }

  return { blocks, nextIndex: i - 1 }
}
