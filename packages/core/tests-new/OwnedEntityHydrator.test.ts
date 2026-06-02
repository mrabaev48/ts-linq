import { describe, expect, it } from '@jest/globals';
import { StorageStrategy } from '@ts-linq/types';

import { hydrateJson, hydrateOwnedEntities, hydrateTableSplit } from '../src/OwnedEntityHydrator';

class Address {
  street!: string;
  city!: string;
}

class Preferences {
  theme!: string;
  locale!: string;
}

describe('hydrateTableSplit', () => {
  it('reconstructs owned instance from prefixed row columns', () => {
    const row = {
      id: 1,
      shipping_street: '123 Main St',
      shipping_city: 'Springfield'
    };

    const result = hydrateTableSplit(row, Address, 'shipping_');
    expect(result).toBeDefined();
    expect(result!.street).toBe('123 Main St');
    expect(result!.city).toBe('Springfield');
  });

  it('returns undefined when no matching columns exist', () => {
    const row = { id: 1, name: 'test' };
    const result = hydrateTableSplit(row, Address, 'shipping_');
    expect(result).toBeUndefined();
  });

  it('returns undefined when all matching columns are null', () => {
    const row = { id: 1, shipping_street: null, shipping_city: null };
    const result = hydrateTableSplit(row, Address, 'shipping_');
    expect(result).toBeUndefined();
  });

  it('uses propertyToColumnMap when provided', () => {
    const row = { id: 1, addr_st: '123 Main St', addr_city: 'Springfield' };
    const map = new Map([
      ['street', 'st'],
      ['city', 'city']
    ]);

    const result = hydrateTableSplit(row, Address, 'addr_', map);
    expect(result).toBeDefined();
    expect(result!.street).toBe('123 Main St');
    expect(result!.city).toBe('Springfield');
  });
});

describe('hydrateJson', () => {
  it('reconstructs owned instance from JSON string column', () => {
    const row = {
      id: 1,
      prefs: JSON.stringify({ theme: 'dark', locale: 'en' })
    };

    const result = hydrateJson(row, Preferences, 'prefs');
    expect(result).toBeDefined();
    expect(result!.theme).toBe('dark');
    expect(result!.locale).toBe('en');
  });

  it('reconstructs owned instance from JSON object column (already parsed)', () => {
    const row = {
      id: 1,
      prefs: { theme: 'light', locale: 'de' }
    };

    const result = hydrateJson(row, Preferences, 'prefs');
    expect(result).toBeDefined();
    expect(result!.theme).toBe('light');
  });

  it('returns undefined when column is null', () => {
    const row = { id: 1, prefs: null };
    const result = hydrateJson(row, Preferences, 'prefs');
    expect(result).toBeUndefined();
  });

  it('returns undefined when JSON is invalid', () => {
    const row = { id: 1, prefs: 'not valid json {{{' };
    const result = hydrateJson(row, Preferences, 'prefs');
    expect(result).toBeUndefined();
  });
});

describe('hydrateOwnedEntities', () => {
  it('hydrates TableSplit owned entity onto owner instance', () => {
    const row: Record<string, unknown> = {
      id: 1,
      shipping_street: '123 Main St',
      shipping_city: 'Springfield'
    };
    const owner: Record<string, unknown> = { id: 1 };

    hydrateOwnedEntities(row, owner, [
      {
        ownerPropertyName: 'shippingAddress',
        ownedType: Address,
        strategy: StorageStrategy.TableSplit,
        columnPrefix: 'shipping_',
        isCollection: false
      }
    ]);

    expect(owner.shippingAddress).toBeDefined();
    expect((owner.shippingAddress as Address).street).toBe('123 Main St');
  });

  it('hydrates Json owned entity onto owner instance', () => {
    const row: Record<string, unknown> = {
      id: 1,
      preferences: JSON.stringify({ theme: 'dark', locale: 'fr' })
    };
    const owner: Record<string, unknown> = { id: 1 };

    hydrateOwnedEntities(row, owner, [
      {
        ownerPropertyName: 'preferences',
        ownedType: Preferences,
        strategy: StorageStrategy.Json,
        jsonColumnName: 'preferences',
        isCollection: false
      }
    ]);

    expect(owner.preferences).toBeDefined();
    expect((owner.preferences as Preferences).theme).toBe('dark');
  });

  it('skips collection (SeparateTable) owned entities', () => {
    const row: Record<string, unknown> = { id: 1 };
    const owner: Record<string, unknown> = { id: 1 };

    hydrateOwnedEntities(row, owner, [
      {
        ownerPropertyName: 'lineItems',
        ownedType: class LineItem {},
        strategy: StorageStrategy.SeparateTable,
        isCollection: true
      }
    ]);

    expect(owner.lineItems).toBeUndefined();
  });
});
