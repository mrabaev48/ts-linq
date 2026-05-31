import { describe, expect, it } from '@jest/globals';
import { createMetadataRegistry } from '@ts-linq/metadata';

import { DbFunctionBuilder } from '../src/builders/DbFunctionBuilder';
import { ModelBuilder } from '../src/ModelBuilder';

describe('DbFunctionBuilder', () => {
  it('stores and returns the SQL name', () => {
    function jsonExtract() {}
    const builder = new DbFunctionBuilder(jsonExtract);
    builder.hasName('jsonb_extract_path_text');
    expect(builder.getSqlName()).toBe('jsonb_extract_path_text');
    expect(builder.getFn()).toBe(jsonExtract);
  });

  it('returns undefined SQL name before hasName is called', () => {
    function myFn() {}
    const builder = new DbFunctionBuilder(myFn);
    expect(builder.getSqlName()).toBeUndefined();
  });

  it('hasName returns this for chaining', () => {
    function myFn() {}
    const builder = new DbFunctionBuilder(myFn);
    expect(builder.hasName('my_fn')).toBe(builder);
  });
});

describe('ModelBuilder.hasDbFunction', () => {
  function makeModelBuilder() {
    return new ModelBuilder(createMetadataRegistry());
  }

  it('registers a function and returns DbFunctionBuilder', () => {
    function jsonExtract() {}
    const mb = makeModelBuilder();
    const builder = mb.hasDbFunction(jsonExtract).hasName('jsonb_extract_path_text');
    expect(builder.getSqlName()).toBe('jsonb_extract_path_text');
  });

  it('returns the same builder for the same function', () => {
    function myFn() {}
    const mb = makeModelBuilder();
    const b1 = mb.hasDbFunction(myFn);
    const b2 = mb.hasDbFunction(myFn);
    expect(b1).toBe(b2);
  });

  it('getDbFunctionMap returns correct mapping', () => {
    function jsonExtract() {}
    const mb = makeModelBuilder();
    mb.hasDbFunction(jsonExtract).hasName('jsonb_extract_path_text');
    const map = mb.getDbFunctionMap();
    expect(map.get('jsonExtract')).toBe('jsonb_extract_path_text');
  });

  it('getDbFunctionMap excludes functions without SQL name', () => {
    function unnamed() {}
    const mb = makeModelBuilder();
    mb.hasDbFunction(unnamed); // no hasName() call
    const map = mb.getDbFunctionMap();
    expect(map.size).toBe(0);
  });
});
