// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ctorName(ctor: abstract new (...args: any[]) => any): string {
  return (ctor as { name?: string }).name ?? 'Unknown';
}
