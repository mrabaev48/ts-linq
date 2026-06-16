/**
 * Isolated unit tests for ValueGenerationService (refactor orm/task-1).
 * Default/sentinel value generation and Hi-Lo id prefill with mocked deps.
 */
import { describe, expect, it, jest } from '@jest/globals';
import type { DatabaseProvider } from '@ts-linq/core';
import type { MetadataRegistry } from '@ts-linq/metadata';

import { ValueGenerationService } from '../../src/context/ValueGenerationService';

class Widget {}

function svcWith(meta: unknown) {
  const nextSequenceValue = jest.fn(async () => 100);
  const registry = { getEntity: jest.fn(() => meta) } as unknown as MetadataRegistry;
  const provider = { nextSequenceValue } as unknown as DatabaseProvider;
  return { registry, provider, nextSequenceValue };
}

describe('ValueGenerationService.prefillDefaults', () => {
  it('fills legacy defaultValue for added entities only', () => {
    const meta = { columns: [{ propertyName: 'status', defaultValue: 'new' }] };
    const m = svcWith(meta);
    const svc = new ValueGenerationService(m.registry, m.provider);

    const added: Record<string, unknown> = {};
    svc.prefillDefaults([{ entity: added, entityClass: Widget, state: 'added' }]);
    expect(added['status']).toBe('new');

    const modified: Record<string, unknown> = {};
    svc.prefillDefaults([{ entity: modified, entityClass: Widget, state: 'modified' }]);
    expect(modified['status']).toBeUndefined();
  });

  it('does not overwrite an already-set value', () => {
    const meta = { columns: [{ propertyName: 'status', defaultValue: 'new' }] };
    const m = svcWith(meta);
    const svc = new ValueGenerationService(m.registry, m.provider);

    const e: Record<string, unknown> = { status: 'kept' };
    svc.prefillDefaults([{ entity: e, entityClass: Widget, state: 'added' }]);
    expect(e['status']).toBe('kept');
  });

  it("respects valueGeneratedPolicy 'Never'", () => {
    const meta = {
      columns: [{ propertyName: 'x', valueGeneratedPolicy: 'Never', defaultValue: 'v' }]
    };
    const m = svcWith(meta);
    const svc = new ValueGenerationService(m.registry, m.provider);

    const e: Record<string, unknown> = {};
    svc.prefillDefaults([{ entity: e, entityClass: Widget, state: 'added' }]);
    expect(e['x']).toBeUndefined();
  });

  it('runs a client-side generator when the value equals the sentinel', () => {
    class Gen {
      next() {
        return 'generated';
      }
    }
    const meta = {
      columns: [
        {
          propertyName: 'code',
          valueGeneratedPolicy: 'OnAdd',
          valueGeneratorClass: Gen,
          sentinel: 0
        }
      ]
    };
    const m = svcWith(meta);
    const svc = new ValueGenerationService(m.registry, m.provider);

    const e: Record<string, unknown> = { code: 0 };
    svc.prefillDefaults([{ entity: e, entityClass: Widget, state: 'added' }]);
    expect(e['code']).toBe('generated');
  });
});

describe('ValueGenerationService.prefillHiLoIds', () => {
  it('reserves a block and assigns a numeric id to added entities', async () => {
    const meta = {
      columns: [{ propertyName: 'id', hiLoBlockSize: 10, sequenceName: 'seq' }]
    };
    const m = svcWith(meta);
    const svc = new ValueGenerationService(m.registry, m.provider);

    const e: Record<string, unknown> = {};
    await svc.prefillHiLoIds([{ entity: e, entityClass: Widget, state: 'added' }]);

    expect(m.nextSequenceValue).toHaveBeenCalled();
    expect(typeof e['id']).toBe('number');
  });

  it('ignores non-added changes', async () => {
    const meta = {
      columns: [{ propertyName: 'id', hiLoBlockSize: 10, sequenceName: 'seq' }]
    };
    const m = svcWith(meta);
    const svc = new ValueGenerationService(m.registry, m.provider);

    const e: Record<string, unknown> = {};
    await svc.prefillHiLoIds([{ entity: e, entityClass: Widget, state: 'modified' }]);
    expect(m.nextSequenceValue).not.toHaveBeenCalled();
    expect(e['id']).toBeUndefined();
  });
});
