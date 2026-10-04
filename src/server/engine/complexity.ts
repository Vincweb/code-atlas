import type * as TS from 'typescript'
import type { FunctionMetric } from '../../shared/types'
import type { TsApi } from './typescript'

export const measureFunctions = (
  ts: TsApi,
  sourceFile: TS.SourceFile,
  file: string,
): FunctionMetric[] => {
  const { SyntaxKind } = ts
  const metrics: FunctionMetric[] = []

  const isFunctionLike = (node: TS.Node): node is TS.FunctionLikeDeclaration =>
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)

  const textOf = (name: TS.Node | undefined) => {
    if (!name) return null
    if (
      ts.isIdentifier(name) ||
      ts.isPrivateIdentifier(name) ||
      ts.isStringLiteral(name) ||
      ts.isNumericLiteral(name)
    ) {
      return name.text
    }
    return name.getText(sourceFile)
  }

  const nameOf = (node: TS.FunctionLikeDeclaration) => {
    if (ts.isConstructorDeclaration(node)) return 'constructor'
    const own = textOf(node.name)
    if (own) return own
    const parent = node.parent
    if (
      ts.isVariableDeclaration(parent) ||
      ts.isPropertyAssignment(parent) ||
      ts.isPropertyDeclaration(parent)
    ) {
      return textOf(parent.name) ?? '<anonymous>'
    }
    return '<anonymous>'
  }

  const branches = new Set<TS.SyntaxKind>([
    SyntaxKind.IfStatement,
    SyntaxKind.ConditionalExpression,
    SyntaxKind.CaseClause,
    SyntaxKind.ForStatement,
    SyntaxKind.ForInStatement,
    SyntaxKind.ForOfStatement,
    SyntaxKind.WhileStatement,
    SyntaxKind.DoStatement,
    SyntaxKind.CatchClause,
  ])
  const logical = new Set<TS.SyntaxKind>([
    SyntaxKind.AmpersandAmpersandToken,
    SyntaxKind.BarBarToken,
    SyntaxKind.QuestionQuestionToken,
    SyntaxKind.AmpersandAmpersandEqualsToken,
    SyntaxKind.BarBarEqualsToken,
    SyntaxKind.QuestionQuestionEqualsToken,
  ])
  const adds = (node: TS.Node) =>
    branches.has(node.kind) || (ts.isBinaryExpression(node) && logical.has(node.operatorToken.kind))

  const visit = (node: TS.Node, current: FunctionMetric | null) => {
    if (isFunctionLike(node)) {
      const start = node.getStart(sourceFile)
      const first = sourceFile.getLineAndCharacterOfPosition(start).line
      const last = sourceFile.getLineAndCharacterOfPosition(node.end).line
      const metric: FunctionMetric = {
        file,
        line: first + 1,
        name: nameOf(node),
        complexity: 1,
        params: node.parameters.filter(
          (parameter) => !(ts.isIdentifier(parameter.name) && parameter.name.text === 'this'),
        ).length,
        lines: last - first + 1,
      }
      metrics.push(metric)
      ts.forEachChild(node, (child) => visit(child, metric))
      return
    }
    if (current && adds(node)) current.complexity++
    ts.forEachChild(node, (child) => visit(child, current))
  }
  visit(sourceFile, null)
  return metrics
}
