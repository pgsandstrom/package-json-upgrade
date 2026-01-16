# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
# Compile TypeScript
npm run compile

# Watch mode for development
npm run watch

# Run all tests (Jest unit tests + VS Code integration tests)
npm run test

# Run only Jest unit tests
npm run test-jest

# Run only VS Code integration tests (requires compile first)
npm run pretest-vscode && npm run test-vscode

# Lint and fix
npm run lint

# Type check without emitting
npm run typecheck

# Format code
npm run format

# Build for production (webpack)
npm run vscode:prepublish

# Package extension
npm run package
```

## Architecture Overview

This is a VS Code extension that shows available npm package updates inline in `package.json` files.

### Core Flow

1. **Extension activation** (`src/extension.ts`): Registers event listeners for text editor changes, configuration changes, and commands. Activates on JSON/JSONC files.

2. **Package.json parsing** (`src/packageJson.ts`): Uses `@typescript-eslint/parser` to parse package.json as a TypeScript AST to extract dependency names, versions, and line numbers.

3. **NPM data fetching** (`src/npm.ts`):
   - Fetches package metadata from npm registry using `npm-registry-fetch`
   - Maintains an in-memory cache with 120-minute TTL
   - Uses `semver` library to calculate available upgrades (major/minor/patch/prerelease)
   - Also attempts to find CHANGELOG.md links on GitHub

4. **Decoration rendering** (`src/texteditor.ts`, `src/decorations.ts`):
   - Creates VS Code text decorations showing available updates
   - Color-coded by update type (major=blue, minor=yellow, patch=green, prerelease=pink)
   - Handles loading states and "not found" states

5. **Code actions** (`src/updateAction.ts`): Provides quick-fix actions to update versions, open homepage, or open changelog.

### Key Data Types

- `NpmData`: Package metadata from npm registry (versions, dist-tags, homepage)
- `DependencyUpdateInfo`: Available upgrades categorized by type (major/minor/patch/prerelease)
- `NpmLoader<T>`: Async state wrapper for cached npm data

### Test Structure

- **Jest tests** (`src/test-jest/`): Unit tests for npm version parsing logic
- **VS Code tests** (`src/test-vscode/`): Integration tests requiring VS Code runtime

### Configuration

User-configurable settings are defined in `package.json` under `contributes.configuration` and read via `src/config.ts`. Key settings include ignore patterns, color overrides, and decoration string format.
