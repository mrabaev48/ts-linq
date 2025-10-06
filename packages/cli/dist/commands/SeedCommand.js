'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            }
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, '__esModule', { value: true });
exports.SeedCommand = void 0;
const path = __importStar(require('path'));
const ConsoleLogger_1 = require('../adapters/ConsoleLogger');
const NodeFs_1 = require('../adapters/NodeFs');
class SeedCommand {
  constructor(logger = new ConsoleLogger_1.ConsoleLogger(), fsAdapter = new NodeFs_1.NodeFs()) {
    this.logger = logger;
    this.fsAdapter = fsAdapter;
    this.name = 'seed';
    this.describe = 'Выполняет SQL из файла для начального наполнения';
    this.aliases = ['db:seed'];
  }
  async runDb(provider, argv) {
    const sqlFile = argv[1] || path.resolve(process.cwd(), 'seeds.sql');
    if (!this.fsAdapter.exists(sqlFile)) {
      this.logger.error(`Seed file not found: ${sqlFile}`);
      process.exitCode = 2;
      return;
    }
    const text = this.fsAdapter.readText(sqlFile);
    const statements = text
      .split(';')
      .map((stmt) => stmt.trim())
      .filter(Boolean);
    for (const statement of statements) {
      // eslint-disable-next-line no-await-in-loop
      await provider.executeNonQuery(statement);
    }
    this.logger.info(`Applied ${statements.length} seed statements from ${sqlFile}`);
  }
}
exports.SeedCommand = SeedCommand;
//# sourceMappingURL=SeedCommand.js.map
