import * as ts from 'typescript';

import type { AstImportName } from './types';

const AST_MODULE_SPECIFIER = '@ts-linq/ast';

function isAstImportDeclaration(statement: ts.Statement): statement is ts.ImportDeclaration {
  if (!ts.isImportDeclaration(statement)) return false;
  if (!ts.isStringLiteral(statement.moduleSpecifier)) return false;
  return statement.moduleSpecifier.text === AST_MODULE_SPECIFIER;
}

function getNamedImports(importClause: ts.ImportClause | undefined): ts.NamedImports | null {
  const bindings = importClause?.namedBindings;
  if (!bindings) return null;
  return ts.isNamedImports(bindings) ? bindings : null;
}

export function ensureAstImports(
  sourceFile: ts.SourceFile,
  factory: ts.NodeFactory,
  required: ReadonlySet<AstImportName>
): ts.SourceFile {
  if (required.size === 0) return sourceFile;

  const requiredSorted = [...required].sort((a, b) => a.localeCompare(b));
  const existingAstImport = sourceFile.statements.find(isAstImportDeclaration);

  const createImportDecl = (specifiers: readonly ts.ImportSpecifier[]) =>
    factory.createImportDeclaration(
      undefined,
      factory.createImportClause(
        false,
        undefined,
        factory.createNamedImports(specifiers)
      ),
      factory.createStringLiteral(AST_MODULE_SPECIFIER),
      undefined
    );

  if (existingAstImport) {
    const existingNamed = getNamedImports(existingAstImport.importClause);
    if (!existingNamed) {
      // Existing import is namespace/default-only; add a separate named import.
      const insertPos = sourceFile.statements.indexOf(existingAstImport) + 1;
      const newImport = createImportDecl(
        requiredSorted.map((n) => factory.createImportSpecifier(false, undefined, factory.createIdentifier(n)))
      );
      const nextStatements = [
        ...sourceFile.statements.slice(0, insertPos),
        newImport,
        ...sourceFile.statements.slice(insertPos)
      ];
      return factory.updateSourceFile(sourceFile, nextStatements);
    }

    const existingNames = new Set(
      existingNamed.elements.map((e) => (e.propertyName ?? e.name).text)
    );
    const mergedNames = new Set<string>(existingNames);
    for (const r of requiredSorted) mergedNames.add(r);

    const mergedSpecifiers = [...mergedNames]
      .sort((a, b) => a.localeCompare(b))
      .map((n) => factory.createImportSpecifier(false, undefined, factory.createIdentifier(n)));

    const updatedImportClause = factory.updateImportClause(
      existingAstImport.importClause ?? factory.createImportClause(false, undefined, undefined),
      false,
      existingAstImport.importClause?.name,
      factory.createNamedImports(mergedSpecifiers)
    );
    const updatedImportDecl = factory.updateImportDeclaration(
      existingAstImport,
      existingAstImport.modifiers,
      updatedImportClause,
      existingAstImport.moduleSpecifier,
      existingAstImport.assertClause
    );
    const nextStatements = sourceFile.statements.map((s) => (s === existingAstImport ? updatedImportDecl : s));
    return factory.updateSourceFile(sourceFile, nextStatements);
  }

  // Insert after the last import declaration to preserve typical ordering.
  const lastImportIdx = (() => {
    for (let i = sourceFile.statements.length - 1; i >= 0; i -= 1) {
      if (ts.isImportDeclaration(sourceFile.statements[i]!)) return i;
    }
    return -1;
  })();

  const newImport = createImportDecl(
    requiredSorted.map((n) => factory.createImportSpecifier(false, undefined, factory.createIdentifier(n)))
  );
  const insertAt = lastImportIdx >= 0 ? lastImportIdx + 1 : 0;
  const nextStatements = [
    ...sourceFile.statements.slice(0, insertAt),
    newImport,
    ...sourceFile.statements.slice(insertAt)
  ];
  return factory.updateSourceFile(sourceFile, nextStatements);
}

