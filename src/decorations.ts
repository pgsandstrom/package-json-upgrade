import { ReleaseType } from 'semver'
import { OverviewRulerLane, ThemableDecorationRenderOptions, window } from 'vscode'
import * as vscode from 'vscode'
import { getConfig } from './config'

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

// TODO make colors configurable

const decorateMajorUpdate = (contentText: string) => {
  const settingsColor = getConfig().majorUpgradeColorOverwrite
  return decorateUpdatedPackage({
    overviewRulerColor: 'red',
    light: { after: { color: getCorrectColor(settingsColor, '#C74632') } },
    dark: { after: { color: getCorrectColor(settingsColor, '#E03419') } },
    contentText,
  })
}

const decorateMinorUpdate = (contentText: string) => {
  const settingsColor = getConfig().minorUpgradeColorOverwrite
  return decorateUpdatedPackage({
    overviewRulerColor: 'yellow',
    light: { after: { color: getCorrectColor(settingsColor, '#ABAB00') } },
    dark: { after: { color: getCorrectColor(settingsColor, '#F8FF99') } },
    contentText,
  })
}

const decoratePatchUpdate = (contentText: string) => {
  const settingsColor = getConfig().patchUpgradeColorOverwrite
  return decorateUpdatedPackage({
    overviewRulerColor: 'green',
    light: { after: { color: getCorrectColor(settingsColor, '#009113') } },
    dark: { after: { color: getCorrectColor(settingsColor, '#19E034') } },
    contentText,
  })
}

const getCorrectColor = (settingsColor: string, defaultColor: string): string => {
  if (settingsColor === '') {
    return defaultColor
  }
  if (settingsColor.startsWith('#')) {
    return settingsColor
  } else {
    return `#${settingsColor}`
  }
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

export const decorateDiscreet = (contentText: string) => {
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
  latestVersion?: string,
): vscode.TextEditorDecorationType | undefined => {
  switch (releaseType) {
    case 'major':
    case 'premajor':
      return decorateMajorUpdate(`\t\tUpdate available: ${latestVersion}`)
    case 'minor':
    case 'preminor':
      return decorateMinorUpdate(`\t\tUpdate available: ${latestVersion}`)
    case 'patch':
    case 'prepatch':
    case 'prerelease':
      // TODO wtf is these version releasetypes
      return decoratePatchUpdate(`\t\tUpdate available: ${latestVersion}`)
    case null:
      return undefined
    // return decorateNonUpdate('Latest version used')
  }
}
