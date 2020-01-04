// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'
import { getCachedChangelog, getCachedNpmData, getPossibleUpgrades } from './npm'
import { parseDependencyLine } from './packageJson'
import { handleFile, isInDependency, isPackageJson } from './texteditor'
import { replaceLastOccuranceOf } from './util/util'

const OPEN_URL_COMMAND = 'package-json-upgrade.open-url-command'

export function activate(context: vscode.ExtensionContext) {
  vscode.window.onDidChangeVisibleTextEditors((e: vscode.TextEditor[]) => {
    e.filter(texteditor => isPackageJson(texteditor.document)).forEach(texteditor => {
      handleFile(texteditor.document)
    })
  })

  vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
    // TODO timeout?
    console.log('did change text document')
    handleFile(e.document, true)
  })

  vscode.window.visibleTextEditors.forEach(textEditor => {
    handleFile(textEditor.document)
  })

  // vscode.workspace.onDidOpenTextDocument((e: vscode.TextDocument) => {})
  // vscode.workspace.onDidSaveTextDocument((e: vscode.TextDocument) => {})
  // vscode.window.onDidChangeActiveTextEditor((e: vscode.TextEditor | undefined) => {})

  // TODO fix commands
  const disposable = vscode.commands.registerCommand('extension.helloWorld', () => {
    vscode.window.showInformationMessage('Hello World!')
  })

  context.subscriptions.push(disposable)

  activateCodeActionStuff(context)
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
    if (npmCache === undefined) {
      return
    }

    const wholeLineRange = new vscode.Range(range.start.line, 0, range.start.line, lineText.length)
    const actions = []

    const possibleUpgrades = getPossibleUpgrades(npmCache.npmData, dep.currentVersion)

    if (possibleUpgrades.major !== undefined) {
      actions.push(
        this.createFix(
          document,
          wholeLineRange,
          'Major',
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
          'Minor',
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
          'Patch',
          dep.currentVersion,
          possibleUpgrades.patch.version,
        ),
      )
    }

    if (npmCache.npmData.homepage !== undefined) {
      const commandAction = this.createHomepageCommand(npmCache.npmData.homepage)
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
      `${type} upgrade to ${newVersion}`,
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
