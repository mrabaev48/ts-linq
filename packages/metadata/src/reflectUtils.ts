type ReflectWithGetOwnMetadata = {
  getOwnMetadata?: (key: string, target: Function) => unknown;
};

/**
 * The single reflect-metadata capability probe for this package.
 *
 * Reads `Reflect.getOwnMetadata(key, target)` defensively: `reflect-metadata`
 * is an optional peer (it may not be imported in a given runtime/test setup),
 * so its absence is a supported state — never an error condition.
 *
 * Returns `undefined` to mean **"no reflect-metadata available / no entry for
 * this key"**. The internal `catch` is the one documented place that swallows
 * the probe failure; callers must treat `undefined` as the Null Object and must
 * not introduce ad-hoc `try/catch` around reflect access elsewhere.
 */
export function reflectGetOwnMetadata(key: string, target: Function): unknown {
  try {
    const gm = (Reflect as unknown as ReflectWithGetOwnMetadata).getOwnMetadata;
    return gm?.(key, target);
  } catch {
    return undefined;
  }
}
