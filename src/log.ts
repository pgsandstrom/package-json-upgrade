// NOTE: vscode is imported lazily in initLogger to allow this module to be imported in Node.js tests without failing on the vscode module resolution.
let channel: import('vscode').LogOutputChannel | undefined

// REMEMBER: If log is not showing, then run command 'Developer:Set LogLevel' in vscode, and set to show 'Debug'.

export function initLogger(context: import('vscode').ExtensionContext) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const vscode = require('vscode') as typeof import('vscode')
  if (context.extensionMode !== vscode.ExtensionMode.Development) {
    return
  }
  channel = vscode.window.createOutputChannel('package-json-upgrade', { log: true })
  context.subscriptions.push(channel)
  logDebug('started logging')
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
