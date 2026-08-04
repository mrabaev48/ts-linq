import type { DatabaseProvider } from '@ts-linq/core';
import type { MetadataRegistry } from '@ts-linq/metadata';
import type { EntityCtorRef } from '@ts-linq/types';
import type { StoredProcedureConfig } from '@ts-linq/types';
import { requireStoredProcedures } from '@ts-linq/types';

export class SpExecutor {
  constructor(
    private readonly provider: DatabaseProvider,
    private readonly registry: MetadataRegistry
  ) {}

  hasSp(entityClass: EntityCtorRef, operation: 'insert' | 'update' | 'delete'): boolean {
    const mapping = this.registry.getStoredProcedureMapping(entityClass);
    if (!mapping) return false;
    return mapping[operation] !== undefined;
  }

  async executeInsert(entity: Record<string, unknown>, entityClass: EntityCtorRef): Promise<void> {
    const config = this.registry.getStoredProcedureMapping(entityClass)?.insert;
    if (!config) return;

    const resultRows = await this._call(config, entity, undefined);
    this._writeBackOutputs(config, resultRows, entity);
  }

  async executeUpdate(
    entity: Record<string, unknown>,
    originalValues: Record<string, unknown> | undefined,
    entityClass: EntityCtorRef
  ): Promise<number> {
    const config = this.registry.getStoredProcedureMapping(entityClass)?.update;
    if (!config) return 0;

    const resultRows = await this._call(config, entity, originalValues);
    return this._emitter(config).extractRowsAffected(config, resultRows);
  }

  async executeDelete(
    entity: Record<string, unknown>,
    originalValues: Record<string, unknown> | undefined,
    entityClass: EntityCtorRef
  ): Promise<number> {
    const config = this.registry.getStoredProcedureMapping(entityClass)?.delete;
    if (!config) return 0;

    const resultRows = await this._call(config, entity, originalValues);
    return this._emitter(config).extractRowsAffected(config, resultRows);
  }

  private _emitter(_config: StoredProcedureConfig) {
    const dialect = this.provider.getDialect();
    requireStoredProcedures(dialect);
    return dialect.getSpCallSyntax();
  }

  private async _call(
    config: StoredProcedureConfig,
    entity: Record<string, unknown>,
    originalValues: Record<string, unknown> | undefined
  ): Promise<Record<string, unknown>[]> {
    const syntax = this._emitter(config);
    const { sql, parameters } = syntax.emitCall(config, entity, originalValues);

    let rows = await this.provider.executeQuery<Record<string, unknown>>(sql, parameters);

    // MySQL: follow-up SELECT @paramName for each OUT param
    if (syntax.getFollowUpSelectParams) {
      const outParams = syntax.getFollowUpSelectParams(config);
      if (outParams.length > 0) {
        const selectSql = outParams.map((p) => `@${p} AS \`${p}\``).join(', ');
        const followUpRows = await this.provider.executeQuery<Record<string, unknown>>(
          `SELECT ${selectSql}`,
          []
        );
        rows = [...rows, ...followUpRows];
      }
    }

    return rows;
  }

  private _writeBackOutputs(
    config: StoredProcedureConfig,
    resultRows: Record<string, unknown>[],
    entity: Record<string, unknown>
  ): void {
    const syntax = this._emitter(config);
    const outputValues = syntax.extractOutputValues(config, resultRows);
    for (const [prop, value] of Object.entries(outputValues)) {
      entity[prop] = value;
    }
  }
}
