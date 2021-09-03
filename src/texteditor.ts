import * as vscode from 'vscode'
import { decorateDiscreet, getDecoratorForUpdate } from './decorations'
import { getIgnorePattern, isDependencyIgnored } from './ignorePattern'
import { getCachedNpmData, getPossibleUpgrades, refreshPackageJsonData } from './npm'
import { parseDependencyLine } from './packageJson'
import { AsyncState } from './types'

export interface LineLimit {
  startLine: number
  endLine: number
  isPeerDependency: boolean
}

export const handleFileDecoration = (document: vscode.TextDocument, showDecorations: boolean) => {
  if (showDecorations === false) {
    clearDecorations()
    return
  }

  if (isPackageJson(document)) {
    loadDecoration(document)
  }
}

// TODO maybe have cooler handling of decorationtypes? Investigate!
let currentDecorationTypes: vscode.TextEditorDecorationType[] = []

export const clearDecorations = () => {
  currentDecorationTypes.forEach((d) => d.dispose())
  currentDecorationTypes = []
}

const loadDecoration = async (document: vscode.TextDocument) => {
  const dependencyLineLimits = getDependencyLineLimits(document)

  const textEditor = getTextEditorFromDocument(document)
  if (textEditor === undefined) {
    return
  }

  if (currentDecorationTypes.length === 0) {
    dependencyLineLimits.forEach((lineLimit) => {
      const lineText = document.lineAt(lineLimit.startLine).text
      const range = new vscode.Range(
        new vscode.Position(lineLimit.startLine, lineText.length),
        new vscode.Position(lineLimit.startLine, lineText.length),
      )
      const loadingUpdatesDecoration = decorateDiscreet('Loading updates...')
      textEditor.setDecorations(loadingUpdatesDecoration, [
        {
          range,
        },
      ])
      currentDecorationTypes.push(loadingUpdatesDecoration)
    })
  }

  await refreshPackageJsonData(document)

  const ignorePatterns = getIgnorePattern()

  clearDecorations()

  Array.from({ length: document.lineCount })
    .map((_, index) => index)
    .filter((index) => {
      const lineLimit = getLineLimitForLine(document, index, dependencyLineLimits)
      return lineLimit !== undefined && lineLimit.isPeerDependency === false
    })
    .forEach((index) => {
      const lineText = document.lineAt(index).text

      const dep = parseDependencyLine(lineText)

      if (dep === undefined) {
        return
      }

      if (isDependencyIgnored(dep.dependencyName, ignorePatterns)) {
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
        const notFoundDecoration = decorateDiscreet('Dependency not found')
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

      const possibleUpgrades = getPossibleUpgrades(
        npmCache.item.npmData,
        dep.currentVersion,
        dep.dependencyName,
      )

      let decorator
      if (possibleUpgrades.major !== undefined) {
        // TODO add info about patch version?
        decorator = getDecoratorForUpdate('major', possibleUpgrades.major.version)
      } else if (possibleUpgrades.minor !== undefined) {
        decorator = getDecoratorForUpdate('minor', possibleUpgrades.minor.version)
      } else if (possibleUpgrades.patch !== undefined) {
        decorator = getDecoratorForUpdate('patch', possibleUpgrades.patch.version)
      } else if (possibleUpgrades.prerelease !== undefined) {
        decorator = getDecoratorForUpdate('prerelease', possibleUpgrades.prerelease.version)
      } else if (possibleUpgrades.validVersion === false) {
        decorator = decorateDiscreet('Failed to parse version')
      } else {
        decorator = undefined
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
  return vscode.window.visibleTextEditors.find((textEditor) => {
    return textEditor.document === document
  })
}

export const isPackageJson = (document: vscode.TextDocument) => {
  // Is checking both slashes necessary? Test on linux and mac.
  return document.fileName.endsWith('\\package.json') || document.fileName.endsWith('/package.json')
}

// lineLimits can be supplied here to save some cpu
export const getLineLimitForLine = (
  document: vscode.TextDocument,
  line: number,
  lineLimits?: LineLimit[],
) => {
  if (lineLimits === undefined) {
    lineLimits = getDependencyLineLimits(document)
  }

  return lineLimits.find((limit) => limit.startLine < line && limit.endLine > line)
}

export const getDependencyLineLimits = (document: vscode.TextDocument) => {
  const limits = []
  const devDependencies = getFlatTagStartEnd(document, /\s*"devDependencies"\s*/, false)
  if (devDependencies !== undefined) {
    limits.push(devDependencies)
  }
  const peerDependencies = getFlatTagStartEnd(document, /\s*"peerDependencies"\s*/, false)
  if (peerDependencies !== undefined) {
    limits.push(peerDependencies)
  }
  const dependencies = getFlatTagStartEnd(document, /\s*"dependencies"\s*/, false)
  if (dependencies !== undefined) {
    limits.push(dependencies)
  }
  return limits
}

const getFlatTagStartEnd = (
  document: vscode.TextDocument,
  regexp: RegExp,
  isPeerDependency: boolean,
): LineLimit | undefined => {
  // TODO this whole limit detection is nooby. How to do it smarter? Is there a cool library for parsing json and finding lines in it?
  const array = Array.from({ length: document.lineCount }).map((_, index) => index)

  const startLine = array.find((i) => {
    const lineText = document.lineAt(i).text
    return regexp.test(lineText)
  })
  if (startLine === undefined) {
    return undefined
  }

  // detect if it opens and closes on same line:
  if (document.lineAt(startLine).text.includes('}')) {
    return undefined
  }

  const endLine = array.slice(startLine + 1).find((i) => {
    return document.lineAt(i).text.includes('}')
  })
  if (endLine === undefined) {
    return undefined
  }
  return {
    startLine,
    endLine,
    isPeerDependency,
  }
}
