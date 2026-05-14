export function ctorName(ctor: abstract new (...args: any[]) => any): string {
  return (ctor as { name?: string }).name ?? 'Unknown';
}
