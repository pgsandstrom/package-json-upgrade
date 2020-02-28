import * as vscode from 'vscode'
import { OPEN_URL_COMMAND } from './extension'
import { getCachedChangelog, getCachedNpmData, getPossibleUpgrades } from './npm'
import { parseDependencyLine } from './packageJson'
import { getLineLimitForLine, isPackageJson } from './texteditor'
import { replaceLastOccuranceOf } from './util/util'

export class UpdateAction implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix]

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): vscode.CodeAction[] | undefined {
    const lineLimit = getLineLimitForLine(document, range.start.line)

    if (isPackageJson(document) === false || lineLimit === undefined) {
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

    if (lineLimit.isPeerDependency === false) {
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
      if (possibleUpgrades.prerelease !== undefined) {
        actions.push(
          this.createFix(
            document,
            wholeLineRange,
            'prerelease',
            dep.currentVersion,
            possibleUpgrades.prerelease.version,
          ),
        )
      }
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
    rawCurrentVersion: string,
    newVersion: string,
  ): vscode.CodeAction {
    const lineText = document.lineAt(range.start.line).text
    const currentVersion =
      rawCurrentVersion.startsWith('~') || rawCurrentVersion.startsWith('^')
        ? rawCurrentVersion.substring(1)
        : rawCurrentVersion
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
