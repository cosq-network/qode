const tsJest = require.resolve('ts-jest');

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/?(*.)+(test).[tj]s?(x)'],
  setupFilesAfterEnv: ['<rootDir>/src/test/jest.setup.ts'],
  moduleNameMapper: {
    '^clipboardy$': '<rootDir>/__mocks__/clipboardy.js',
    '^.*/esm-dir\\.js$': '<rootDir>/src/test/mocks/esm-dir.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@clack/prompts$': '<rootDir>/src/test/mocks/clack-prompts.ts',
  },
  transform: {
    '^.+\\.tsx?$': [
      tsJest,
      {
        tsconfig: {
          module: 'commonjs',
          moduleResolution: 'node',
        },
      },
    ],
  },
  // Ensure ESM packages like chalk are transformed; clack is stubbed in tests.
  transformIgnorePatterns: ['/node_modules/(?!chalk|inquirer)'],
};
