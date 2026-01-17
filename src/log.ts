// logger.ts
import * as vscode from 'vscode'

let channel: vscode.LogOutputChannel | undefined

export function initLogger(context: vscode.ExtensionContext) {
  if (context.extensionMode !== vscode.ExtensionMode.Development) {
    return
  }
  logDebug('started logging')
  channel = vscode.window.createOutputChannel('package-json-upgrade', { log: true })
  context.subscriptions.push(channel)
}

export function logDebug(message: string, caughtError?: unknown) {
  log('debug', message, caughtError)
}

export function logError(message: string, caughtError?: unknown) {
  log('error', message, caughtError)
}

// add other debug functions as necessary

function log(type: 'debug' | 'error', message?: string, caughtError?: unknown) {
  if (!channel) {
    return
  }
  //   console.log(`test log`, message)
  if (message !== undefined) {
    channel[type](message)
  }
  if (caughtError !== undefined) {
    if (caughtError instanceof Error) {
      channel[type](`Caught error: ${caughtError.name}:${caughtError.message}`)
      channel[type](caughtError.stack ?? 'no stack')
    } else {
      channel[type](`caught non error: ${JSON.stringify(caughtError)}`)
    }
  }
  if (type === 'error') {
    channel.show(true)
  }
}
