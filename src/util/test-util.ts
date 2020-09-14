import * as vscode from 'vscode'

export const logToFile = async (content: string, fileName?: string) => {
  if (fileName === undefined) {
    fileName = 'test-log'
  }
  const uri = vscode.Uri.parse(`./tmp/${fileName}`)
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content))
}
