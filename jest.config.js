/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  // Basic Jest configuration
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.spec.ts',
    '<rootDir>/**/__tests__/**/*.ts'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    'prisma/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!**/node_modules/**'
  ],
  
  // Coverage thresholds for database components
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Module configuration
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // TypeScript configuration
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  
  // Test environment setup
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.ts'],
  globalSetup: '<rootDir>/tests/setup/global.setup.ts',
  globalTeardown: '<rootDir>/tests/setup/global.teardown.ts',
  
  // Test timeouts for database operations
  testTimeout: 30000, // 30 seconds for complex database tests
  
  // Logging and output
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  
  // Test sequencing
  maxWorkers: 4, // Parallel test execution
  
  // Database-specific settings
  testSequencer: '<rootDir>/tests/utils/DatabaseTestSequencer.js'
};