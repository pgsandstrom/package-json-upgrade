import { ReleaseType } from 'semver'
import { OverviewRulerLane, ThemableDecorationRenderOptions, window } from 'vscode'
import * as vscode from 'vscode'

const decorateUpdatedPackage = ({
  overviewRulerColor,
  light,
  dark,
  contentText,
}: {
  overviewRulerColor: string
  light: ThemableDecorationRenderOptions
  dark: ThemableDecorationRenderOptions
  contentText: string
}) => {
  return window.createTextEditorDecorationType({
    isWholeLine: false,
    overviewRulerLane: OverviewRulerLane.Right,
    after: {
      margin: '2em',
      contentText,
    },
    overviewRulerColor,
    light,
    dark,
  })
}

// TODO check that light theme looks good

const decorateMajorUpdate = (contentText: string) => {
  return decorateUpdatedPackage({
    overviewRulerColor: 'red',
    light: { after: { color: '#E03419' } },
    dark: { after: { color: '#C74632' } },
    contentText,
  })
}

const decorateMinorUpdate = (contentText: string) => {
  return decorateUpdatedPackage({
    overviewRulerColor: 'yellow',
    light: { after: { color: '#EEFF00' } },
    dark: { after: { color: '#F8FF99' } },
    contentText,
  })
}

const decoratePatchUpdate = (contentText: string) => {
  return decorateUpdatedPackage({
    overviewRulerColor: 'green',
    light: { after: { color: '#19e034' } },
    dark: { after: { color: '#32C746' } },
    contentText,
  })
}

// currently we just show nothing when no update is available
// const decorateNonUpdate = (contentText: string) => {
//   return decorateUpdatedPackage({
//     overviewRulerColor: 'darkgray',
//     light: { color: 'lightgray', after: { color: 'lightgray' } },
//     dark: { color: 'darkgray', after: { color: 'darkgray' } },
//     contentText,
//   })
// }

export const decorateNotFound = (contentText: string) => {
  return decorateUpdatedPackage({
    overviewRulerColor: 'darkgray',
    light: { color: 'lightgray', after: { color: 'lightgray' } },
    dark: { color: 'darkgray', after: { color: 'darkgray' } },
    contentText,
  })
}

// "major" | "premajor" | "minor" | "preminor" | "patch" | "prepatch" | "prerelease";
export const getDecoratorForUpdate = (
  releaseType: ReleaseType | null,
  currentVersion?: string,
  latestVersion?: string,
): vscode.TextEditorDecorationType | undefined => {
  switch (releaseType) {
    case 'major':
    case 'premajor':
      return decorateMajorUpdate(`Installed: ${currentVersion}\t\t Latest: ${latestVersion}`)
    case 'minor':
    case 'preminor':
      return decorateMinorUpdate(`Installed: ${currentVersion}\t\t Latest: ${latestVersion}`)
    case 'patch':
    case 'prepatch':
    case 'prerelease':
      // TODO wtf is these version releasetypes
      return decoratePatchUpdate(`Installed: ${currentVersion}\t\t Latest: ${latestVersion}`)
    case null:
      return undefined
    // return decorateNonUpdate('Latest version used')
  }
}
