import { EfWarningError, WarningConfigurationBuilder } from '../src/warning-router';

describe('WarningConfigurationBuilder', () => {
  it('registers throw behavior for an event', () => {
    const routes = new WarningConfigurationBuilder().throw('core.query-error').build();
    expect(routes.get('core.query-error')).toBe('throw');
  });

  it('registers log behavior for an event', () => {
    const routes = new WarningConfigurationBuilder()
      .log('core.first-without-order-by-and-filter')
      .build();
    expect(routes.get('core.first-without-order-by-and-filter')).toBe('log');
  });

  it('registers suppress behavior for an event', () => {
    const routes = new WarningConfigurationBuilder().suppress('core.client-evaluation').build();
    expect(routes.get('core.client-evaluation')).toBe('suppress');
  });

  it('supports multiple events with different behaviors', () => {
    const routes = new WarningConfigurationBuilder()
      .throw('relational.multiple-collection-include')
      .log('core.first-without-order-by-and-filter')
      .suppress('core.sensitive-data-logging-enabled')
      .build();
    expect(routes.get('relational.multiple-collection-include')).toBe('throw');
    expect(routes.get('core.first-without-order-by-and-filter')).toBe('log');
    expect(routes.get('core.sensitive-data-logging-enabled')).toBe('suppress');
  });

  it('returns undefined for unregistered event ids', () => {
    const routes = new WarningConfigurationBuilder().build();
    expect(routes.get('unknown.event')).toBeUndefined();
  });

  it('last registration wins for duplicate event ids', () => {
    const routes = new WarningConfigurationBuilder()
      .log('core.query-error')
      .throw('core.query-error')
      .build();
    expect(routes.get('core.query-error')).toBe('throw');
  });

  it('supports fluent chaining', () => {
    const builder = new WarningConfigurationBuilder();
    const result = builder.throw('e1').log('e2').suppress('e3');
    expect(result).toBe(builder);
  });
});

describe('EfWarningError', () => {
  it('sets the eventId property', () => {
    const err = new EfWarningError('relational.multiple-collection-include', 'Multiple includes');
    expect(err.eventId).toBe('relational.multiple-collection-include');
  });

  it('sets the name to EfWarningError', () => {
    const err = new EfWarningError('some.event', 'msg');
    expect(err.name).toBe('EfWarningError');
  });

  it('includes the event id and message in the error message', () => {
    const err = new EfWarningError('core.client-evaluation', 'Client evaluation detected');
    expect(err.message).toContain('core.client-evaluation');
    expect(err.message).toContain('Client evaluation detected');
  });

  it('is an instance of Error', () => {
    expect(new EfWarningError('e', 'm')).toBeInstanceOf(Error);
  });
});
