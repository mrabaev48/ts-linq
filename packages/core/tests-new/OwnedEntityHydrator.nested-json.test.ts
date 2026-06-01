import type { JsonShape, JsonShapeNode } from '@ts-linq/types';

import { hydrateJson } from '../src/OwnedEntityHydrator';

class Display {
  theme = '';
  fontSize = 0;
}

class Preferences {
  display: Display | undefined;
  tags: string[] = [];
  darkMode = false;
}

function makeShape(columnName: string): JsonShape {
  const displayChildren = new Map<string, JsonShapeNode>([
    ['theme', {}],
    ['fontSize', {}]
  ]);
  const properties = new Map<string, JsonShapeNode>([
    ['display', { children: displayChildren, isArray: false }],
    ['tags', { isArray: true }],
    ['darkMode', {}]
  ]);
  return { columnName, properties };
}

describe('hydrateJson — nested aggregates', () => {
  const shape = makeShape('preferences');

  it('hydrates a flat JSON column without shape', () => {
    const row = { preferences: '{"darkMode":true}' };
    const result = hydrateJson(row, Preferences, 'preferences');
    expect(result).toBeDefined();
    expect((result as any).darkMode).toBe(true);
  });

  it('hydrates flat properties with shape', () => {
    const row = { preferences: '{"darkMode":true,"tags":["a","b"]}' };
    const result = hydrateJson(row, Preferences, 'preferences', shape);
    expect(result).toBeDefined();
    expect((result as any).darkMode).toBe(true);
    expect((result as any).tags).toEqual(['a', 'b']);
  });

  it('hydrates nested object with shape', () => {
    const row = { preferences: '{"display":{"theme":"dark","fontSize":14},"darkMode":false}' };
    const result = hydrateJson(row, Preferences, 'preferences', shape);
    const display = (result as any).display as Record<string, unknown>;
    expect(typeof display).toBe('object');
    expect(display['theme']).toBe('dark');
    expect(display['fontSize']).toBe(14);
  });

  it('returns undefined for null column value', () => {
    const row = { preferences: null };
    expect(hydrateJson(row, Preferences, 'preferences', shape)).toBeUndefined();
  });

  it('returns undefined for invalid JSON', () => {
    const row = { preferences: 'not-json' };
    expect(hydrateJson(row, Preferences, 'preferences', shape)).toBeUndefined();
  });

  it('accepts already-parsed object', () => {
    const row = { preferences: { darkMode: false, display: { theme: 'light', fontSize: 12 } } };
    const result = hydrateJson(row, Preferences, 'preferences', shape);
    expect((result as any).darkMode).toBe(false);
    expect((result as any).display.theme).toBe('light');
  });
});
