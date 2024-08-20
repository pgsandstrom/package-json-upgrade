import * as vscode from 'vscode'
import { getFileType } from './file'
import { getPackageJsonDependencyInformation } from './packageJson'
import { getPnpmWorkspaceDependencyInformation } from './pnpm'

export interface Dependency {
  dependencyName: string
  currentVersion: string
  line: number
}

export interface DependencyGroups {
  startLine: number
  deps: Dependency[]
}

export const getDependencyFromLine = (groups: DependencyGroups[], line: number) => {
  const dependencies = groups.flatMap((d) => d.deps)
  return dependencies.find((d) => d.line === line)
}

export const getDependencyInformation = (document: vscode.TextDocument) => {
  const fileType = getFileType(document)
  const text = document.getText()

  switch (fileType) {
    case 'package.json': {
      return getPackageJsonDependencyInformation(text)
    }
    case 'pnpm-workspace.yaml': {
      return getPnpmWorkspaceDependencyInformation(text)
    }
  }
}
