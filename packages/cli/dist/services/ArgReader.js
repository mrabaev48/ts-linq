'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ArgReader = void 0;
class ArgReader {
  constructor(argv) {
    this.argv = argv;
  }
  flag(name) {
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
exports.ArgReader = ArgReader;
//# sourceMappingURL=ArgReader.js.map
