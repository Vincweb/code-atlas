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

  const adds = (node: TS.Node) => {
    switch (node.kind) {
      case SyntaxKind.IfStatement:
      case SyntaxKind.ConditionalExpression:
      case SyntaxKind.CaseClause:
      case SyntaxKind.ForStatement:
      case SyntaxKind.ForInStatement:
      case SyntaxKind.ForOfStatement:
      case SyntaxKind.WhileStatement:
      case SyntaxKind.DoStatement:
      case SyntaxKind.CatchClause:
        return true
      case SyntaxKind.BinaryExpression: {
        const operator = (node as TS.BinaryExpression).operatorToken.kind
        return (
          operator === SyntaxKind.AmpersandAmpersandToken ||
          operator === SyntaxKind.BarBarToken ||
          operator === SyntaxKind.QuestionQuestionToken ||
          operator === SyntaxKind.AmpersandAmpersandEqualsToken ||
          operator === SyntaxKind.BarBarEqualsToken ||
          operator === SyntaxKind.QuestionQuestionEqualsToken
        )
      }
      default:
        return false
    }
  }

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
