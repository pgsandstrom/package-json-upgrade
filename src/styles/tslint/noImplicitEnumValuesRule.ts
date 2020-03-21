import Lint from 'tslint'
import {
  collectVariableUsage,
  getPropertyName,
  hasModifier,
  isAssignmentKind,
  isBinaryExpression,
  isElementAccessExpression,
  isIdentifier,
  isPropertyAccessExpression,
  isStringLiteral,
  VariableUse,
} from 'tsutils'
import ts from 'typescript'

export class Rule extends Lint.Rules.AbstractRule {
  public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
    return this.applyWithFunction(sourceFile, walk)
  }
}

interface Enum {
  name: string
  isConst: boolean
  declarations: ts.EnumDeclaration[]
  members: Map<string, EnumMember>
  uses: VariableUse[]
}

interface EnumMember {
  isConst: boolean
  stringValued: boolean
}

interface Declaration {
  track: Enum
  declaration: ts.EnumDeclaration
}

// This is a modified version of the rule prefer-const-enum

// This will give an error:
// const enum MyEnum = {value, anotherValue}

// This is okay:
// const enum MyEnum = {value: "value", anotherValue: "anotherValue"}

// This is due to two reasons:
// 1. In the first case, MyEnum.value will evaluate to falsy. Historically this has caused
// hard to detect bugs when we write "if (myEnum)" to check if it is defined
// 2. It is easier to debug when vieweing "value" rather than 0.

function walk(ctx: Lint.WalkContext<void>) {
  const seen = new Set<ts.Identifier>()
  const enums: Enum[] = []
  const declarations: Declaration[] = []
  const variables = collectVariableUsage(ctx.sourceFile)

  variables.forEach((variable, identifier) => {
    if (identifier.parent.kind !== ts.SyntaxKind.EnumDeclaration || seen.has(identifier)) {
      return
    }
    const track: Enum = {
      name: identifier.text,
      isConst: hasModifier(identifier.parent.modifiers, ts.SyntaxKind.ConstKeyword),
      declarations: [],
      members: new Map(),
      uses: variable.uses,
    }
    for (const declaration of variable.declarations) {
      seen.add(declaration)
      track.declarations.push(declaration.parent as ts.EnumDeclaration)
      declarations.push({
        track,
        declaration: declaration.parent as ts.EnumDeclaration,
      })
    }
    enums.push(track)
  })

  declarations.sort((a, b) => a.declaration.pos - b.declaration.pos)

  for (const { track, declaration } of declarations) {
    for (const member of declaration.members) {
      const isConst =
        track.isConst ||
        member.initializer === undefined ||
        isConstInitializer(member.initializer, track.members, findEnum)
      track.members.set(getPropertyName(member.name)!, {
        isConst,
        stringValued:
          isConst &&
          member.initializer !== undefined &&
          isStringValued(member.initializer, track.members, findEnum),
      })
    }
  }
  for (const track of enums) {
    if (Array.from(track.members.values()).every(value => value.stringValued === true)) {
      continue
    }
    for (const declaration of track.declarations) {
      ctx.addFailure(
        declaration.name.pos - 4,
        declaration.name.end,
        `Enum '${track.name}' should be explicitly given values.`,
        Lint.Replacement.appendText(declaration.name.pos - 4, 'const '),
      )
    }
  }

  function findEnum(name: ts.Identifier): Enum | undefined {
    for (const track of enums) {
      if (track.name !== name.text) {
        continue
      }
      for (const use of track.uses) {
        if (use.location === name) {
          return track
        }
      }
    }
    return undefined
  }
}

type FindEnum = (name: ts.Identifier) => Enum | undefined

function isConstInitializer(
  initializer: ts.Expression,
  members: Map<string, EnumMember>,
  findEnum: FindEnum,
): boolean {
  return (function isConst(node, allowStrings): boolean {
    switch (node.kind) {
      case ts.SyntaxKind.Identifier: {
        const member = members.get(node.text)
        return member !== undefined && member.isConst && (allowStrings || !member.stringValued)
      }
      case ts.SyntaxKind.StringLiteral:
        return allowStrings
      case ts.SyntaxKind.NumericLiteral:
        return true
      case ts.SyntaxKind.PrefixUnaryExpression:
        return isConst(node.operand, false)
      case ts.SyntaxKind.ParenthesizedExpression:
        return isConst(node.expression, allowStrings)
    }
    if (isPropertyAccessExpression(node)) {
      if (!isIdentifier(node.expression)) {
        return false
      }
      const track = findEnum(node.expression)
      if (track === undefined) {
        return false
      }
      const member = track.members.get(node.name.text)
      return member !== undefined && member.isConst && (allowStrings || !member.stringValued)
    }
    if (isElementAccessExpression(node)) {
      if (
        !isIdentifier(node.expression) ||
        // wotan-disable-next-line no-useless-predicate
        node.argumentExpression === undefined || // compatibility with typescript@<2.9.0
        !isStringLiteral(node.argumentExpression)
      ) {
        return false
      }
      const track = findEnum(node.expression)
      if (track === undefined) {
        return false
      }
      const member = track.members.get(node.argumentExpression.text)
      return member !== undefined && member.isConst && (allowStrings || !member.stringValued)
    }
    if (isBinaryExpression(node)) {
      return (
        node.operatorToken.kind !== ts.SyntaxKind.AsteriskAsteriskToken &&
        node.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken &&
        node.operatorToken.kind !== ts.SyntaxKind.BarBarToken &&
        !isAssignmentKind(node.operatorToken.kind) &&
        isConst(node.left, false) &&
        isConst(node.right, false)
      )
    }
    return false
  })(initializer, true)
}

function isStringValued(
  initializer: ts.Expression,
  members: Map<string, EnumMember>,
  findEnum: FindEnum,
): boolean {
  return (function stringValued(node): boolean {
    switch (node.kind) {
      case ts.SyntaxKind.ParenthesizedExpression:
        return stringValued(node.expression)
      case ts.SyntaxKind.Identifier:
        return members.get(node.text)!.stringValued
      case ts.SyntaxKind.PropertyAccessExpression:
        return findEnum(node.expression)!.members.get(node.name.text)!.stringValued
      case ts.SyntaxKind.ElementAccessExpression:
        return findEnum(node.expression)!.members.get(node.argumentExpression.text)!.stringValued
      default:
        // StringLiteral
        return true
    }
  })(initializer)
}
