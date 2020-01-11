import * as vscode from 'vscode'
import { getCachedNpmData, getLatestVersion } from './npm'
import { parseDependencyLine } from './packageJson'
import { getDependencyLineLimits, isInDependency, isPackageJson } from './texteditor'
import { replaceLastOccuranceOf } from './util/util'

export const updateAll = (textEditor?: vscode.TextEditor) => {
  if (textEditor === undefined) {
    return
  }

  const document = textEditor.document

  if (isPackageJson(document)) {
    const dependencyLineLimits = getDependencyLineLimits(document)
    const edits = Array.from({ length: document.lineCount })
      .map((_, index) => index)
      .filter(index => {
        return isInDependency(document, index, dependencyLineLimits)
      })
      .map(index => {
        const lineText = document.lineAt(index).text
        const wholeLineRange = new vscode.Range(index, 0, index, lineText.length)
        const dep = parseDependencyLine(lineText)
        if (dep === undefined) {
          return
        }
        const npmCache = getCachedNpmData(dep.dependencyName)
        if (npmCache?.item === undefined) {
          return
        }
        const currentVersion =
          dep.currentVersion.startsWith('~') || dep.currentVersion.startsWith('^')
            ? dep.currentVersion.substring(1)
            : dep.currentVersion
        const latestVersion = getLatestVersion(npmCache.item.npmData)
        if (latestVersion === undefined) {
          return
        }
        const newLineText = replaceLastOccuranceOf(lineText, currentVersion, latestVersion.version)
        return {
          range: wholeLineRange,
          text: newLineText,
        }
      })

    textEditor.edit((editBuilder: vscode.TextEditorEdit) => {
      edits.forEach(edit => {
        if (edit !== undefined) {
          editBuilder.replace(edit.range, edit.text)
        }
      })
    })
  } else {
    vscode.window.showWarningMessage('Update failed: File not recognized as valid package.json')
  }
}
