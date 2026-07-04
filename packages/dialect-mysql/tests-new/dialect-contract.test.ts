import { runSqlDialectContract } from '@ts-linq/testkits';

import { MysqlDialect } from '../src/MysqlDialect';
import { mysqlGolden } from './dialect-contract.golden';

runSqlDialectContract(() => new MysqlDialect(), mysqlGolden);
