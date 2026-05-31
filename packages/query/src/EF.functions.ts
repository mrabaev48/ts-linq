function markerError(name: string): never {
  throw new Error(
    `EF.functions.${name}() can only be used inside a compiled LINQ expression ` +
      `(e.g. .where(...) or .orderBy(...)). It is a query-only marker and has no runtime value.`
  );
}

export const efFunctions = Object.freeze({
  like(_col: unknown, _pattern: unknown): boolean {
    return markerError('like');
  },
  iLike(_col: unknown, _pattern: unknown): boolean {
    return markerError('iLike');
  },
  random(): number {
    return markerError('random');
  },
  dateDiffDay(_start: unknown, _end: unknown): number {
    return markerError('dateDiffDay');
  },
  dateDiffMonth(_start: unknown, _end: unknown): number {
    return markerError('dateDiffMonth');
  },
  greatest<T>(..._values: T[]): T {
    return markerError('greatest');
  },
  least<T>(..._values: T[]): T {
    return markerError('least');
  },
  stDev(_col: unknown): number {
    return markerError('stDev');
  },
  variance(_col: unknown): number {
    return markerError('variance');
  }
});

export type EfFunctions = typeof efFunctions;
