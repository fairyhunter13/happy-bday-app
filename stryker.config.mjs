/**
 * Stryker Mutation Testing Configuration
 *
 * OPTIMIZATION STRATEGY (Target: <10 minutes runtime):
 * 1. Focus mutations on critical business logic only (services, strategies, schedulers, repositories, queue workers)
 * 2. Exclude non-critical code: configs, types, schemas, middleware, routes, controllers
 * 3. Increased concurrency from 4 to 8 for parallel execution
 * 4. Reduced timeout from 60s to 30s (fast tests = good tests)
 * 5. Excluded low-value mutators: StringLiteral, ObjectLiteral, ArrayDeclaration, RegexMutator
 * 6. Incremental mode enabled for subsequent runs
 * 7. Coverage analysis set to 'perTest' for optimal performance
 *
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
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
  // Focus on critical business logic only for faster mutation testing
  mutate: [
    // Core business logic - services
    'src/services/message.service.ts',
    'src/services/message-sender.service.ts',
    'src/services/message-reschedule.service.ts',
    'src/services/scheduler.service.ts',
    'src/services/timezone.service.ts',
    'src/services/idempotency.service.ts',
    'src/services/cache.service.ts',

    // Message strategies (core domain logic)
    'src/strategies/**/*.ts',
    '!src/strategies/index.ts',

    // Schedulers (critical scheduling logic)
    'src/schedulers/**/*.ts',

    // Repositories (data access logic)
    'src/repositories/**/*.ts',

    // Queue workers (async processing logic)
    'src/queue/**/*.ts',

    // Workers (background processing)
    'src/workers/**/*.ts',

    // Exclude everything else for speed
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/index.ts',
    '!src/worker.ts',
    '!src/app.ts', // Application setup, not critical for mutations
    '!src/clients/**/*.ts', // Generated and wrapper code
    '!src/config/**/*.ts', // Configuration files
    '!src/controllers/**/*.ts', // Thin HTTP layer, covered by integration tests
    '!src/db/**/*.ts', // Database setup and migrations
    '!src/entities/**/*.ts', // Type definitions
    '!src/middleware/**/*.ts', // HTTP middleware, covered by integration tests
    '!src/routes/**/*.ts', // Route definitions, not business logic
    '!src/schemas/**/*.ts', // Validation schemas (declarative)
    '!src/types/**/*.ts', // Type definitions only
    '!src/utils/**/*.ts', // Utilities, covered separately
    '!src/validators/**/*.ts', // Validation logic (declarative)
  ],

  // Test file patterns
  testRunner_comment: 'Tests are configured via vitest config',

  // Mutators - TypeScript appropriate mutations
  mutator: {
    name: 'javascript',
    plugins: null,
    excludedMutations: [
      // Exclude mutations that often produce equivalent mutants or low-value noise
      'StringLiteral', // String mutations often don't affect logic
      'ObjectLiteral', // Object mutations rarely catch meaningful bugs
      'ArrayDeclaration', // Array mutations often create noise
      'RegexMutator', // Regex mutations are often equivalent mutants
    ],
  },

  // Ignore static class members during mutation
  // Static members are initialized when modules load, and mutating them
  // can cause runtime errors when the mutated module is imported
  ignoreStatic: true,

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
  // Since we're focusing on critical business logic only, we expect higher scores
  // - high (85%+): Excellent mutation coverage - critical code is well-tested
  // - low (70%+): Acceptable mutation coverage - room for improvement
  // - break (60%): Minimum acceptable - CI will fail below this
  thresholds: {
    high: 85,
    low: 70,
    break: 60,
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

  // Concurrency settings - increased for faster execution
  // Uses more CPU cores to run mutations in parallel
  concurrency: 8,

  // Timeout settings - reduced for faster feedback
  // Most tests should complete quickly; slow tests indicate issues
  timeoutMS: 30000,
  timeoutFactor: 1.5,

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
