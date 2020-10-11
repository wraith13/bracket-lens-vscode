# Bracket Lens for VS Code

[![Visual Studio Marketplace](https://vsmarketplacebadge.apphb.com/version/wraith13.bracket-lens.svg) ![installs](https://vsmarketplacebadge.apphb.com/installs/wraith13.bracket-lens.svg) ![rating](https://vsmarketplacebadge.apphb.com/rating/wraith13.bracket-lens.svg)](https://marketplace.visualstudio.com/items?itemName=wraith13.bracket-lens)

Show bracket head on closing bracket.

🚧 Under development.

## Features

### Screenshots

## Tutorial

### 0. ⬇️ Install Bracket Lens

Show extension side bar within VS Code(Mac:`Command`+`Shift`+`X`, Windows and Linux: `Ctrl`+`Shift`+`X`), type `Bracket Lens` and press `Enter` and click `Install`.

### 1. 🚀 Edit settings

Launch Command Palette, Execute `Bracket Lens: Edit Settings` command or click gear icon on status bar or keyboard shortcut ( Mac:`Command`+`Shift`+`,`, Windows and Linux: `Ctrl`+`Shift`+`,` ). You can edit VS Code settings.

### 2. 🔧 Next step

You can change [settings](#extension-settings). And you can edit [keyboard shortcuts](#keyboard-shortcut-settings) by `keybindings.json`.

Enjoy!

## Commands

* `Bracket Lens: Edit Settings` : Edit VS Code's settings.
* `Bracket Lens: Undo Setting` : Undo VS Code's settings.
* `Bracket Lens: Redo Setting` : Redo VS Code's settings.
* `Bracket Lens: Clear Setting History` : Clear recently information. This command can only be used in debug mode.

## Extension Settings

This extension contributes the following settings by [`settings.json`](https://code.visualstudio.com/docs/customization/userandworkspace#_creating-user-and-workspace-settings)( Mac: `Command`+`,`, Windows / Linux: `File` -> `Preferences` -> `User Settings` ):

* `bracketLens.preview`: Temporarily apply the settings before confirming.
* `bracketLens.disabledPreviewSettings`: A list of settings for which you want to disable the settings preview.
* `bracketLens.debug`: Debug mode.
* `bracketLens.statusBarAlignment`: Alignment on status bar.
* `bracketLens.statusBarText`: Status bar's label.

## Keyboard shortcut Settings

You can edit keyboard shortcuts by [`keybindings.json`](https://code.visualstudio.com/docs/customization/keybindings#_customizing-shortcuts)
( Mac: `Code` -> `Preferences` -> `Keyboard Shortcuts`, Windows / Linux: `File` -> `Preferences` -> `Keyboard Shortcuts`).

Command name on `keybindings.json` is diffarent from on Command Pallete. See below table.

|on Command Pallete|on keybindings.json|default Keyboard shortcut|
|-|-|-|
|`Bracket Lens: Edit Settings`|`bracketLens.editSettings`|Mac:`Command`+`Shift`+`,`, Windows and Linux: `Ctrl`+`Shift`+`,`|
|`Bracket Lens: Undo Setting`|`bracketLens.undoSetting`|(none)|
|`Bracket Lens: Redo Setting`|`bracketLens.redoSetting`|(none)|
|`Bracket Lens: Clear Setting History`|`bracketLens.clearHistory`|(none)|

## Release Notes

see ChangLog on [marketplace](https://marketplace.visualstudio.com/items/wraith13.bracket-lens/changelog) or [github](https://github.com/wraith13/bracket-lens-vscode/blob/master/CHANGELOG.md)

## Support

[GitHub Issues](https://github.com/wraith13/bracket-lens-vscode/issues)

## License

[Boost Software License](https://github.com/wraith13/bracket-lens-vscode/blob/master/LICENSE_1_0.txt)

## Other extensions of wraith13's work

|Icon|Name|Description|
|---|---|---|
|![](https://wraith13.gallerycdn.vsassets.io/extensions/wraith13/background-phi-colors/3.1.0/1581619161244/Microsoft.VisualStudio.Services.Icons.Default) |[Background Phi Colors](https://marketplace.visualstudio.com/items?itemName=wraith13.background-phi-colors)|This extension colors the background in various ways.|
|![](https://wraith13.gallerycdn.vsassets.io/extensions/wraith13/blitz/1.10.0/1600673285404/Microsoft.VisualStudio.Services.Icons.Default) |[Blitz](https://marketplace.visualstudio.com/items?itemName=wraith13.blitz)|Provide a quick and comfortable way to change settings by quick pick based UI.|
|![](https://wraith13.gallerycdn.vsassets.io/extensions/wraith13/zoombar-vscode/1.2.1/1563089420894/Microsoft.VisualStudio.Services.Icons.Default) |[Zoom Bar](https://marketplace.visualstudio.com/items?itemName=wraith13.zoombar-vscode)|Zoom UI in status bar for VS Code.|

See all wraith13's  expansions: <https://marketplace.visualstudio.com/publishers/wraith13>
