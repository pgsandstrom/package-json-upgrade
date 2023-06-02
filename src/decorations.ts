import { ReleaseType } from 'semver'
import {
  OverviewRulerLane,
  TextEditorDecorationType,
  ThemableDecorationRenderOptions,
  window,
} from 'vscode'
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

const decoratePrereleaseUpdate = (contentText: string) => {
  const settingsColor = getConfig().prereleaseUpgradeColorOverwrite
  return decorateUpdatedPackage({
    overviewRulerColor: 'purple',
    light: { after: { color: getCorrectColor(settingsColor, '#C433FF') } },
    dark: { after: { color: getCorrectColor(settingsColor, '#EC33FF') } },
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

export const decorateDiscreet = (contentText: string): TextEditorDecorationType => {
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
  text: string,
): TextEditorDecorationType | undefined => {
  switch (releaseType) {
    case 'major':
    case 'premajor':
      return decorateMajorUpdate(text)
    case 'minor':
    case 'preminor':
      return decorateMinorUpdate(text)
    case 'patch':
    case 'prepatch':
      return decoratePatchUpdate(text)
    case 'prerelease':
      return decoratePrereleaseUpdate(text)
    case null:
    default:
      return undefined
  }
}

export function getUpdateDescription(
  latestVersion: string,
  currentVersionExisting: boolean,
): string {
  const versionString = getConfig().decorationString.replace('%s', latestVersion)
  if (currentVersionExisting) {
    return versionString
  } else {
    return `${versionString} (current version not found)`
  }
}
