import * as vscode from 'vscode'
import { getCachedNpmData, getExactVersion, getLatestVersion, isVersionPrerelease } from './npm'
import { parseDependencyLine } from './packageJson'
import { getDependencyLineLimits, getLineLimitForLine, isPackageJson } from './texteditor'
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

  if (isPackageJson(document)) {
    const dependencyLineLimits = getDependencyLineLimits(document)
    const edits: UpdateEdit[] = Array.from({ length: document.lineCount })
      .map((_, index) => index)
      .filter((index) => {
        const lineLimit = getLineLimitForLine(document, index, dependencyLineLimits)
        return lineLimit !== undefined && lineLimit.isPeerDependency === false
      })
      .map((index) => {
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
        const currentVersion = getExactVersion(dep.currentVersion)
        const includePrerelease = isVersionPrerelease(currentVersion)
        const latestVersion = getLatestVersion(npmCache.item.npmData, includePrerelease)
        if (latestVersion === undefined) {
          return
        }
        const newLineText = replaceLastOccuranceOf(lineText, currentVersion, latestVersion.version)
        return {
          range: wholeLineRange,
          text: newLineText,
        }
      })
      .filter((edit): edit is UpdateEdit => edit !== undefined)

    textEditor.edit((editBuilder: vscode.TextEditorEdit) => {
      edits.forEach((edit) => {
        editBuilder.replace(edit.range, edit.text)
      })
    })
    return edits
  } else {
    vscode.window.showWarningMessage('Update failed: File not recognized as valid package.json')
    return []
  }
}
