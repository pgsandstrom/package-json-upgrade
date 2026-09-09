import * as vscode from 'vscode'

import { refreshDependencies } from './npm'
import {
  Dependency,
  DependencyGroups,
  getDependencyInformation,
  isPackageJson,
} from './packageJson'
import {
  getWorkspaceFileDependencyInformation,
  isPnpmWorkspaceFile,
  replaceVersionInWorkspaceLine,
} from './pnpmWorkspaceFile'
import { replaceLastOccuranceOf } from './util/util'

/**
 * The file types we show updates in: package.json and pnpm-workspace.yaml.
 */
export const isDependencyFile = (document: vscode.TextDocument) => {
  return isPackageJson(document) || isPnpmWorkspaceFile(document)
}

export const getDependencyGroups = (document: vscode.TextDocument): DependencyGroups[] => {
  if (isPackageJson(document)) {
    return getDependencyInformation(document.getText(), document.uri.fsPath)
  } else if (isPnpmWorkspaceFile(document)) {
    return getWorkspaceFileDependencyInformation(document.getText())
  } else {
    return []
  }
}

export const getDependencyFromDocumentLine = (
  document: vscode.TextDocument,
  line: number,
): Dependency | undefined => {
  return getDependencyGroups(document)
    .map((group) => group.deps)
    .flat()
    .find((dep) => dep.line === line)
}

/**
 * Rewrites a dependency line so that it holds the new version. Where the version
 * sits on the line differs between the file types, so each has its own replace.
 */
export const getUpdatedLineText = (
  document: vscode.TextDocument,
  lineText: string,
  currentVersion: string,
  newVersion: string,
): string => {
  if (isPackageJson(document)) {
    return replaceLastOccuranceOf(lineText, currentVersion, newVersion)
  } else if (isPnpmWorkspaceFile(document)) {
    return replaceVersionInWorkspaceLine(lineText, currentVersion, newVersion)
  } else {
    return lineText
  }
}

/**
 * Fetches npm data for the dependencies of an already-parsed file. The groups are
 * the ones the caller is about to decorate, so parsing happens once per pass and
 * we can only ever fetch what we show.
 */
export const refreshDependencyFileData = (
  document: vscode.TextDocument,
  dependencyGroups: DependencyGroups[],
): Promise<void>[] => {
  const dependencies = dependencyGroups
    .flatMap((group) => group.deps)
    .map((dep) => [dep.dependencyName, dep.currentVersion] as const)

  return refreshDependencies(dependencies, document.uri.fsPath)
}
