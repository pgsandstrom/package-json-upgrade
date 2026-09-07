import * as vscode from 'vscode'

import { refreshPackageJsonData, refreshWorkspaceFileData } from './npm'
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

export const refreshDependencyFileData = (document: vscode.TextDocument): Promise<void>[] => {
  if (isPackageJson(document)) {
    return refreshPackageJsonData(document.getText(), document.uri.fsPath)
  } else if (isPnpmWorkspaceFile(document)) {
    return refreshWorkspaceFileData(document.getText(), document.uri.fsPath)
  } else {
    return []
  }
}
