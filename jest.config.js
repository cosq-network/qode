export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/?(*.)+(test).[tj]s?(x)'],
  moduleNameMapper: { '^(.+)\\.js$': '$1' },
  globals: {
    'ts-jest': { useESM: true },
  },
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { useESM: true }],
  },
};
