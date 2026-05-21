import type * as ts from 'typescript';

const BRAND = '__tsLinqWhereTransformerBrand';

export function receiverIsQueryable(checker: ts.TypeChecker, receiver: ts.Expression): boolean {
  try {
    const type = checker.getTypeAtLocation(receiver);
    const props = checker.getPropertiesOfType(type);
    return props.some((p) => p.getName() === BRAND);
  } catch {
    return false;
  }
}
