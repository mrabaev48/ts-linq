import { StorageStrategy } from '@ts-linq/types';

import { OwnedNavigationBuilder } from '../src/builders/OwnedNavigationBuilder';

class Display {
  theme = '';
}

class RecentSearch {
  query = '';
}

class Preferences {
  display: Display | undefined;
  recentSearches: RecentSearch[] = [];
  darkMode = false;
}

class User {
  id = 0;
  preferences: Preferences | undefined;
}

describe('OwnedNavigationBuilder — toJson with JsonShape', () => {
  it('sets Json strategy and jsonColumnName', () => {
    const b = new OwnedNavigationBuilder(User, Preferences, 'preferences', false);
    b.toJson('prefs_json');
    const meta = b._buildMetadata();
    expect(meta.strategy).toBe(StorageStrategy.Json);
    expect(meta.jsonColumnName).toBe('prefs_json');
  });

  it('defaults jsonColumnName to property name', () => {
    const b = new OwnedNavigationBuilder(User, Preferences, 'preferences', false);
    b.toJson();
    const meta = b._buildMetadata();
    expect(meta.jsonColumnName).toBe('preferences');
  });

  it('builds a JsonShape with the correct column name', () => {
    const b = new OwnedNavigationBuilder(User, Preferences, 'preferences', false);
    b.toJson('pref_col');
    const meta = b._buildMetadata();
    expect(meta.jsonShape).toBeDefined();
    expect(meta.jsonShape!.columnName).toBe('pref_col');
  });

  it('includes nested ownsOne in JsonShape', () => {
    const b = new OwnedNavigationBuilder(User, Preferences, 'preferences', false);
    b.toJson();
    b.ownsOne((p) => p.display, Display);
    const meta = b._buildMetadata();
    const displayNode = meta.jsonShape!.properties.get('display');
    expect(displayNode).toBeDefined();
    expect(displayNode!.isArray).toBeFalsy();
  });

  it('includes nested ownsMany as array node in JsonShape', () => {
    const b = new OwnedNavigationBuilder(User, Preferences, 'preferences', false);
    b.toJson();
    b.ownsMany((p) => p.recentSearches, RecentSearch);
    const meta = b._buildMetadata();
    const searchesNode = meta.jsonShape!.properties.get('recentSearches');
    expect(searchesNode).toBeDefined();
    expect(searchesNode!.isArray).toBe(true);
  });

  it('stores nestedOwned metadata when nested navigations are registered', () => {
    const b = new OwnedNavigationBuilder(User, Preferences, 'preferences', false);
    b.toJson();
    b.ownsOne((p) => p.display, Display);
    b.ownsMany((p) => p.recentSearches, RecentSearch);
    const meta = b._buildMetadata();
    expect(meta.nestedOwned).toBeDefined();
    expect(meta.nestedOwned!.length).toBe(2);
  });
});
