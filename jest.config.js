// jest-expo wires the RN/Expo transform, module mappers and jsdom-free RN env.
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // The grammar lessons and the word list are parsed on first use (lib/games/content.ts, data/openWords.ts),
  // so a screen test's first render pays that load; the 5 s default is too tight when workers share the CPU.
  testTimeout: 20000,
  // Transpile the RN/Expo ESM packages that ship untranspiled.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules))',
  ],
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  // A little below the measured coverage (88.6 statements, 84.4 branches,
  // 84.4 functions, 89.5 lines), so `test:ci` fails when coverage regresses.
  coverageThreshold: {
    global: { statements: 86, branches: 82, functions: 82, lines: 87 },
  },
};
