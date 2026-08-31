/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies make architecture harder to reason about.',
      from: {},
      to: {
        circular: true
      }
    },

    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'Orphan modules may indicate dead code or missing public exports.',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)index\\.ts$',
          '(^|/)main\\.ts$',
          '(^|/)cli\\.ts$',
          '(^|/)bin/',
          '\\.test\\.ts$',
          '\\.spec\\.ts$',
          '\\.d\\.ts$',
          '(^|/)tests(-old)?/',
          'jest\\.config\\.',
          'jest\\.sequencer\\.',
          'jest-transformer\\.js$',
          'setup-containers\\.ts$',
          '(^|/)setup\\.ts$',
          '(^|/)fixture',
          '(^|/)e2e-tests/',
          '(^|/)examples/src/'
        ]
      },
      to: {}
    },

    {
      name: 'no-deprecated-core-to-runtime',
      severity: 'error',
      comment: 'Core/query packages must not depend on runtime/session/execution layers.',
      from: {
        path: '^packages/(core|query-core|query|ast|types|schema)(/|$)'
      },
      to: {
        path: '^packages/(runtime|session|executor|execution|client)(/|$)'
      }
    },

    {
      name: 'no-core-to-dialects',
      severity: 'error',
      comment: 'Core/query/AST layers must not depend on SQL dialect implementations.',
      from: {
        path: '^packages/(core|query-core|query|ast|types|schema)(/|$)'
      },
      to: {
        path: '^packages/(sql-|dialect-|postgres|pg|mysql|sqlite|mssql|oracle)'
      }
    },

    {
      name: 'no-dialect-to-runtime',
      severity: 'warn',
      comment: 'Dialect packages should render SQL and avoid depending on runtime execution.',
      from: {
        path: '^packages/(sql-|dialect-|postgres|pg|mysql|sqlite|mssql|oracle)'
      },
      to: {
        path: '^packages/(runtime|session|executor|execution|client)(/|$)'
      }
    },

    {
      name: 'no-dialect-to-core',
      severity: 'error',
      comment:
        'Dialects are pure SQL emitters and sit below core/metadata: they must receive metadata ' +
        'and an execution port from above (see @ts-linq/types SqlQueryExecutor), never import the ' +
        'core/provider runtime or the global metadata registry.',
      from: {
        path: '^packages/dialect-'
      },
      to: {
        path: '^packages/(core|metadata)(/|$)'
      }
    },

    {
      name: 'no-tests-in-production',
      severity: 'error',
      comment: 'Production code must not import test code.',
      from: {
        path: '^packages/.*/src',
        pathNot: ['\\.test\\.ts$', '\\.spec\\.ts$', '__tests__']
      },
      to: {
        path: '(\\.test\\.ts$|\\.spec\\.ts$|__tests__|test-utils)'
      }
    },

    {
      name: 'no-src-cross-package-relative-imports',
      severity: 'error',
      comment:
        'Packages should not import other packages through relative filesystem paths. Use workspace package names.',
      from: {
        path: '^packages/([^/]+)/src'
      },
      to: {
        path: '^packages/([^/]+)/src',
        pathNot: '^packages/$1/src'
      }
    },

    {
      name: 'no-private-package-internals',
      severity: 'warn',
      comment:
        "Avoid importing another package's internal files directly. Import from its public entrypoint.",
      from: {
        path: '^packages/([^/]+)/src'
      },
      to: {
        path: '^packages/[^/]+/src/(?!index\\.ts$)',
        pathNot: '^packages/$1/'
      }
    },
    {
      name: 'no-query-internal-from-non-collaborators',
      severity: 'error',
      comment:
        'Only packages/integration-tests may import @ts-linq/query/internal. All others (including orm, which now consumes the public @ts-linq/query boundary seam — orm/task-6.1) must use the public @ts-linq/query entrypoint.',
      from: {
        path: '^packages/([^/]+)/src',
        pathNot: '^packages/integration-tests/'
      },
      to: {
        path: '^packages/query/src/internal'
      }
    }
  ],

  options: {
    doNotFollow: {
      path: 'node_modules|dist|build|coverage|\\.turbo|\\.next|\\.cache|reports|issues-v3|issues-v4'
    },

    exclude: {
      path: 'node_modules|dist|build|coverage|\\.turbo|\\.next|\\.cache|reports|issues-v3|issues-v4'
    },

    tsConfig: {
      fileName: 'tsconfig.json'
    },

    tsPreCompilationDeps: true,
    combinedDependencies: false,
    preserveSymlinks: false,

    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/[^/]+'
      },
      archi: {
        collapsePattern: 'packages/([^/]+).*'
      }
    }
  }
};
