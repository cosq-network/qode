export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleNameMapper: { '^(.+)\\.js$': '$1' },
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': { useESM: true },
  },
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { useESM: true }],
  },
};
