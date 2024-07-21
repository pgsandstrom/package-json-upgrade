# Change Log

All notable changes to the "package-json-upgrade" extension will be documented in this file.

## 2.1.3

- Upgrades no longer shown in gitDiff view
- Fix issue with flickering and disappearing upgrade text

## 2.1.2

- Downgrade npm-registry-fetch to avoid issue with npm registry on localhost

## 2.1.1

- Fixed issue with loading in json files associated with jsonc

## 2.1.0

- The extension will also start on detected language "jsonc" as well as "json"

## 2.0.0

- Package.json will now be decorated as soon as each dependency is loaded, instead of waiting for every dependency to finish.
- Fix several issues related to fetching dependencies over and over again if opening the file several times.
- Fix issue related to re-painting decorators when text has not changed.
- Improve parsing of package.json. We now find the correct lines with correct AST-parsing instead of regexp-hack.
- Added "loading" appearing on each line when dependency information is slow to load. This is configurable.

## 1.6.0

- Add a warning when a non-existing version is used

## 1.5.3

- Fix issue with "update all" command not respecting ignored version ranges
- Fix issue with "update all" command not respecting ignored dependencies
- Fix issue with "update all" command replacing "\*" with latest version

## 1.5.2

- Add license and keywords

## 1.5.0

- Add config to ignore semver ranges for specific dependencies

## 1.4.0

- Add config for changing decoration string
- Add ignorePatterns for dependencies

## 1.3.0

- We no longer ignore latest-tag when current version is a prerelease. Instead latest-tag is ignored if current version is higher than latest.

## 1.2.3

- Show all prereleases when current version is a prerelease. This fixes a bug when all releases were prereleases.

## 1.2.2

- Fix bug in finding changelog

## 1.2.1

- Fix crash when all releases for a dependency was prereleases
- Fix issue with not detecting updates on prereleases using tilde or caret ranges

## 1.2.0

- Do not suggest updates further than the "latest" dist-tag

## 1.1.1

- Respect the per-project config file (/path/to/my/project/.npmrc)

## 1.1.0

- Add support for prereleases

## 1.0.5

- Avoid error message when version is '\*' or 'x'
- Use the local npm configuration for all npm commands

## 1.0.4

- Fix compatibility issue with v1.42.0 of vscode

## 1.0.3

- Add configuration to change color of upgrade info text
- Disable upgrade info text and code actions for peer dependencies since it doesn't make any sense to have them

## 1.0.2

- Preserve ~ and ^ when updating
- Add "update all" command

## 1.0.1

- Fix parsing of versions containing ~ and ^

## 1.0.0

- Initial release
