import { runDdlStrategyContract } from '@ts-linq/testkits';

import { MssqlDdlStrategy } from '../src/MssqlDdlStrategy';
import { mssqlGolden } from './ddl-contract.golden';

runDdlStrategyContract(() => new MssqlDdlStrategy(), mssqlGolden);
