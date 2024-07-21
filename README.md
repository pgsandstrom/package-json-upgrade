# package-json-upgrade

Shows available updates in package.json. Offers quick actions to guide you in your updating.

## Preview

The available updates are shown as color coded decoration to the right of each line.

![feature X](images/preview1.png)

The extension adds code actions that are available through the quick fix-command. Default keyboard shortcut is "ctrl + ."

These quick actions can update the dependency, but also links to the homepage and, if found, the changelog.

![feature X](images/preview2.png)

The extension will pick up your npm configurations and use them, so it works with proxies, private npm registries and scopes.

The extension also adds a command to update all dependencies in the package.json file.

## Extension Settings

It is possible to add one or several regexp:s of dependencies that should be ignored by the extension. If you want to ignore all `@types` then your `settings.json` should look like this:

```
"package-json-upgrade.ignorePatterns": ["^@types/.+$"],
```

It is also possible to add ranges for versions that you wish to ignore. Lets say your application uses node v18. Then you can specify to ignore ">18" for "@types/node". The ranges should adhere to [node-semver](https://github.com/npm/node-semver?tab=readme-ov-file#ranges). The final json in your `settings.json` should look like this:

```
"package-json-upgrade.ignoreVersions": {
  "@types/node": ">18"
},
```

A config is available to control if the updates should always be shown when a package.json is opened, or if they should only be shown after triggering a command called "Toggle showing package.json available updates". This can be useful if you find that this extension is in the way when you are doing other work in your package.json file.

And many more configurations exists. Check out your vscode settings for the complete list.

## Install

[How to install vscode extensions](https://code.visualstudio.com/docs/editor/extension-gallery)

[ Logo Credit ](https://smashicons.com)
