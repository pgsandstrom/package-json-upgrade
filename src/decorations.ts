import { ReleaseType } from 'semver'
import {
  DecorationRenderOptions,
  OverviewRulerLane,
  TextEditorDecorationType,
  ThemableDecorationRenderOptions,
  window,
} from 'vscode'
import { getConfig } from './config'

type DecorationTypeConfigurables = {
  overviewRulerColor: string // the color shown on the scrollbar
  light: ThemableDecorationRenderOptions
  dark: ThemableDecorationRenderOptions
  contentText: string
}

const decorateUpdatedPackage = ({
  overviewRulerColor,
  light,
  dark,
  contentText,
}: DecorationTypeConfigurables) => {
  const config = getConfig()
  const decorationType: DecorationRenderOptions = {
    isWholeLine: false,
    after: {
      margin: '2em',
      contentText,
    },
    light,
    dark,
  }

  if (config.showOverviewRulerColor) {
    decorationType.overviewRulerLane = OverviewRulerLane.Right
    decorationType.overviewRulerColor = overviewRulerColor
  }

  return window.createTextEditorDecorationType(decorationType)
}

const decorateMajorUpdate = (contentText: string) => {
  const settingsColor = getConfig().majorUpgradeColorOverwrite
  return decorateUpdatedPackage({
    overviewRulerColor: getCorrectColor(settingsColor, '#578EFF'),
    light: { after: { color: getCorrectColor(settingsColor, '#0028A3') } },
    dark: { after: { color: getCorrectColor(settingsColor, '#578EFF') } },
    contentText,
  })
}

const decorateMinorUpdate = (contentText: string) => {
  const settingsColor = getConfig().minorUpgradeColorOverwrite
  return decorateUpdatedPackage({
    overviewRulerColor: getCorrectColor(settingsColor, '#FFC757'),
    light: { after: { color: getCorrectColor(settingsColor, '#A37B00') } },
    dark: { after: { color: getCorrectColor(settingsColor, '#FFC757') } },
    contentText,
  })
}

const decoratePatchUpdate = (contentText: string) => {
  const settingsColor = getConfig().patchUpgradeColorOverwrite
  return decorateUpdatedPackage({
    overviewRulerColor: getCorrectColor(settingsColor, '#57FF73'),
    light: { after: { color: getCorrectColor(settingsColor, '#00A329') } },
    dark: { after: { color: getCorrectColor(settingsColor, '#57FF73') } },
    contentText,
  })
}

const decoratePrereleaseUpdate = (contentText: string) => {
  const settingsColor = getConfig().prereleaseUpgradeColorOverwrite
  return decorateUpdatedPackage({
    overviewRulerColor: getCorrectColor(settingsColor, '#FF57E3'),
    light: { after: { color: getCorrectColor(settingsColor, '#A3007A') } },
    dark: { after: { color: getCorrectColor(settingsColor, '#FF57E3') } },
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
