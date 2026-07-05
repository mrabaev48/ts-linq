import { runSqlDialectContract } from '@ts-linq/testkits';

import { MssqlDialect } from '../src/MssqlDialect';
import { mssqlGolden } from './dialect-contract.golden';

runSqlDialectContract(() => new MssqlDialect(), mssqlGolden);
