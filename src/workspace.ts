import * as fs from 'fs'
import * as yaml from 'js-yaml'
import * as path from 'path'

import { isRecord } from './util/util'

interface CatalogCache {
  catalog: WorkspaceCatalog
  mtime: number
}

interface WorkspaceCatalog {
  default: Map<string, string>
  named: Map<string, Map<string, string>>
}

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

  const resolved =
    catalogName === 'default'
      ? (workspaceCatalog.default.get(dependencyName) ??
        workspaceCatalog.named.get('default')?.get(dependencyName))
      : workspaceCatalog.named.get(catalogName)?.get(dependencyName)

  if (resolved !== undefined) {
    return { version: resolved, isCatalog: true }
  }

  return undefined
}

export const clearWorkspaceCache = () => {
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
    if (findWorkspaceFile(dir) !== undefined) {
      workspaceRootCache.set(packageJsonPath, dir)
      return dir
    }
    dir = path.dirname(dir)
  }

  workspaceRootCache.set(packageJsonPath, undefined)
  return undefined
}

const findWorkspaceFile = (workspaceRoot: string): string | undefined => {
  const filePath = path.join(workspaceRoot, 'pnpm-workspace.yaml')
  if (fs.existsSync(filePath)) {
    return filePath
  }
  return undefined
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
