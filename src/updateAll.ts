import * as vscode from 'vscode'
import { getDependencyInformation } from './dependency'
import { getIgnorePattern, isDependencyIgnored } from './ignorePattern'
import { getCachedNpmData, getExactVersion, getLatestVersion } from './npm'
import { replaceLastOccuranceOf } from './util/util'

export interface UpdateEdit {
  range: vscode.Range
  text: string
}

export const updateAll = (textEditor?: vscode.TextEditor): UpdateEdit[] => {
  if (textEditor === undefined) {
    return []
  }

  const document = textEditor.document

  const dependencies = getDependencyInformation(document)?.flatMap((d) => d.deps)

  if (!dependencies) {
    void vscode.window.showWarningMessage(
      'Update failed: File not recognized as valid package.json / yarn-workspace.yaml',
    )
    return []
  }

  const ignorePatterns = getIgnorePattern()

  const edits: UpdateEdit[] = dependencies
    .map((dep) => {
      const lineText = document.lineAt(dep.line).text
      const wholeLineRange = new vscode.Range(dep.line, 0, dep.line, lineText.length)

      if (isDependencyIgnored(dep.dependencyName, ignorePatterns)) {
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
      const newLineText = replaceLastOccuranceOf(
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
}
