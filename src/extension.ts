// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'
import { getCachedNpmData, getPossibleUpgrades } from './npm'
import { parseDependencyLine } from './packageJson'
import { handleFile, isInDependency, isPackageJson } from './texteditor'
import { replaceLastOccuranceOf } from './util/util'

const COMMAND = 'code-actions-sample.command'

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
    vscode.commands.registerCommand(COMMAND, () =>
      vscode.env.openExternal(
        vscode.Uri.parse('https://unicode.org/emoji/charts-12.0/full-emoji-list.html'),
      ),
    ),
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

    // const replaceWithSmileyCatFix = this.createFix(document, range, '😺')
    // const replaceWithSmileyFix = this.createFix(document, range, '😀')
    // Marking a single fix as `preferred` means that users can apply it with a
    // single keyboard shortcut using the `Auto Fix` command.
    // replaceWithSmileyFix.isPreferred = true
    // const replaceWithSmileyHankyFix = this.createFix(document, range, '💩')

    const commandAction = this.createCommand()
    actions.push(commandAction)

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

  private createCommand(): vscode.CodeAction {
    const action = new vscode.CodeAction('Learn more...', vscode.CodeActionKind.Empty)
    action.command = {
      command: COMMAND,
      title: 'Learn more about emojis',
      tooltip: 'This will open the unicode emoji page.',
    }
    return action
  }
}

export function deactivate() {
  //
}
