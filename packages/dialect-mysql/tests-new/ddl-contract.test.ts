import { runDdlStrategyContract } from '@ts-linq/testkits';

import { MySqlDdlStrategy } from '../src/MySqlDdlStrategy';
import { mysqlGolden } from './ddl-contract.golden';

runDdlStrategyContract(() => new MySqlDdlStrategy(), mysqlGolden);
