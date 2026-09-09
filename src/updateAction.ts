import * as path from 'path'
import * as vscode from 'vscode'

import { getChangelogUrl } from './changelog'
import {
  getDependencyFromDocumentLine,
  getUpdatedLineText,
  isDependencyFile,
} from './dependencyFile'
import { GO_TO_CATALOG_ENTRY_COMMAND, OPEN_URL_COMMAND } from './extension'
import { getCachedNpmData, getExactVersion, getPossibleUpgrades } from './npm'
import { CatalogDefinition } from './workspace'

export class UpdateAction implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix]

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): vscode.CodeAction[] | undefined {
    if (isDependencyFile(document) === false) {
      return
    }

    if (range.isSingleLine === false) {
      return
    }

    const dep = getDependencyFromDocumentLine(document, range.start.line)
    if (dep === undefined) {
      return
    }

    // A catalog dependency gets its version from another file entirely, so there is
    // nothing on this line to upgrade. Offer to go look at the entry instead.
    if (dep.isCatalog === true) {
      if (dep.catalogDefinition === undefined) {
        return
      }
      return [this.createGoToCatalogEntryCommand(dep.catalogDefinition)]
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
    const newLineText = getUpdatedLineText(document, lineText, currentVersion, newVersion)

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

  private createGoToCatalogEntryCommand(definition: CatalogDefinition): vscode.CodeAction {
    const fileName = path.basename(definition.filePath)
    const action = new vscode.CodeAction(
      `Go to catalog entry in ${fileName}`,
      vscode.CodeActionKind.Empty,
    )
    action.command = {
      command: GO_TO_CATALOG_ENTRY_COMMAND,
      title: 'Go to catalog entry',
      tooltip: 'This will open the workspace file at the line the version is defined on.',
      arguments: [definition],
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
