import { findNodeAtLocation, Node, parseTree } from 'jsonc-parser'
import * as vscode from 'vscode'

import { getConfig } from './config'
import { endsWithFileName, toPath } from './util/util'
import { resolveCatalogVersion } from './workspace'

export interface DependencyGroups {
  startLine: number
  deps: Dependency[]
}

export interface Dependency {
  dependencyName: string
  currentVersion: string
  line: number
  isCatalog?: boolean
}

export const getDependencyInformation = (
  jsonAsString: string,
  packageJsonPath?: string,
): DependencyGroups[] => {
  const tree = parseTree(jsonAsString)

  if (tree === undefined) {
    return []
  }

  const groups = getConfig().dependencyGroups

  return groups
    .map((group) => findNodeAtLocation(tree, toPath(group)))
    .filter((node): node is Node => node !== undefined)
    .map((node) => toDependencyGroup(jsonAsString, node, packageJsonPath))
}

function toDependencyGroup(
  jsonAsString: string,
  dependencyNode: Node,
  packageJsonPath?: string,
): DependencyGroups {
  if (dependencyNode.type !== 'object' || !dependencyNode.children) {
    return { startLine: 0, deps: [] }
  }

  const deps = dependencyNode.children.flatMap((property) =>
    getDependenciesFromProperty(jsonAsString, property, packageJsonPath),
  )

  return {
    startLine: offsetToLine(jsonAsString, dependencyNode.offset),
    deps,
  }
}

function getDependenciesFromProperty(
  jsonAsString: string,
  property: Node,
  packageJsonPath?: string,
): Dependency[] {
  if (property.type !== 'property' || !property.children || property.children.length < 2) {
    return []
  }

  const keyNode = property.children[0]
  const valueNode = property.children[1]

  if (keyNode.type !== 'string') {
    return []
  }

  if (valueNode.type === 'string') {
    const dependency = toDependency(
      jsonAsString,
      keyNode.value as string,
      valueNode.value as string,
      property.offset,
      packageJsonPath,
    )
    return dependency === null ? [] : [dependency]
  }

  // catalogs is an object where each property is itself a dependency object.
  if (valueNode.type === 'object' && valueNode.children) {
    return valueNode.children.flatMap((nestedProperty) =>
      getDependenciesFromProperty(jsonAsString, nestedProperty, packageJsonPath),
    )
  }

  return []
}

function toDependency(
  jsonAsString: string,
  dependencyName: string,
  version: string,
  offset: number,
  packageJsonPath?: string,
): Dependency | null {
  if (version.startsWith('catalog:')) {
    if (packageJsonPath !== undefined) {
      const resolved = resolveCatalogVersion(version, dependencyName, packageJsonPath)
      if (resolved !== undefined) {
        return {
          dependencyName,
          currentVersion: resolved.version,
          line: offsetToLine(jsonAsString, offset),
          isCatalog: true,
        }
      }
    }
    return null
  }

  return {
    dependencyName,
    currentVersion: version,
    line: offsetToLine(jsonAsString, offset),
  }
}

// jsonc-parser gives offset in characters, so we have to translate it to line numbers
// this currently does not respect CR-only line breaks... but no one uses that, right? Add it if someone complains.
function offsetToLine(text: string, offset: number): number {
  let line = 0
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') {
      line++
    }
  }
  return line
}

export const isPackageJson = (document: vscode.TextDocument) => {
  return endsWithFileName(document, 'package.json')
}
