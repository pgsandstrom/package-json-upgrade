import * as vscode from 'vscode'

import { getChangelogUrl } from './changelog'
import { OPEN_URL_COMMAND } from './extension'
import { getCachedNpmData, getExactVersion, getPossibleUpgrades } from './npm'
import { getDependencyFromLine, isPackageJson } from './packageJson'
import { replaceLastOccuranceOf } from './util/util'

export class UpdateAction implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix]

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): vscode.CodeAction[] | undefined {
    if (isPackageJson(document) === false) {
      return
    }

    if (range.isSingleLine === false) {
      return
    }

    const dep = getDependencyFromLine(document.getText(), range.start.line)
    if (dep === undefined) {
      return
    }
    const npmCache = getCachedNpmData(dep.dependencyName)
    if (npmCache === undefined || npmCache.item === undefined) {
      return
    }

    const lineText = document.lineAt(range.start.line).text
    const wholeLineRange = new vscode.Range(range.start.line, 0, range.start.line, lineText.length)
    const actions: vscode.CodeAction[] = []

    const possibleUpgrades = getPossibleUpgrades(
      npmCache.item.npmData,
      dep.currentVersion,
      dep.dependencyName,
    )
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

    if (npmCache.item.npmData.homepage !== undefined) {
      const commandAction = this.createHomepageCommand(npmCache.item.npmData.homepage)
      actions.push(commandAction)
    }

    const changelogUrl = getChangelogUrl(npmCache.item.npmData)
    if (changelogUrl !== undefined) {
      const commandAction = this.createChangelogCommand(changelogUrl)
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
    const currentVersion = getExactVersion(rawCurrentVersion)
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
