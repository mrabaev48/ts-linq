import { runDdlStrategyContract } from '@ts-linq/testkits';

import { PostgresDdlStrategy } from '../src/PostgresDdlStrategy';
import { pgGolden } from './ddl-contract.golden';

runDdlStrategyContract(() => new PostgresDdlStrategy(), pgGolden);
