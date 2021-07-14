# Change Log

All notable changes to the "bracket-lens" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## 1.5.1 - 2021-07-14

- add shortcut `shift+alt+\` to execute `bracketLens.updateBrackets` for manual update mode
- add shortcut `shift+alt+}` to execute `bracketLens.toggleMuteAll`

> Note: we could use the default vscode shortcut `ctrl+shift+\` to jumpToBracket. :D

## 1.5.0 - 2020-12-16

### Added

- `bracketLens.mode` setting item. ( The original default is `auto`, but until the performance issue is resolved,` manual` is the default. )

### Removed

- `bracketLens.enabled` setting item.

## 1.4.6 - 2020-12-15

### Changed

- The update delay has been significantly increased. ( until performance issue is resolved )

## 1.4.5 - 2020-12-14

### Changed

- `bracketLens.enabled`'s default value: true -> false ( until performance issue is resolved )

## 1.4.4 - 2020-12-05

### Fixed

- Fixed an issue where string escaping could not be handled properly in a pattern.

## 1.4.3 - 2020-12-02

### Changed

- `activationEvents`: `*` -> `onStartupFinished`

## 1.4.2 - 2020-11-25

### Changed

- Adjusted the update delay.

## 1.4.1 - 2020-11-24

### Changed

- Increased update delay for inactive text editors.

## 1.4.0 - 2020-11-15

### Added

- `ignoreSymbols` setting in `bracketLens.languageConfiguration` setting.

## 1.3.1 - 2020-11-12

### Fixed

- Fixed an issue that could cause it to work on the output panel.

## 1.3.0 - 2020-11-10

### Added

- `terminators` setting in `bracketLens.languageConfiguration` setting.

### Fixed

- Clerical error about `bracketLens.enabled` in README.

## 1.2.0 - 2020-10-29

### Added

- `Bracket Lens: Toggle Mute` command and `Bracket Lens: Toggle Mute All` command.

## 1.1.0 - 2020-10-27

### Fixed

- Fixed an issue where changing the language specification in the editor did not take effect immediately.

### Changed

- Changed the handling of backquotes in default from inline strings to multiline strings.

## 1.0.0 - 2020-10-21

### Added

- 🎊 Initial release of Brackets Lens. 🎉

## [Unreleased]

## 0.0.0 - 2020-10-10

### Added

- Start this project.
