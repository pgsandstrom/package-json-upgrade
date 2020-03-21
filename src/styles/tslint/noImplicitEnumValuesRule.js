"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
exports.__esModule = true;
var Lint = require("tslint");
var tsutils_1 = require("tsutils");
var ts = require("typescript");
var Rule = /** @class */ (function (_super) {
    __extends(Rule, _super);
    function Rule() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Rule.prototype.apply = function (sourceFile) {
        return this.applyWithFunction(sourceFile, walk);
    };
    return Rule;
}(Lint.Rules.AbstractRule));
exports.Rule = Rule;
// This is a modified version of the rule prefer-const-enum
// This will give an error:
// const enum MyEnum = {value, anotherValue}
// This is okay:
// const enum MyEnum = {value: "value", anotherValue: "anotherValue"}
// This is due to two reasons:
// 1. In the first case, MyEnum.value will evaluate to falsy. Historically this has caused
// hard to detect bugs when we write "if (myEnum)" to check if it is defined
// 2. It is easier to debug when vieweing "value" rather than 0.
function walk(ctx) {
    var seen = new Set();
    var enums = [];
    var declarations = [];
    var variables = tsutils_1.collectVariableUsage(ctx.sourceFile);
    variables.forEach(function (variable, identifier) {
        if (identifier.parent.kind !== ts.SyntaxKind.EnumDeclaration || seen.has(identifier)) {
            return;
        }
        var track = {
            name: identifier.text,
            isConst: tsutils_1.hasModifier(identifier.parent.modifiers, ts.SyntaxKind.ConstKeyword),
            declarations: [],
            members: new Map(),
            uses: variable.uses
        };
        for (var _i = 0, _a = variable.declarations; _i < _a.length; _i++) {
            var declaration = _a[_i];
            seen.add(declaration);
            track.declarations.push(declaration.parent);
            declarations.push({
                track: track,
                declaration: declaration.parent
            });
        }
        enums.push(track);
    });
    declarations.sort(function (a, b) { return a.declaration.pos - b.declaration.pos; });
    for (var _i = 0, declarations_1 = declarations; _i < declarations_1.length; _i++) {
        var _a = declarations_1[_i], track = _a.track, declaration = _a.declaration;
        for (var _b = 0, _c = declaration.members; _b < _c.length; _b++) {
            var member = _c[_b];
            var isConst = track.isConst ||
                member.initializer === undefined ||
                isConstInitializer(member.initializer, track.members, findEnum);
            track.members.set(tsutils_1.getPropertyName(member.name), {
                isConst: isConst,
                stringValued: isConst &&
                    member.initializer !== undefined &&
                    isStringValued(member.initializer, track.members, findEnum)
            });
        }
    }
    for (var _d = 0, enums_1 = enums; _d < enums_1.length; _d++) {
        var track = enums_1[_d];
        if (Array.from(track.members.values()).every(function (value) { return value.stringValued === true; })) {
            continue;
        }
        for (var _e = 0, _f = track.declarations; _e < _f.length; _e++) {
            var declaration = _f[_e];
            ctx.addFailure(declaration.name.pos - 4, declaration.name.end, "Enum '" + track.name + "' should be explicitly given values.", Lint.Replacement.appendText(declaration.name.pos - 4, "const "));
        }
    }
    function findEnum(name) {
        for (var _i = 0, enums_2 = enums; _i < enums_2.length; _i++) {
            var track = enums_2[_i];
            if (track.name !== name.text) {
                continue;
            }
            for (var _a = 0, _b = track.uses; _a < _b.length; _a++) {
                var use = _b[_a];
                if (use.location === name) {
                    return track;
                }
            }
        }
        return undefined;
    }
}
function isConstInitializer(initializer, members, findEnum) {
    return (function isConst(node, allowStrings) {
        switch (node.kind) {
            case ts.SyntaxKind.Identifier: {
                var member = members.get(node.text);
                return member !== undefined && member.isConst && (allowStrings || !member.stringValued);
            }
            case ts.SyntaxKind.StringLiteral:
                return allowStrings;
            case ts.SyntaxKind.NumericLiteral:
                return true;
            case ts.SyntaxKind.PrefixUnaryExpression:
                return isConst(node.operand, false);
            case ts.SyntaxKind.ParenthesizedExpression:
                return isConst(node.expression, allowStrings);
        }
        if (tsutils_1.isPropertyAccessExpression(node)) {
            if (!tsutils_1.isIdentifier(node.expression)) {
                return false;
            }
            var track = findEnum(node.expression);
            if (track === undefined) {
                return false;
            }
            var member = track.members.get(node.name.text);
            return member !== undefined && member.isConst && (allowStrings || !member.stringValued);
        }
        if (tsutils_1.isElementAccessExpression(node)) {
            if (!tsutils_1.isIdentifier(node.expression) ||
                // wotan-disable-next-line no-useless-predicate
                node.argumentExpression === undefined || // compatibility with typescript@<2.9.0
                !tsutils_1.isStringLiteral(node.argumentExpression)) {
                return false;
            }
            var track = findEnum(node.expression);
            if (track === undefined) {
                return false;
            }
            var member = track.members.get(node.argumentExpression.text);
            return member !== undefined && member.isConst && (allowStrings || !member.stringValued);
        }
        if (tsutils_1.isBinaryExpression(node)) {
            return (node.operatorToken.kind !== ts.SyntaxKind.AsteriskAsteriskToken &&
                node.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken &&
                node.operatorToken.kind !== ts.SyntaxKind.BarBarToken &&
                !tsutils_1.isAssignmentKind(node.operatorToken.kind) &&
                isConst(node.left, false) &&
                isConst(node.right, false));
        }
        return false;
    })(initializer, true);
}
function isStringValued(initializer, members, findEnum) {
    return (function stringValued(node) {
        switch (node.kind) {
            case ts.SyntaxKind.ParenthesizedExpression:
                return stringValued(node.expression);
            case ts.SyntaxKind.Identifier:
                return members.get(node.text).stringValued;
            case ts.SyntaxKind.PropertyAccessExpression:
                return findEnum(node
                    .expression).members.get(node.name.text).stringValued;
            case ts.SyntaxKind.ElementAccessExpression:
                return findEnum(node
                    .expression).members.get(node.argumentExpression.text).stringValued;
            default:
                // StringLiteral
                return true;
        }
    })(initializer);
}
