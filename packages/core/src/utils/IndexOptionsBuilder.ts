import type { IndexMetadata } from '../types';

export class IndexOptionsBuilder {
  private current: IndexMetadata;

  constructor(name: string) {
    this.current = { name, columns: [], unique: false };
  }

  public onColumns(columns: string[]): this {
    this.current.columns = [...columns];
    return this;
  }

  public unique(isUnique = true): this {
    this.current.unique = isUnique;
    return this;
  }

  public where(predicate: string): this {
    this.current.where = predicate;
    return this;
  }

  public orderBy(orders: { [column: string]: 'ASC' | 'DESC' }): this {
    this.current.orders = { ...(this.current.orders || {}), ...orders };
    return this;
  }

  public expressions(exprs: string[]): this {
    this.current.expressions = [...(this.current.expressions || []), ...exprs];
    return this;
  }

  public collations(coll: { [column: string]: string }): this {
    this.current.collations = { ...(this.current.collations || {}), ...coll };
    return this;
  }

  public nulls(opts: { [column: string]: 'FIRST' | 'LAST' }): this {
    this.current.nulls = { ...(this.current.nulls || {}), ...opts };
    return this;
  }

  public using(method: 'btree' | 'hash' | 'gin' | 'gist'): this {
    this.current.using = method;
    return this;
  }

  public concurrently(flag = true): this {
    this.current.concurrently = flag;
    return this;
  }

  public withParams(params: Record<string, string | number | boolean>): this {
    this.current.withParams = { ...(this.current.withParams || {}), ...params };
    return this;
  }

  public mysqlVisibility(mode: 'VISIBLE' | 'INVISIBLE'): this {
    this.current.mysqlVisibility = mode;
    return this;
  }

  public include(columns: string[]): this {
    this.current.include = [...(this.current.include || []), ...columns];
    return this;
  }

  public build(): IndexMetadata {
    if (!this.current.name || this.current.name.trim().length === 0) {
      throw new Error('Index name must be provided');
    }
    if (!this.current.columns || this.current.columns.length === 0) {
      throw new Error('Index must reference at least one column');
    }
    return { ...this.current };
  }
}


