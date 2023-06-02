import * as vscode from 'vscode'
import { decorateDiscreet, getDecoratorForUpdate } from './decorations'
import { getIgnorePattern, isDependencyIgnored } from './ignorePattern'
import { getCachedNpmData, getPossibleUpgrades, refreshPackageJsonData } from './npm'
import { DependencyGroups, getDependencyInformation, isPackageJson } from './packageJson'
import { AsyncState } from './types'
import { TextEditorDecorationType } from 'vscode'
import { getConfig } from './config'

// If a user opens the same package.json several times quickly, several "loads" of decorators will
// be ongoing at the same time. So here we keep track of the latest start time and only use that.
const decorationStart: Record<string, number> = {}

export const handleFileDecoration = (document: vscode.TextDocument, showDecorations: boolean) => {
  if (showDecorations === false) {
    clearDecorations()
    return
  }

  if (!isPackageJson(document)) {
    return
  }

  const startTime = new Date().getTime()
  decorationStart[document.fileName] = startTime

  void loadDecoration(document, startTime)
}

// TODO maybe have cooler handling of decorationtypes? Investigate!
let currentDecorationTypes: vscode.TextEditorDecorationType[] = []

const loadDecoration = async (document: vscode.TextDocument, startTime: number) => {
  const text = document.getText()
  const dependencyGroups = getDependencyInformation(text)

  const textEditor = getTextEditorFromDocument(document)
  if (textEditor === undefined) {
    return
  }

  const promises = refreshPackageJsonData(document.getText(), document.uri.fsPath)

  try {
    await Promise.race([...promises, Promise.resolve()])
  } catch (e) {
    //
  }

  // initial paint
  paintDecorations(document, dependencyGroups, true, startTime)

  return waitForPromises(promises, document, dependencyGroups, startTime)
}

const waitForPromises = async (
  promises: Promise<void>[],
  document: vscode.TextDocument,
  dependencyGroups: DependencyGroups[],
  startTime: number,
) => {
  let newSettled = false

  if (promises.length === 0) {
    return
  }

  promises.forEach((promise) => {
    void promise
      .then(() => {
        newSettled = true
      })
      .catch(() => {
        //
      })
  })

  const interval = setInterval(() => {
    if (newSettled === true) {
      newSettled = false
      paintDecorations(document, dependencyGroups, true, startTime)
    }
  }, 1000)

  await Promise.allSettled(promises)

  clearInterval(interval)

  return paintDecorations(document, dependencyGroups, false, startTime)
}

const paintDecorations = (
  document: vscode.TextDocument,
  dependencyGroups: DependencyGroups[],
  stillLoading: boolean,
  startTime: number,
) => {
  if (decorationStart[document.fileName] !== startTime) {
    return
  }

  const textEditor = getTextEditorFromDocument(document)
  if (textEditor === undefined) {
    return
  }

  const ignorePatterns = getIgnorePattern()

  // TODO it would be nice to not clear everything, but to simply replace it. But I guess that could be hard...
  clearDecorations()

  if (stillLoading) {
    paintLoadingOnDependencyGroups(dependencyGroups, document, textEditor)
  }

  const dependencies = dependencyGroups.map((d) => d.deps).flat()

  dependencies.forEach((dep) => {
    if (isDependencyIgnored(dep.dependencyName, ignorePatterns)) {
      return
    }

    const lineText = document.lineAt(dep.line).text

    const range = new vscode.Range(
      new vscode.Position(dep.line, lineText.length),
      new vscode.Position(dep.line, lineText.length),
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
      const msUntilRowLoading = getConfig().msUntilRowLoading
      if (
        msUntilRowLoading !== 0 &&
        (msUntilRowLoading < 100 ||
          npmCache.startTime + getConfig().msUntilRowLoading < new Date().getTime())
      ) {
        const decorator = decorateDiscreet('Loading...')
        setDecorator(decorator, textEditor, range)
      }
      return
    }

    const possibleUpgrades = getPossibleUpgrades(
      npmCache.item.npmData,
      dep.currentVersion,
      dep.dependencyName,
    )

    let decorator: TextEditorDecorationType | undefined
    if (possibleUpgrades.major !== undefined) {
      // TODO add info about patch version?
      decorator = getDecoratorForUpdate(
        'major',
        possibleUpgrades.major.version,
        possibleUpgrades.existingVersion,
      )
    } else if (possibleUpgrades.minor !== undefined) {
      decorator = getDecoratorForUpdate(
        'minor',
        possibleUpgrades.minor.version,
        possibleUpgrades.existingVersion,
      )
    } else if (possibleUpgrades.patch !== undefined) {
      decorator = getDecoratorForUpdate(
        'patch',
        possibleUpgrades.patch.version,
        possibleUpgrades.existingVersion,
      )
    } else if (possibleUpgrades.prerelease !== undefined) {
      decorator = getDecoratorForUpdate(
        'prerelease',
        possibleUpgrades.prerelease.version,
        possibleUpgrades.existingVersion,
      )
    } else if (possibleUpgrades.validVersion === false) {
      decorator = decorateDiscreet('Failed to parse version')
    }

    setDecorator(decorator, textEditor, range)
  })
}

const paintLoadingOnDependencyGroups = (
  dependencyGroups: DependencyGroups[],
  document: vscode.TextDocument,
  textEditor: vscode.TextEditor,
) => {
  dependencyGroups.forEach((lineLimit) => {
    const lineText = document.lineAt(lineLimit.startLine).text
    const range = new vscode.Range(
      new vscode.Position(lineLimit.startLine, lineText.length),
      new vscode.Position(lineLimit.startLine, lineText.length),
    )
    const loadingUpdatesDecoration = decorateDiscreet('Loading updates...')
    setDecorator(loadingUpdatesDecoration, textEditor, range)
  })
}

const setDecorator = (
  decorator: TextEditorDecorationType | undefined,
  textEditor: vscode.TextEditor,
  range: vscode.Range,
) => {
  if (decorator === undefined) {
    return
  }
  currentDecorationTypes.push(decorator)
  textEditor.setDecorations(decorator, [
    {
      range,
    },
  ])
}

const getTextEditorFromDocument = (document: vscode.TextDocument) => {
  return vscode.window.visibleTextEditors.find((textEditor) => {
    return textEditor.document === document
  })
}

const clearDecorations = () => {
  currentDecorationTypes.forEach((d) => d.dispose())
  currentDecorationTypes = []
}
