import * as yaml from 'js-yaml'
import * as vscode from 'vscode'

import { getConfig } from './config'
import { Dependency, DependencyGroups } from './packageJson'
import { endsWithFileName, getValueAtPath, isRecord, toPath } from './util/util'
import { getKeyLines, KEY_REGEX, toKeyLineKey, WORKSPACE_YAML_OPTIONS } from './util/yaml'

export const isPnpmWorkspaceFile = (document: vscode.TextDocument) => {
  return endsWithFileName(document, 'pnpm-workspace.yaml')
}

export const getWorkspaceFileDependencyInformation = (yamlAsString: string): DependencyGroups[] => {
  let parsed: unknown
  try {
    parsed = yaml.load(yamlAsString, WORKSPACE_YAML_OPTIONS)
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
  // A key written without a value, such as an `express:` with nothing after it,
  // reads as an empty string rather than as null. There is no version to look up,
  // and an empty string matches at the start of every line, so an upgrade would
  // write the new version straight after the colon.
  if (currentVersion === '') {
    return
  }

  const line = keyLines.get(toKeyLineKey(path))
  // Without a line of its own there is nothing to decorate or upgrade. That
  // happens for flow style mappings such as `catalog: { react: ^19.0.0 }`.
  if (line === undefined) {
    return
  }
  deps.push({ dependencyName, currentVersion, line })
}

/**
 * Replaces the version of a `key: value` line with a new version.
 *
 * In package.json the value is the last thing on the line, so replacing the last
 * occurrence is safe. Yaml lines may end in a comment, and that comment may well
 * repeat the version:
 *
 *     react: ^19.2.5 # see https://github.com/facebook/react/releases/tag/v19.2.5
 *
 * so we anchor on the first occurrence after the `key:` separator instead.
 */
export const replaceVersionInWorkspaceLine = (
  lineText: string,
  currentVersion: string,
  newVersion: string,
): string => {
  const match = KEY_REGEX.exec(lineText)
  if (match === null) {
    // Not a `key: value` line, so we have no idea where the value is. Leave it alone.
    return lineText
  }

  // Everything the regex matched is the indentation, the key and the colon.
  const valueStart = match[0].length
  const indexOfVersion = lineText.indexOf(currentVersion, valueStart)
  if (indexOfVersion === -1) {
    return lineText
  }

  return (
    lineText.substring(0, indexOfVersion) +
    newVersion +
    lineText.substring(indexOfVersion + currentVersion.length)
  )
}
