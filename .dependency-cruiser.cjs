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
          'setup-containers\\.ts$',
          '(^|/)setup\\.ts$'
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
        'Avoid importing another package internal files directly. Import from its public entrypoint.',
      from: {
        path: '^packages/[^/]+/src'
      },
      to: {
        path: '^packages/[^/]+/src/(?!index\\.ts$)'
      }
    },

    {
      name: 'no-any-in-internal-api-files',
      severity: 'info',
      comment: 'This is a weak signal only. Use TypeScript/ESLint for strict any enforcement.',
      from: {
        path: '^packages/.*/src'
      },
      to: {}
    }
  ],

  options: {
    doNotFollow: {
      path: 'node_modules|dist|build|coverage|\\.turbo|\\.next|\\.cache|reports|issues-v3'
    },

    exclude: {
      path: 'node_modules|dist|build|coverage|\\.turbo|\\.next|\\.cache|reports|issues-v3'
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
