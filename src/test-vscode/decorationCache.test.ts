/// <reference types="mocha" />
import * as assert from 'assert'
import * as vscode from 'vscode'

import { clearDecorations, updateCache } from '../texteditor'

const createDocument = (fileName: string): vscode.TextDocument => {
  return { fileName } as vscode.TextDocument
}

const createDecoration = (): vscode.TextEditorDecorationType => {
  return {
    dispose: () => {
      //
    },
  } as vscode.TextEditorDecorationType
}

suite('Decoration cache Test Suite', () => {
  setup(() => {
    clearDecorations()
  })

  test('Two documents can decorate the same line with the same text', () => {
    const packageJson = createDocument('/a/package.json')
    const workspaceFile = createDocument('/a/pnpm-workspace.yaml')

    assert.strictEqual(updateCache(createDecoration(), packageJson, 4, 'Update to 1.2.3'), true)
    // Before the cache was keyed per document, this returned false and the decoration
    // of the second visible file was never painted.
    assert.strictEqual(updateCache(createDecoration(), workspaceFile, 4, 'Update to 1.2.3'), true)
  })

  test('The same document and line with the same text is only painted once', () => {
    const packageJson = createDocument('/a/package.json')

    assert.strictEqual(updateCache(createDecoration(), packageJson, 4, 'Update to 1.2.3'), true)
    assert.strictEqual(updateCache(createDecoration(), packageJson, 4, 'Update to 1.2.3'), false)
    assert.strictEqual(updateCache(createDecoration(), packageJson, 4, 'Update to 1.2.4'), true)
  })
})
