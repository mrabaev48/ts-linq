import * as ts from 'typescript';

import { makeArray, makeObject, prop, str } from './builders';

export interface PropertyChain {
  root: string;
  segments: string[];
  hasOptional: boolean;
}

export const MAX_CHAIN_DEPTH = 20;

function isOptionalAccess(node: ts.PropertyAccessExpression): boolean {
  return (
    (node as ts.PropertyAccessExpression & { questionDotToken?: unknown }).questionDotToken !==
    undefined
  );
}

/**
 * Unwind a PropertyAccessExpression chain into root identifier + segments.
 * Returns null when the leftmost node is not a plain Identifier or depth exceeds MAX_CHAIN_DEPTH.
 */
export function collectPropertyChain(node: ts.PropertyAccessExpression): PropertyChain | null {
  const segments: string[] = [];
  let current: ts.Expression = node;
  let depth = 0;
  let hasOptional = false;

  while (ts.isPropertyAccessExpression(current)) {
    if (++depth > MAX_CHAIN_DEPTH) return null;
    if (isOptionalAccess(current)) hasOptional = true;
    segments.unshift(current.name.text);
    current = current.expression;
  }

  if (!ts.isIdentifier(current)) return null;
  return { root: current.text, segments, hasOptional };
}

export function buildPropertyNode(
  segments: string[],
  optional = false
): ts.ObjectLiteralExpression {
  const props: ts.PropertyAssignment[] = [prop('type', str('property'))];

  if (segments.length === 1) {
    props.push(prop('name', str(segments[0] ?? '')));
  } else {
    props.push(prop('path', makeArray(segments.map((s) => str(s)))));
  }

  if (optional) {
    props.push(prop('optional', ts.factory.createTrue()));
  }

  return makeObject(props);
}
