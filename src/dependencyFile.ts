import * as vscode from 'vscode'

import { refreshPackageJsonData, refreshWorkspaceFileData } from './npm'
import {
  Dependency,
  DependencyGroups,
  getDependencyInformation,
  isPackageJson,
} from './packageJson'
import { getWorkspaceFileDependencyInformation, isPnpmWorkspaceFile } from './pnpmWorkspaceFile'

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

export const refreshDependencyFileData = (document: vscode.TextDocument): Promise<void>[] => {
  if (isPackageJson(document)) {
    return refreshPackageJsonData(document.getText(), document.uri.fsPath)
  } else if (isPnpmWorkspaceFile(document)) {
    return refreshWorkspaceFileData(document.getText(), document.uri.fsPath)
  } else {
    return []
  }
}
