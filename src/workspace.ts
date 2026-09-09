import * as fs from 'fs'
import * as yaml from 'js-yaml'
import * as path from 'path'

import { isRecord } from './util/util'
import { getKeyLines, toKeyLineKey, WORKSPACE_YAML_OPTIONS } from './util/yaml'

interface CatalogCache {
  catalog: WorkspaceCatalog
  mtime: number
}

interface WorkspaceCatalog {
  filePath: string
  default: Map<string, CatalogEntry>
  named: Map<string, Map<string, CatalogEntry>>
}

interface CatalogEntry {
  version: string
  /**
   * The line the entry is written on. Undefined when the scan found no line of its
   * own for it, which happens for flow style mappings such as
   * `catalog: { react: ^19.0.0 }`. The version still resolves, we just have nowhere
   * to send anyone who wants to look at it.
   */
  line: number | undefined
}

const catalogCache = new Map<string, CatalogCache>()
const workspaceRootCache = new Map<string, string>()

/**
 * Where a catalog entry is written, so we can offer to open it.
 */
export interface CatalogDefinition {
  filePath: string
  line: number
}

export interface CatalogVersionResolution {
  version: string
  isCatalog: boolean
  definition?: CatalogDefinition
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
  if (workspaceCatalog === undefined) {
    return undefined
  }

  const resolved =
    catalogName === 'default'
      ? (workspaceCatalog.default.get(dependencyName) ??
        workspaceCatalog.named.get('default')?.get(dependencyName))
      : workspaceCatalog.named.get(catalogName)?.get(dependencyName)

  if (resolved !== undefined) {
    return {
      version: resolved.version,
      isCatalog: true,
      definition:
        resolved.line === undefined
          ? undefined
          : { filePath: workspaceCatalog.filePath, line: resolved.line },
    }
  }

  return undefined
}

export const clearWorkspaceCache = () => {
  catalogCache.clear()
  workspaceRootCache.clear()
}

/**
 * Walks up from a package.json looking for the pnpm workspace root above it. Hits are cached, misses are not.
 */
const findPnpmWorkspaceRoot = (packageJsonPath: string): string | undefined => {
  const cached = workspaceRootCache.get(packageJsonPath)
  if (cached !== undefined) {
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

  return undefined
}

const findWorkspaceFile = (workspaceRoot: string): string | undefined => {
  const filePath = path.join(workspaceRoot, 'pnpm-workspace.yaml')
  if (fs.existsSync(filePath)) {
    return filePath
  }
  return undefined
}

const getWorkspaceCatalog = (workspaceRoot: string): WorkspaceCatalog | undefined => {
  const workspaceFile = findWorkspaceFile(workspaceRoot)
  if (workspaceFile === undefined) {
    return undefined
  }

  const mtime = fs.statSync(workspaceFile).mtimeMs
  const cache = catalogCache.get(workspaceRoot)

  if (cache !== undefined && cache.mtime >= mtime) {
    return cache.catalog
  }

  const content = fs.readFileSync(workspaceFile, 'utf-8')
  const catalog = parseWorkspaceCatalogs(content, workspaceFile)

  catalogCache.set(workspaceRoot, { catalog, mtime })
  return catalog
}

const parseWorkspaceCatalogs = (content: string, filePath: string): WorkspaceCatalog => {
  const catalog = new Map<string, CatalogEntry>()
  const named = new Map<string, Map<string, CatalogEntry>>()

  try {
    const parsed = yaml.load(content, WORKSPACE_YAML_OPTIONS)
    if (!isRecord(parsed)) {
      return { filePath, default: catalog, named }
    }

    // js-yaml gives us the values but no positions, so the lines we send people to
    // come from a separate scan of the raw text.
    const keyLines = getKeyLines(content)

    if (isRecord(parsed.catalog)) {
      for (const [key, value] of Object.entries(parsed.catalog)) {
        if (typeof value === 'string') {
          catalog.set(key, { version: value, line: keyLines.get(toKeyLineKey(['catalog', key])) })
        }
      }
    }

    if (isRecord(parsed.catalogs)) {
      for (const [name, entries] of Object.entries(parsed.catalogs)) {
        if (isRecord(entries)) {
          const map = new Map<string, CatalogEntry>()
          for (const [key, value] of Object.entries(entries)) {
            if (typeof value === 'string') {
              map.set(key, {
                version: value,
                line: keyLines.get(toKeyLineKey(['catalogs', name, key])),
              })
            }
          }
          named.set(name, map)
        }
      }
    }
  } catch {
    // ignore invalid yaml
  }

  return { filePath, default: catalog, named }
}
