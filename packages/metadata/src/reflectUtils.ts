type ReflectWithGetOwnMetadata = {
  getOwnMetadata?: (key: string, target: Function) => unknown;
};

export function reflectGetOwnMetadata(key: string, target: Function): unknown {
  try {
    const gm = (Reflect as unknown as ReflectWithGetOwnMetadata).getOwnMetadata;
    return gm?.(key, target);
  } catch {
    return undefined;
  }
}
