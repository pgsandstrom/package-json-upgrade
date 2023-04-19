import * as vscode from 'vscode'
import { getConfig } from './config'

export function getIgnorePattern(): RegExp[] {
  const ignorePatterns: RegExp[] = []
  for (const pattern of getConfig().ignorePatterns) {
    try {
      ignorePatterns.push(new RegExp(pattern))
    } catch (err) {
      void vscode.window.showErrorMessage(
        `Invalid ignore pattern ${pattern}${err instanceof Error ? `: ${err.message}` : ``}`,
      )
    }
  }
  return ignorePatterns
}

export function isDependencyIgnored(dependencyName: string, ignorePatterns: RegExp[]) {
  for (const ignorePattern of ignorePatterns) {
    if (ignorePattern.exec(dependencyName) !== null) {
      return true
    }
  }
  return false
}
