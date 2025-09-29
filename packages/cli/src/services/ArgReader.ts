export class ArgReader {
  public constructor(private readonly argv: string[]) {}

  public flag(name: string): string | boolean | undefined {
    const long = `--${name}`;
    for (let i = 0; i < this.argv.length; i++) {
      const a = this.argv[i];
      if (a === long) {
        const next = this.argv[i + 1];
        if (next && !next.startsWith('--')) return next;
        return true;
      }
      if (a.startsWith(`${long}=`)) return a.slice(long.length + 1);
    }
    return undefined;
  }
}
