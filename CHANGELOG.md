# Change Log

All notable changes to the "package-json-upgrade" extension will be documented in this file.

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
