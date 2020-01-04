export const parseDependencyLine = (line: string) => {
  const regexResult = /\s*"([^"]*)"\s*:\s*"([^"]*)"\s*/.exec(line)
  if (regexResult === null || regexResult.length !== 3) {
    console.error(`detected weird dependency string: ${line}`)
    return undefined
  }

  return {
    dependencyName: regexResult[1],
    currentVersion: regexResult[2],
  }
}
