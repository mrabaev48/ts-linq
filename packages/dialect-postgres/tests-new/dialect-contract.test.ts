import { runSqlDialectContract } from '@ts-linq/testkits';

import { PostgresDialect } from '../src/PostgresDialect';
import { pgGolden } from './dialect-contract.golden';

runSqlDialectContract(() => new PostgresDialect(), pgGolden);
