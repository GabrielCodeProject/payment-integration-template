/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  displayName: 'unit-tests',
  testEnvironment: 'node',
  preset: 'ts-jest',
  testMatch: [
    '<rootDir>/tests/security/EdgeCaseValidation.test.ts'
  ],
  setupFilesAfterEnv: [],
  globalSetup: undefined,
  globalTeardown: undefined,
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  testTimeout: 10000,
  verbose: true,
  collectCoverage: false,
  maxWorkers: 1
};