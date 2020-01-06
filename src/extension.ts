import * as vscode from 'vscode'
import { getConfig, reloadConfig } from './config'
import { getCachedChangelog, getCachedNpmData, getPossibleUpgrades } from './npm'
import { parseDependencyLine } from './packageJson'
import { handleFile, isInDependency, isPackageJson } from './texteditor'
import { replaceLastOccuranceOf } from './util/util'

const OPEN_URL_COMMAND = 'package-json-upgrade.open-url-command'

export function activate(context: vscode.ExtensionContext) {
  reloadConfig()

  let showDecorations = getConfig().showUpdatesAtStart

  const onConfigChange = vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('package-json-upgrade')) {
      reloadConfig()
      const newShowDecorations = getConfig().showUpdatesAtStart
      if (showDecorations !== newShowDecorations) {
        showDecorations = newShowDecorations
        checkCurrentFiles(showDecorations)
      }
    }
  })

  const onDidChangeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor(
    (texteditor: vscode.TextEditor | undefined) => {
      if (texteditor !== undefined) {
        handleFile(texteditor.document, showDecorations)
      }
    },
  )

  // TODO maybe have timeout on fetching dependencies instead? Now it looks weird when we delete rows
  let timeout: NodeJS.Timeout
  const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument(
    (e: vscode.TextDocumentChangeEvent) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        handleFile(e.document, showDecorations)
      }, 500)
    },
  )

  checkCurrentFiles(showDecorations)

  // vscode.workspace.onDidOpenTextDocument((e: vscode.TextDocument) => {})
  // vscode.workspace.onDidSaveTextDocument((e: vscode.TextDocument) => {})
  // vscode.window.onDidChangeVisibleTextEditors((e: vscode.TextEditor[]) => {})

  const disposable = vscode.commands.registerCommand('package-json-upgrade.toggle-show', () => {
    showDecorations = !showDecorations
    checkCurrentFiles(showDecorations)
  })

  context.subscriptions.push(
    onConfigChange,
    onDidChangeActiveTextEditor,
    onDidChangeTextDocument,
    disposable,
  )

  activateCodeActionStuff(context)
}

const checkCurrentFiles = (showDecorations: boolean) => {
  vscode.window.visibleTextEditors.forEach(textEditor => {
    handleFile(textEditor.document, showDecorations)
  })
}

const activateCodeActionStuff = (context: vscode.ExtensionContext) => {
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider('json', new UpdateAction(), {
      providedCodeActionKinds: UpdateAction.providedCodeActionKinds,
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(OPEN_URL_COMMAND, url => {
      vscode.env.openExternal(vscode.Uri.parse(url))
    }),
  )
}

export class UpdateAction implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix]

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): vscode.CodeAction[] | undefined {
    if (!isPackageJson(document) || !isInDependency(document, range.start.line)) {
      return
    }

    if (range.isSingleLine === false) {
      return
    }

    const lineText = document.lineAt(range.start.line).text
    const dep = parseDependencyLine(lineText)
    if (dep === undefined) {
      return
    }
    const npmCache = getCachedNpmData(dep.dependencyName)
    if (npmCache === undefined || npmCache.item === undefined) {
      return
    }

    const wholeLineRange = new vscode.Range(range.start.line, 0, range.start.line, lineText.length)
    const actions = []

    const possibleUpgrades = getPossibleUpgrades(npmCache.item.npmData, dep.currentVersion)

    if (possibleUpgrades.major !== undefined) {
      actions.push(
        this.createFix(
          document,
          wholeLineRange,
          'major',
          dep.currentVersion,
          possibleUpgrades.major.version,
        ),
      )
    }
    if (possibleUpgrades.minor !== undefined) {
      actions.push(
        this.createFix(
          document,
          wholeLineRange,
          'minor',
          dep.currentVersion,
          possibleUpgrades.minor.version,
        ),
      )
    }
    if (possibleUpgrades.patch !== undefined) {
      actions.push(
        this.createFix(
          document,
          wholeLineRange,
          'patch',
          dep.currentVersion,
          possibleUpgrades.patch.version,
        ),
      )
    }

    if (npmCache.item.npmData.homepage !== undefined) {
      const commandAction = this.createHomepageCommand(npmCache.item.npmData.homepage)
      actions.push(commandAction)
    }

    const changelog = getCachedChangelog(dep.dependencyName)
    if (changelog !== undefined && changelog.item !== undefined) {
      const commandAction = this.createChangelogCommand(changelog.item)
      actions.push(commandAction)
    }

    return actions
  }

  private createFix(
    document: vscode.TextDocument,
    range: vscode.Range,
    type: string,
    currentVersion: string,
    newVersion: string,
  ): vscode.CodeAction {
    const lineText = document.lineAt(range.start.line).text
    const newLineText = replaceLastOccuranceOf(lineText, currentVersion, newVersion)

    const fix = new vscode.CodeAction(
      `Do ${type} upgrade to ${newVersion}`,
      vscode.CodeActionKind.Empty,
    )
    fix.edit = new vscode.WorkspaceEdit()
    fix.edit.replace(document.uri, range, newLineText)
    return fix
  }

  private createHomepageCommand(url: string): vscode.CodeAction {
    const action = new vscode.CodeAction('Open homepage', vscode.CodeActionKind.Empty)
    action.command = {
      command: OPEN_URL_COMMAND,
      title: 'Open homepage',
      tooltip: 'This will open the dependency homepage.',
      arguments: [url],
    }
    return action
  }

  private createChangelogCommand(url: string): vscode.CodeAction {
    const action = new vscode.CodeAction('Open changelog', vscode.CodeActionKind.Empty)
    action.command = {
      command: OPEN_URL_COMMAND,
      title: 'Open changelog',
      tooltip: 'This will open the dependency changelog.',
      arguments: [url],
    }
    return action
  }
}

export function deactivate() {
  //
}
