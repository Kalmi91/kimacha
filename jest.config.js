const PER_FILE = { statements: 95, branches: 90, functions: 95, lines: 95 };

// jest-expo wires the RN/Expo transform, module mappers and jsdom-free RN env.
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // cloud/ is the Worker (its own package, run by wrangler); only its pure logic is tested, from lib/cloud/__tests__.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/cloud/'],
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
    // Per file for the modules whose bugs corrupt a learner's data, so an untested new branch there
    // cannot hide in the global average. Measured 2026-10-19 (statements/branches/functions/lines):
    // sm2 97/92/100/97, usageStats 100/93/100/100, dailyXp 100/96/100/100, learningDay 100/100/100/100,
    // db/migrations 100/100/100/100. These files are not part of the global figures above.
    './lib/sm2.ts': PER_FILE,
    './lib/dailyXp.ts': PER_FILE,
    './lib/usageStats.ts': PER_FILE,
    './lib/learningDay.ts': PER_FILE,
    './lib/db/migrations.ts': PER_FILE,
  },
};
