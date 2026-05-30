import type * as ts from 'typescript';

const BUILDER_BRAND = '__tsLinqEntityTypeBuilderBrand';

export function receiverIsEntityTypeBuilder(
  checker: ts.TypeChecker,
  receiver: ts.Expression
): boolean {
  try {
    const type = checker.getTypeAtLocation(receiver);
    const props = checker.getPropertiesOfType(type);
    return props.some((p) => p.getName() === BUILDER_BRAND);
  } catch {
    return false;
  }
}
