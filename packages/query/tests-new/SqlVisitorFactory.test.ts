import type { ExpressionNode, JsonPathExpression } from '@ts-linq/ast';
import { MetadataStorage } from '@ts-linq/metadata';
import type {
  DialectVisitorSupport,
  DialectVisitorTranslators,
  JsonPathTranslator
} from '@ts-linq/sql-visitor';
import type { SqlDialect, SqlParameter } from '@ts-linq/types';

import { SqlVisitorFactory } from '../src/SqlVisitorFactory';

/** Plain dialect with NO visitor-support capability (mirrors testkits' TestDialect). */
class PlainDialect implements SqlDialect {
  public buildSelect(): { query: string; parameters: SqlParameter[] } {
    return { query: '', parameters: [] };
  }
  public quoteIdentifier(id: string): string {
    return `"${id}"`;
  }
}

/** Stub JSON-path translator that renders a deterministic fragment. */
const stubJsonTranslator: JsonPathTranslator = {
  translate: (node) => ({ fragment: `JSON_VALUE(${node.column})`, params: [] })
};

/** Dialect that DOES advertise the visitor-support capability. */
class CapableDialect extends PlainDialect implements DialectVisitorSupport {
  public getVisitorTranslators(): DialectVisitorTranslators {
    return { jsonPathTranslator: stubJsonTranslator };
  }
}

class ConvUser {
  id!: number;
  active!: boolean;
}

/** boolean → integer converter (1/0), mirroring a HasConversion column. */
const boolToInt = {
  toProvider: (v: unknown) => (v ? 1 : 0),
  fromProvider: (v: unknown) => v === 1
};

function registerConvUser(): void {
  MetadataStorage.getInstance().clear();
  MetadataStorage.addEntity(ConvUser, 'conv_users');
  MetadataStorage.addColumn(ConvUser, {
    propertyName: 'id',
    columnName: 'id',
    type: 'INTEGER',
    primaryKey: true
  });
  MetadataStorage.addColumn(ConvUser, {
    propertyName: 'active',
    columnName: 'active',
    type: 'INTEGER',
    converter: boolToInt
  });
}

const factory = new SqlVisitorFactory();

const jsonNode: JsonPathExpression = { type: 'jsonPath', column: 'profile', path: ['city'] };

describe('SqlVisitorFactory', () => {
  describe('dialect translator wiring', () => {
    it('renders a JSON-path node when the dialect advertises a jsonPathTranslator', () => {
      const visitor = factory.create({ metadata: undefined, dialect: new CapableDialect() });
      const { condition } = visitor.toSql(jsonNode, []);
      expect(condition).toContain('JSON_VALUE(profile)');
    });

    it('degrades gracefully for a plain dialect (no capability) — throws the not-configured error', () => {
      const visitor = factory.create({ metadata: undefined, dialect: new PlainDialect() });
      expect(() => visitor.toSql(jsonNode, [])).toThrow('jsonPathTranslator');
    });
  });

  describe('converter lifting', () => {
    beforeEach(registerConvUser);

    it('lifts a literal compared against a converted property to its provider representation', () => {
      const metadata = MetadataStorage.getEntity(ConvUser);
      const converterResolver = (prop: string) =>
        metadata?.columns.find((c) => c.propertyName === prop)?.converter;

      const visitor = factory.create({
        metadata,
        dialect: new PlainDialect(),
        converterResolver
      });

      // active === true  →  the boolean literal must be converted to 1 (the provider value).
      const ast: ExpressionNode = {
        type: 'binary',
        operator: '===',
        left: { type: 'property', name: 'active' },
        right: { type: 'literal', value: true }
      };
      const { parameters } = visitor.toSql(ast, []);
      expect(parameters).toEqual([1]);
    });

    it('emits the RAW literal when no converterResolver is supplied (proves the resolver is the cause)', () => {
      const visitor = factory.create({ metadata: undefined, dialect: new PlainDialect() });
      const ast: ExpressionNode = {
        type: 'binary',
        operator: '===',
        left: { type: 'property', name: 'active' },
        right: { type: 'literal', value: true }
      };
      const { parameters } = visitor.toSql(ast, []);
      expect(parameters).toEqual([true]);
    });
  });
});
