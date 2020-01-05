import * as vscode from 'vscode'
import { decorateNotFound, getDecoratorForUpdate } from './decorations'
import { getCachedNpmData, getPossibleUpgrades, refreshPackageJsonData } from './npm'
import { parseDependencyLine } from './packageJson'
import { AsyncState } from './types'

// const packageJsonLastUpdate: Dict<string, Date> = {}

export const handleFile = (document: vscode.TextDocument, showDecorations: boolean) => {
  if (showDecorations === false) {
    clearCurrentDecorations()
    return
  }

  // const cacheCutoff = subMinutes(new Date(), 15)

  // const lastUpdate = packageJsonLastUpdate[document.uri.fsPath]
  // if (lastUpdate === undefined || isBefore(lastUpdate, cacheCutoff) || forceRefresh) {
  if (isPackageJson(document)) {
    // TODO should only set this on success, but also want to prevent several simultanious things
    // packageJsonLastUpdate[document.uri.fsPath] = new Date()
    updatePackageJson(document)
  }
  // }
}

// TODO maybe have cooler handling of decorationtypes? Investigate!
let currentDecorationTypes: vscode.TextEditorDecorationType[] = []

export const clearCurrentDecorations = () => {
  currentDecorationTypes.forEach(d => d.dispose())
  currentDecorationTypes = []
}

const updatePackageJson = async (document: vscode.TextDocument) => {
  // TODO show loading?
  await refreshPackageJsonData(document)

  const textEditor = getTextEditorFromDocument(document)
  if (textEditor === undefined) {
    return
  }

  clearCurrentDecorations()

  Array.from({ length: document.lineCount })
    .map((_, index) => index)
    .filter(index => {
      return isInDependency(document, index)
    })
    .forEach(index => {
      const lineText = document.lineAt(index).text

      const dep = parseDependencyLine(lineText)

      if (dep === undefined) {
        return
      }

      const range = new vscode.Range(
        new vscode.Position(index, lineText.length),
        new vscode.Position(index, lineText.length),
      )

      const npmCache = getCachedNpmData(dep.dependencyName)
      if (npmCache === undefined) {
        return
      }
      if (npmCache.asyncstate === AsyncState.Rejected) {
        const notFoundDecoration = decorateNotFound('Dependency not found')
        textEditor.setDecorations(notFoundDecoration, [
          {
            range,
          },
        ])
        currentDecorationTypes.push(notFoundDecoration)
        return
      }

      if (npmCache.item === undefined) {
        return
      }

      const possibleUpgrades = getPossibleUpgrades(npmCache.item.npmData, dep.currentVersion)

      let decorator
      if (possibleUpgrades.major !== undefined) {
        // TODO add info about patch version
        decorator = getDecoratorForUpdate(
          'major',
          dep.currentVersion,
          possibleUpgrades.major.version,
        )
      } else if (possibleUpgrades.minor !== undefined) {
        decorator = getDecoratorForUpdate(
          'minor',
          dep.currentVersion,
          possibleUpgrades.minor.version,
        )
      } else if (possibleUpgrades.patch !== undefined) {
        decorator = getDecoratorForUpdate(
          'patch',
          dep.currentVersion,
          possibleUpgrades.patch.version,
        )
      } else {
        decorator = getDecoratorForUpdate(null, dep.currentVersion)
      }

      if (decorator !== undefined) {
        currentDecorationTypes.push(decorator)
        textEditor.setDecorations(decorator, [
          {
            range,
          },
        ])
      }
    })
}

const getTextEditorFromDocument = (document: vscode.TextDocument) => {
  return vscode.window.visibleTextEditors.find(textEditor => {
    return textEditor.document === document
  })
}

export const isPackageJson = (document: vscode.TextDocument) => {
  // console.log(document.fileName)
  // TODO match exact filename in a better way
  return document.fileName.endsWith('package.json')
}

export const isInDependency = (document: vscode.TextDocument, line: number) => {
  const devDependenciesLine = Array.from({ length: document.lineCount })
    .map((_, index) => index)
    .find(i => {
      const lineText = document.lineAt(i).text
      return /\s*"devDependencies"\s*/.test(lineText)
    })
  // console.log(`devdep line: ${devDependenciesLine}`)

  // TODO complete this
  return devDependenciesLine !== undefined && devDependenciesLine < line
}
