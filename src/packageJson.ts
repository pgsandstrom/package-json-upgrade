import * as vscode from 'vscode'
import { parse } from '@typescript-eslint/parser'
import { TSESTree } from '@typescript-eslint/types'
import { VariableDeclaration } from '@typescript-eslint/types/dist/generated/ast-spec'

export interface DependencyGroups {
  startLine: number
  deps: Dependency[]
}

export interface Dependency {
  dependencyName: string
  currentVersion: string
  line: number
}

export const getDependencyFromLine = (jsonAsString: string, line: number) => {
  const dependencies = getDependencyInformation(jsonAsString)
    .map((d) => d.deps)
    .flat()

  return dependencies.find((d) => d.line === line)
}

export const getDependencyInformation = (jsonAsString: string): DependencyGroups[] => {
  const jsonAsTypescript = `let tmp=${jsonAsString}`

  const ast = parse(jsonAsTypescript, {
    loc: true,
  })

  const variable = ast.body[0] as VariableDeclaration

  const tmp = variable.declarations[0]

  const init = tmp.init
  if (init == null || init.type !== 'ObjectExpression') {
    throw new Error(`unexpected type: ${init?.type}`)
  }

  const properties = init.properties as TSESTree.Property[]

  const dependencies = properties.find(
    (p) => (p.key as TSESTree.StringLiteral).value === 'dependencies',
  )

  const devDependencies = properties.find(
    (p) => (p.key as TSESTree.StringLiteral).value === 'devDependencies',
  )

  return [dependencies, devDependencies]
    .filter((i): i is TSESTree.Property => i !== undefined)
    .map(toDependencyGroup)
}

function toDependencyGroup(dependencyProperty: TSESTree.Property): DependencyGroups {
  if (dependencyProperty.value.type !== 'ObjectExpression') {
    throw new Error('unexpected type')
  }
  const dependencies = dependencyProperty.value.properties as TSESTree.Property[]

  const d = dependencies.map((dep) => {
    return {
      dependencyName: (dep.key as TSESTree.StringLiteral).value,
      currentVersion: (dep.value as TSESTree.StringLiteral).value,
      // TODO investigate exactly why we have "off by one" error
      line: dep.loc.end.line - 1,
    }
  })

  return {
    startLine: dependencyProperty.loc.start.line,
    deps: d,
  }
}

export const isPackageJson = (document: vscode.TextDocument) => {
  // Is checking both slashes necessary? Test on linux and mac.
  return document.fileName.endsWith('\\package.json') || document.fileName.endsWith('/package.json')
}
