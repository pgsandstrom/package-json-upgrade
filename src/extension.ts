import * as vscode from 'vscode'

import { Config, getConfig, setConfig } from './config'
import { initGithubCache } from './githubCache'
import { initLogger } from './log'
import { cleanNpmCache } from './npm'
import { clearDecorations, handleFileDecoration } from './texteditor'
import { UpdateAction } from './updateAction'
import { updateAll } from './updateAll'

export const OPEN_URL_COMMAND = 'package-json-upgrade.open-url-command'

export async function activate(context: vscode.ExtensionContext) {
  try {
    await activateWrapped(context)
  } catch (e) {
    console.error(`failed to start`)
    if (e instanceof Error) {
      console.error(e.name, e.message)
      console.error(e.stack)
    }
  }
}

async function activateWrapped(context: vscode.ExtensionContext) {
  initLogger(context)
  await initGithubCache(context.globalState)

  fixConfig()

  let showDecorations = getConfig().showUpdatesAtStart

  const onConfigChange = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('package-json-upgrade')) {
      fixConfig()
      cleanNpmCache()
      checkCurrentFiles(showDecorations)
    }
  })

  const onDidChangeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor(
    (texteditor: vscode.TextEditor | undefined) => {
      if (texteditor !== undefined) {
        checkCurrentFiles(showDecorations)
      }
    },
  )

  // TODO maybe have timeout on fetching dependencies instead? Now it looks weird when we delete rows
  let timeout: NodeJS.Timeout
  const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument(
    (e: vscode.TextDocumentChangeEvent) => {
      // other sources can trigger document changes in whatever document.
      // Sometimes I get one from `git\scm0\input` when booting.
      // Then we can safely ignore the changes.
      if (e.document !== vscode.window.activeTextEditor?.document) {
        return
      }

      clearTimeout(timeout)
      timeout = setTimeout(() => {
        checkCurrentFiles(showDecorations)
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

/**
 * Throws away every decoration and paints the visible files again.
 *
 * Every visible file, not just the one that changed: several dependency files can be
 * visible at once - a package.json next to the pnpm-workspace.yaml holding its
 * catalog is the common one - and since clearing is global, repainting only the
 * changed file would leave the others blank until something else triggered a full
 * pass.
 *
 * Clearing everything first is what guarantees the repaint. The decoration cache
 * skips lines whose text has not changed, and a document reopened in a new editor
 * has lost its decorations while keeping its cache entries, so a cache we did not
 * clear could talk us out of painting a file that is showing nothing.
 */
const checkCurrentFiles = (showDecorations: boolean) => {
  clearDecorations()

  if (!showDecorations) {
    return
  }

  vscode.window.visibleTextEditors.forEach((textEditor) => {
    handleFileDecoration(textEditor.document)
  })
}

const activateCodeActionStuff = (context: vscode.ExtensionContext) => {
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      [{ pattern: '**/package.json' }, { pattern: '**/pnpm-workspace.yaml' }],
      new UpdateAction(),
      {
        providedCodeActionKinds: UpdateAction.providedCodeActionKinds,
      },
    ),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(OPEN_URL_COMMAND, (url: string) => {
      void vscode.env.openExternal(vscode.Uri.parse(url))
    }),
  )
}

export function deactivate() {
  //
}

const fixConfig = () => {
  const workspaceConfig = vscode.workspace.getConfiguration('package-json-upgrade')

  const decorationString = workspaceConfig.get<string>('decorationString')

  const config: Config = {
    showUpdatesAtStart: workspaceConfig.get<boolean>('showUpdatesAtStart') === true,
    showOverviewRulerColor: workspaceConfig.get<boolean>('showOverviewRulerColor') === true,
    skipNpmConfig: workspaceConfig.get<boolean>('skipNpmConfig') === true,
    majorUpgradeColorOverwrite: workspaceConfig.get<string>('majorUpgradeColorOverwrite') ?? '',
    minorUpgradeColorOverwrite: workspaceConfig.get<string>('minorUpgradeColorOverwrite') ?? '',
    patchUpgradeColorOverwrite: workspaceConfig.get<string>('patchUpgradeColorOverwrite') ?? '',
    prereleaseUpgradeColorOverwrite:
      workspaceConfig.get<string>('prereleaseUpgradeColorOverwrite') ?? '',
    decorationString:
      decorationString !== undefined && decorationString !== '' ? decorationString : '\t-> %s',
    ignorePatterns: workspaceConfig.get<string[]>('ignorePatterns') ?? [],
    ignoreVersions:
      workspaceConfig.get<Record<string, string | undefined | string[]>>('ignoreVersions') ?? {},
    msUntilRowLoading: workspaceConfig.get<number>('msUntilRowLoading') ?? 0,
    dependencyGroups: (
      workspaceConfig.get<string>('dependencyGroups') ??
      'dependencies, devDependencies, catalog, catalogs, workspaces.catalog, workspaces.catalogs'
    )
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
    minimumReleaseAge: Math.max(0, workspaceConfig.get<number>('minimumReleaseAge') ?? 0),
    minimumReleaseAgeExclude: workspaceConfig.get<string[]>('minimumReleaseAgeExclude') ?? [],
  }
  setConfig(config)
}
