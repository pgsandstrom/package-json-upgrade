import * as yaml from 'js-yaml'
import * as vscode from 'vscode'

import { getConfig } from './config'
import { Dependency, DependencyGroups } from './packageJson'
import { isRecord } from './util/util'

export const isPnpmWorkspaceFile = (document: vscode.TextDocument) => {
  // Is checking both slashes necessary? Test on linux and mac.
  return ['pnpm-workspace.yaml', 'pnpm-workspace.yml'].some(
    (fileName) =>
      document.fileName.endsWith(`\\${fileName}`) || document.fileName.endsWith(`/${fileName}`),
  )
}

export const getWorkspaceFileDependencyInformation = (yamlAsString: string): DependencyGroups[] => {
  let parsed: unknown
  try {
    parsed = yaml.load(yamlAsString)
  } catch (_) {
    // Broken yaml. The user is probably in the middle of an edit, so just show nothing.
    return []
  }

  if (!isRecord(parsed)) {
    return []
  }

  // js-yaml gives us the values but no positions, so line numbers come from a
  // separate scan of the raw text.
  const keyLines = getKeyLines(yamlAsString)

  return getConfig()
    .dependencyGroups.map((group) => toDependencyGroup(parsed, group, keyLines))
    .filter((group): group is DependencyGroups => group !== undefined)
}

const toDependencyGroup = (
  parsed: Record<string, unknown>,
  group: string,
  keyLines: Map<string, number>,
): DependencyGroups | undefined => {
  const groupPath = toPath(group)
  const groupValue = getValueAtPath(parsed, groupPath)
  if (groupPath.length === 0 || !isRecord(groupValue)) {
    return undefined
  }

  const startLine = keyLines.get(toKeyLineKey(groupPath))
  if (startLine === undefined) {
    return undefined
  }

  const deps: Dependency[] = []
  for (const [name, value] of Object.entries(groupValue)) {
    if (typeof value === 'string') {
      addDependency(deps, keyLines, [...groupPath, name], name, value)
    } else if (isRecord(value)) {
      // "catalogs" is a mapping of catalog name to its own dependency mapping.
      for (const [nestedName, nestedValue] of Object.entries(value)) {
        if (typeof nestedValue === 'string') {
          addDependency(deps, keyLines, [...groupPath, name, nestedName], nestedName, nestedValue)
        }
      }
    }
  }

  return { startLine, deps }
}

const addDependency = (
  deps: Dependency[],
  keyLines: Map<string, number>,
  path: string[],
  dependencyName: string,
  currentVersion: string,
) => {
  const line = keyLines.get(toKeyLineKey(path))
  // Without a line of its own there is nothing to decorate or upgrade. That
  // happens for flow style mappings such as `catalog: { react: ^19.0.0 }`.
  if (line === undefined) {
    return
  }
  deps.push({ dependencyName, currentVersion, line })
}

const toPath = (group: string): string[] => {
  return group
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
}

const getValueAtPath = (parsed: Record<string, unknown>, path: string[]): unknown => {
  let current: unknown = parsed
  for (const segment of path) {
    if (!isRecord(current)) {
      return undefined
    }
    current = current[segment]
  }
  return current
}

// Yaml keys may contain almost anything, so we flatten a key path with JSON to
// make sure two different paths never collide.
const toKeyLineKey = (path: string[]): string => {
  return JSON.stringify(path)
}

// Matches the indentation and the raw key of a `key: value` or `key:` line. The
// three key alternatives are double quoted, single quoted and plain keys.
const KEY_REGEX = /^(\s*)("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s#][^:]*?)\s*:(?=\s|$)/

/**
 * Maps the path of every mapping key in the document to the line it is written on.
 * The path is the list of ancestor keys, so `react` inside `catalogs: legacy:` ends
 * up as `catalogs`, `legacy`, `react`.
 *
 * This goes by indentation rather than using a real yaml parser, so it does not
 * understand flow style mappings or block scalars. Neither is used for pnpm
 * catalogs, and any dependency we fail to find a line for is simply skipped.
 *
 * This currently does not respect CR-only line breaks... but no one uses that, right?
 */
const getKeyLines = (yamlAsString: string): Map<string, number> => {
  const keyLines = new Map<string, number>()
  const parents: { key: string; indent: number }[] = []

  yamlAsString.split('\n').forEach((lineText, line) => {
    // Sequence entries are never dependencies, and letting them through would
    // corrupt the parent stack.
    if (/^\s*-(\s|$)/.test(lineText)) {
      return
    }

    const match = KEY_REGEX.exec(lineText)
    if (match === null) {
      return
    }

    const indent = match[1].length
    const key = getKey(match[2])

    while (parents.length > 0 && parents[parents.length - 1].indent >= indent) {
      parents.pop()
    }

    const path = [...parents.map((parent) => parent.key), key]
    parents.push({ key, indent })

    // Duplicate keys are invalid yaml, but if we ever see one we let the first win.
    const keyLineKey = toKeyLineKey(path)
    if (!keyLines.has(keyLineKey)) {
      keyLines.set(keyLineKey, line)
    }
  })

  return keyLines
}

const getKey = (rawKey: string): string => {
  if (rawKey.startsWith('"') && rawKey.endsWith('"')) {
    // Package names never contain anything fancier than a backslash escape.
    return rawKey.slice(1, -1).replace(/\\(.)/g, '$1')
  }
  if (rawKey.startsWith("'") && rawKey.endsWith("'")) {
    return rawKey.slice(1, -1).replace(/''/g, "'")
  }
  return rawKey
}
