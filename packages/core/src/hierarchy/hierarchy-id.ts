export class HierarchyId {
  private readonly nodes: readonly number[];

  private constructor(nodes: readonly number[]) {
    this.nodes = nodes;
  }

  static parse(value: string): HierarchyId {
    const trimmed = value.trim();
    if (trimmed === '/') return new HierarchyId([]);
    const parts = trimmed.replace(/^\//, '').replace(/\/$/, '').split('/');
    const nodes = parts
      .filter((p) => p !== '')
      .map((p) => {
        const n = Number(p);
        if (!Number.isFinite(n)) throw new RangeError(`Invalid HierarchyId segment: "${p}"`);
        return n;
      });
    return new HierarchyId(nodes);
  }

  static getRoot(): HierarchyId {
    return new HierarchyId([]);
  }

  static isHierarchyId(value: unknown): value is HierarchyId {
    return value instanceof HierarchyId;
  }

  getLevel(): number {
    return this.nodes.length;
  }

  getAncestor(n: number): HierarchyId {
    if (n < 0 || n > this.nodes.length) {
      throw new RangeError(`getAncestor(${n}) out of range for level ${this.nodes.length}.`);
    }
    return new HierarchyId(this.nodes.slice(0, this.nodes.length - n));
  }

  isDescendantOf(other: HierarchyId): boolean {
    if (other.nodes.length > this.nodes.length) return false;
    return other.nodes.every((v, i) => v === this.nodes[i]);
  }

  getDescendant(child1?: HierarchyId, child2?: HierarchyId): HierarchyId {
    const base = this.nodes;
    if (child1 === undefined && child2 === undefined) {
      return new HierarchyId([...base, 1]);
    }
    const after = child1 ? (child1.nodes[child1.nodes.length - 1] ?? 0) + 1 : 1;
    const before = child2 ? child2.nodes[child2.nodes.length - 1] : undefined;
    if (before !== undefined && after >= before) {
      throw new RangeError(`getDescendant: no integer exists between child1 and child2.`);
    }
    return new HierarchyId([...base, after]);
  }

  toString(): string {
    if (this.nodes.length === 0) return '/';
    return `/${this.nodes.join('/')}/`;
  }

  toMssqlString(): string {
    return this.toString();
  }

  toLtreeString(): string {
    return this.nodes.join('.');
  }
}
