/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  // Package metadata
  packageManager: 'npm',

  // Test runner configuration
  testRunner: 'vitest',
  vitest: {
    configFile: 'vitest.config.unit.ts',
    dir: '.',
  },

  // TypeScript support
  buildCommand: 'npm run build',

  // Source files to mutate
  mutate: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/index.ts',
    '!src/worker.ts',
    '!src/scheduler.ts',
    '!src/clients/generated/**/*.ts',
    '!src/db/migrate.ts',
    '!src/db/seed.ts',
    // Excluded due to import attributes syntax (with { type: 'json' })
    // Stryker's Babel instrumenter doesn't support this syntax yet
    '!src/services/health-check.service.ts',
  ],

  // Test file patterns
  testRunner_comment: 'Tests are configured via vitest config',

  // Mutators - TypeScript appropriate mutations
  mutator: {
    name: 'javascript',
    plugins: null,
    excludedMutations: [
      // Exclude mutations that often produce equivalent mutants
      'StringLiteral', // String mutations often don't affect logic
    ],
  },

  // All TypeScript-appropriate mutators are enabled by default:
  // - ArithmeticOperator: +, -, *, /, %
  // - ArrayDeclaration: [] -> ["Stryker was here"]
  // - ArrowFunction: () => x -> () => undefined
  // - AssignmentOperator: +=, -=, *=, /=, %=
  // - BlockStatement: removes block contents
  // - BooleanLiteral: true <-> false
  // - ConditionalExpression: ternary mutations
  // - EqualityOperator: ==, ===, !=, !==, <, >, <=, >=
  // - LogicalOperator: &&, ||
  // - MethodExpression: array methods mutations
  // - ObjectLiteral: {} mutations
  // - OptionalChaining: ?. mutations
  // - RegexMutator: regex mutations
  // - StringLiteral: string mutations (excluded above)
  // - UnaryOperator: +, -, ~, !, ++, --
  // - UpdateOperator: ++, --

  // Thresholds for mutation score
  // - high (80%+): Excellent mutation coverage - most mutations are caught
  // - low (60%+): Acceptable mutation coverage - room for improvement
  // - break (50%): Minimum acceptable - CI will warn below this
  thresholds: {
    high: 80,
    low: 60,
    break: 50,
  },

  // Reporters
  reporters: [
    'html',
    'json',
    'clear-text',
    'progress',
  ],

  // Output directories
  htmlReporter: {
    fileName: 'reports/mutation/mutation-report.html',
  },
  jsonReporter: {
    fileName: 'reports/mutation/mutation-report.json',
  },

  // Incremental mode for faster subsequent runs
  incremental: true,
  incrementalFile: '.stryker-tmp/incremental.json',

  // Concurrency settings
  concurrency: 4,

  // Timeout settings
  timeoutMS: 60000,
  timeoutFactor: 2,

  // Coverage analysis for performance
  coverageAnalysis: 'perTest',

  // Disable type checking for faster mutation testing
  // Type errors are caught by TypeScript compilation, not mutation testing
  disableTypeChecks: 'src/**/*.ts',

  // Disable telemetry for privacy
  disableTelemetry: true,

  // Ignore patterns
  ignorePatterns: [
    'node_modules',
    'dist',
    'coverage',
    '.stryker-tmp',
    'reports',
    'src/clients/generated',
    'drizzle', // SQL migration files - Stryker EISDIR fix
  ],

  // Clear text reporter options
  clearTextReporter: {
    allowColor: true,
    allowEmojis: false,
    logTests: false,
    maxTestsToLog: 3,
  },

  // Log level
  logLevel: 'info',

  // Dashboard reporter (optional - for Stryker Dashboard)
  // dashboard: {
  //   project: 'github.com/fairyhunter13/happy-bday-app',
  //   version: 'main',
  //   module: undefined,
  //   baseUrl: 'https://dashboard.stryker-mutator.io/api/reports',
  //   reportType: 'full',
  // },

  // Temp directory for Stryker files
  tempDirName: '.stryker-tmp',

  // Clean temp directory on exit
  cleanTempDir: true,
};

export default config;
