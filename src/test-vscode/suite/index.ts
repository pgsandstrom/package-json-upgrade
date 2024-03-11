import { glob } from 'glob'
import * as Mocha from 'mocha'
import * as path from 'path'

export async function run() {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
  })
  // mocha.options.color = true

  const testsRoot = path.resolve(__dirname, '..')

  const files = await glob('**/**.test.js', { cwd: testsRoot })

  // Add files to the test suite
  files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)))

  // Run the mocha test
  mocha.run((failures) => {
    if (failures > 0) {
      throw new Error(`${failures} tests failed.`)
    }
  })
}
