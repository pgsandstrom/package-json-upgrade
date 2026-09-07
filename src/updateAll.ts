import * as vscode from 'vscode'

import { getDependencyGroups, getUpdatedLineText, isDependencyFile } from './dependencyFile'
import { getIgnorePattern, isDependencyIgnored } from './ignorePattern'
import { getCachedNpmData, getExactVersion, getLatestVersion } from './npm'

export interface UpdateEdit {
  range: vscode.Range
  text: string
}

export const updateAll = (textEditor?: vscode.TextEditor): UpdateEdit[] => {
  if (textEditor === undefined) {
    return []
  }

  const document = textEditor.document

  if (isDependencyFile(document)) {
    const ignorePatterns = getIgnorePattern()

    const dependencies = getDependencyGroups(document)
      .map((d) => d.deps)
      .flat()
    const edits: UpdateEdit[] = dependencies
      .map((dep) => {
        const lineText = document.lineAt(dep.line).text
        const wholeLineRange = new vscode.Range(dep.line, 0, dep.line, lineText.length)

        if (isDependencyIgnored(dep.dependencyName, ignorePatterns)) {
          return
        }

        // Skip catalog dependencies — the version lives elsewhere
        if (dep.isCatalog === true) {
          return
        }

        const npmCache = getCachedNpmData(dep.dependencyName)
        if (npmCache?.item === undefined) {
          return
        }

        const latestVersion = getLatestVersion(
          npmCache.item.npmData,
          dep.currentVersion,
          dep.dependencyName,
        )
        if (latestVersion === undefined) {
          return
        }

        const currentExactVersion = getExactVersion(dep.currentVersion)
        const newLineText = getUpdatedLineText(
          document,
          lineText,
          currentExactVersion,
          latestVersion.version,
        )
        return {
          range: wholeLineRange,
          text: newLineText,
        }
      })
      .filter((edit): edit is UpdateEdit => edit !== undefined)

    void textEditor.edit((editBuilder: vscode.TextEditorEdit) => {
      edits.forEach((edit) => {
        editBuilder.replace(edit.range, edit.text)
      })
    })
    return edits
  } else {
    void vscode.window.showWarningMessage(
      'Update failed: File not recognized as valid package.json or pnpm-workspace.yaml',
    )
    return []
  }
}
