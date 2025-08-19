/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  // Multiple Jest configurations for different environments
  projects: [
    // React component tests
    {
      displayName: 'react-components',
      testEnvironment: 'jsdom',
      preset: 'ts-jest',
      testMatch: [
        '<rootDir>/src/components/**/*.test.{ts,tsx}',
        '<rootDir>/src/hooks/**/*.test.{ts,tsx}'
      ],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.react.setup.ts'],
      globalSetup: '<rootDir>/tests/setup/jest.react-only.setup.ts',
      globalTeardown: undefined,
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
          tsconfig: {
            jsx: 'react-jsx'
          }
        }]
      },
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@tests/(.*)$': '<rootDir>/tests/$1',
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
      },
      collectCoverageFrom: [
        'src/components/**/*.{ts,tsx}',
        'src/lib/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/*.test.{ts,tsx}',
        '!src/**/*.spec.{ts,tsx}',
        '!**/node_modules/**'
      ],
      coverageThreshold: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        }
      }
    },
    // Backend tests (only when database is available)
    {
      displayName: 'backend',
      testEnvironment: 'node',
      preset: 'ts-jest',
      testMatch: [
        '<rootDir>/tests/**/*.test.ts',
        '<rootDir>/tests/**/*.spec.ts'
      ],
      testPathIgnorePatterns: [
        '<rootDir>/node_modules/'
      ],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.ts'],
      globalSetup: '<rootDir>/tests/setup/global.setup.ts',
      globalTeardown: '<rootDir>/tests/setup/global.teardown.ts',
      collectCoverageFrom: [
        'src/**/*.ts',
        'prisma/**/*.ts',
        '!src/components/**',
        '!src/**/*.d.ts',
        '!src/**/*.test.ts',
        '!src/**/*.spec.ts',
        '!**/node_modules/**'
      ],
      coverageThreshold: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
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