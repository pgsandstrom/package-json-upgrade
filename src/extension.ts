import * as vscode from 'vscode'
import { getConfig, reloadConfig } from './config'
import { cleanNpmCache } from './npm'
import { handleFileDecoration } from './texteditor'
import { UpdateAction } from './updateAction'
import { updateAll } from './updateAll'

export const OPEN_URL_COMMAND = 'package-json-upgrade.open-url-command'

export function activate(context: vscode.ExtensionContext) {
  reloadConfig()

  let showDecorations = getConfig().showUpdatesAtStart

  const onConfigChange = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('package-json-upgrade')) {
      reloadConfig()
      cleanNpmCache()
      checkCurrentFiles(showDecorations)
    }
  })

  const onDidChangeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor(
    (texteditor: vscode.TextEditor | undefined) => {
      if (texteditor !== undefined) {
        handleFileDecoration(texteditor.document, showDecorations)
      }
    },
  )

  // TODO maybe have timeout on fetching dependencies instead? Now it looks weird when we delete rows
  let timeout: NodeJS.Timeout
  const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument(
    (e: vscode.TextDocumentChangeEvent) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        handleFileDecoration(e.document, showDecorations)
      }, 500)
    },
  )

  checkCurrentFiles(showDecorations)

  // vscode.workspace.onDidOpenTextDocument((e: vscode.TextDocument) => {})
  // vscode.workspace.onDidSaveTextDocument((e: vscode.TextDocument) => {})
  // vscode.window.onDidChangeVisibleTextEditors((e: vscode.TextEditor[]) => {})

  const toggleShowCommand = vscode.commands.registerCommand(
    'package-json-upgrade.toggle-show',
    () => {
      showDecorations = !showDecorations
      checkCurrentFiles(showDecorations)
    },
  )

  const updateAllCommand = vscode.commands.registerCommand(
    'package-json-upgrade.update-all',
    () => {
      updateAll(vscode.window.activeTextEditor)
    },
  )

  context.subscriptions.push(
    onConfigChange,
    onDidChangeActiveTextEditor,
    onDidChangeTextDocument,
    toggleShowCommand,
    updateAllCommand,
  )

  activateCodeActionStuff(context)
}

const checkCurrentFiles = (showDecorations: boolean) => {
  vscode.window.visibleTextEditors.forEach((textEditor) => {
    handleFileDecoration(textEditor.document, showDecorations)
  })
}

const activateCodeActionStuff = (context: vscode.ExtensionContext) => {
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider('json', new UpdateAction(), {
      providedCodeActionKinds: UpdateAction.providedCodeActionKinds,
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(OPEN_URL_COMMAND, (url: string) => {
      vscode.env.openExternal(vscode.Uri.parse(url))
    }),
  )
}

export function deactivate() {
  //
}
