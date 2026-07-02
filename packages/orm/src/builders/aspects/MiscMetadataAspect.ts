import type { MetadataRegistry } from '@ts-linq/metadata';

import type { EntityConfigAspect } from './EntityConfigAspect';

/**
 * Assorted table-level metadata with no shared accumulator: temporal (system-versioned)
 * config, seed data, table comment, keyless flag, and view name / view SQL.
 *
 * Grouped together to avoid fragmenting single-field concerns into their own aspects; each
 * axis is written independently and none depends on another's output.
 */
export class MiscMetadataAspect<T extends object> implements EntityConfigAspect<T> {
  private _isTemporal?: boolean;
  private _historyTableName?: string;
  private readonly _seedRows: Record<string, unknown>[] = [];
  private _entityComment?: string;
  private _isKeyless?: boolean;
  private _viewName?: string;
  private _viewSql?: string;

  isTemporal(): void {
    this._isTemporal = true;
  }

  withHistoryTable(name: string): void {
    this._historyTableName = name;
  }

  hasData(rows: Record<string, unknown>[]): void {
    this._seedRows.push(...rows);
  }

  hasComment(comment: string): void {
    this._entityComment = comment;
  }

  hasNoKey(): void {
    this._isKeyless = true;
  }

  toView(name: string): void {
    this._viewName = name;
  }

  hasViewSql(sql: string): void {
    this._viewSql = sql;
  }

  applyTo(registry: MetadataRegistry, ctor: new () => T): void {
    if (this._isTemporal !== undefined) {
      registry.mergeFluentTemporal(ctor, this._isTemporal, this._historyTableName);
    }

    if (this._seedRows.length > 0) {
      registry.setSeedData(ctor, [...this._seedRows]);
    }

    if (this._entityComment !== undefined) {
      registry.setEntityComment(ctor, this._entityComment);
    }

    if (this._isKeyless !== undefined) {
      registry.setFluentKeyless(ctor, this._isKeyless);
    }

    if (this._viewName !== undefined) {
      registry.setFluentViewName(ctor, this._viewName);
    }

    if (this._viewSql !== undefined) {
      registry.setFluentViewSql(ctor, this._viewSql);
    }
  }
}
