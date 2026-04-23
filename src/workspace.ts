import * as fs from 'fs'
import * as yaml from 'js-yaml'
import * as path from 'path'

interface WorkspaceCache {
  packages: Map<string, string>
  mtime: number
}

interface CatalogCache {
  catalog: WorkspaceCatalog
  mtime: number
}

interface WorkspaceCatalog {
  default: Map<string, string>
  named: Map<string, Map<string, string>>
}

const workspaceCache = new Map<string, WorkspaceCache>()
const catalogCache = new Map<string, CatalogCache>()
const workspaceRootCache = new Map<string, string | undefined>()

export interface CatalogVersionResolution {
  version: string
  isCatalog: boolean
}

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

  if (explicitSpecifier === '*' || explicitSpecifier === '^' || explicitSpecifier === '~') {
    return { version: workspaceVersion, isWorkspace: true }
  }

  return { version: explicitSpecifier, isWorkspace: true }
}

export const clearWorkspaceCache = () => {
  workspaceCache.clear()
  catalogCache.clear()
  workspaceRootCache.clear()
}

const findPnpmWorkspaceRoot = (packageJsonPath: string): string | undefined => {
  const cached = workspaceRootCache.get(packageJsonPath)
  if (cached !== undefined || workspaceRootCache.has(packageJsonPath)) {
    return cached
  }

  let dir = path.dirname(packageJsonPath)
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      workspaceRootCache.set(packageJsonPath, dir)
      return dir
    }
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yml'))) {
      workspaceRootCache.set(packageJsonPath, dir)
      return dir
    }
    dir = path.dirname(dir)
  }

  workspaceRootCache.set(packageJsonPath, undefined)
  return undefined
}

const getWorkspacePackages = (workspaceRoot: string): Map<string, string> => {
  const workspaceFile = findWorkspaceFile(workspaceRoot)
  if (workspaceFile === undefined) {
    return new Map()
  }

  const mtime = fs.statSync(workspaceFile).mtimeMs
  const cache = workspaceCache.get(workspaceRoot)

  if (cache !== undefined && cache.mtime >= mtime) {
    return cache.packages
  }

  const content = fs.readFileSync(workspaceFile, 'utf-8')
  const patterns = parseWorkspacePackages(content)
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

const findWorkspaceFile = (workspaceRoot: string): string | undefined => {
  const yamlPath = path.join(workspaceRoot, 'pnpm-workspace.yaml')
  if (fs.existsSync(yamlPath)) {
    return yamlPath
  }
  const ymlPath = path.join(workspaceRoot, 'pnpm-workspace.yml')
  if (fs.existsSync(ymlPath)) {
    return ymlPath
  }
  return undefined
}

const parseWorkspacePackages = (content: string): string[] => {
  try {
    const parsed = yaml.load(content)
    if (!isRecord(parsed)) {
      return []
    }
    const packages = parsed.packages
    if (Array.isArray(packages)) {
      return packages.filter((p): p is string => typeof p === 'string')
    }
  } catch {
    // ignore invalid yaml
  }
  return []
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

  const nextPath = path.join(currentPath, head)
  if (!fs.existsSync(nextPath)) {
    return []
  }
  return resolveGlobRecursive(nextPath, tail)
}

const getWorkspaceCatalog = (workspaceRoot: string): WorkspaceCatalog => {
  const workspaceFile = findWorkspaceFile(workspaceRoot)
  if (workspaceFile === undefined) {
    return { default: new Map(), named: new Map() }
  }

  const mtime = fs.statSync(workspaceFile).mtimeMs
  const cache = catalogCache.get(workspaceRoot)

  if (cache !== undefined && cache.mtime >= mtime) {
    return cache.catalog
  }

  const content = fs.readFileSync(workspaceFile, 'utf-8')
  const catalog = parseWorkspaceCatalogs(content)

  catalogCache.set(workspaceRoot, { catalog, mtime })
  return catalog
}

const parseWorkspaceCatalogs = (content: string): WorkspaceCatalog => {
  const catalog = new Map<string, string>()
  const named = new Map<string, Map<string, string>>()

  try {
    const parsed = yaml.load(content)
    if (!isRecord(parsed)) {
      return { default: catalog, named }
    }

    if (isRecord(parsed.catalog)) {
      for (const [key, value] of Object.entries(parsed.catalog)) {
        if (typeof value === 'string') {
          catalog.set(key, value)
        }
      }
    }

    if (isRecord(parsed.catalogs)) {
      for (const [name, entries] of Object.entries(parsed.catalogs)) {
        if (isRecord(entries)) {
          const map = new Map<string, string>()
          for (const [key, value] of Object.entries(entries)) {
            if (typeof value === 'string') {
              map.set(key, value)
            }
          }
          named.set(name, map)
        }
      }
    }
  } catch {
    // ignore invalid yaml
  }

  return { default: catalog, named }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
