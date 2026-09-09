// Flat ESLint config for the Kimacha Expo app.
// Base ruleset comes from eslint-config-expo (matches the installed Expo SDK).
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/*', 'android/*', '.expo/*', 'word_batches/*', 'scripts/*'],
  },
  {
    // React Compiler hook rules, arrived with the SDK 56 / React 19 upgrade and
    // flag 47 pre-existing errors. Kept as warnings so the rest of the lint gate
    // stays an error gate while the debt is burnt down one rule at a time.
    // Tracking: https://github.com/Kalmi91/kimacha/issues/1
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
  {
    // Test files: jest.mock() calls are hoisted above imports by design, and a
    // module mock is a require() by definition, so the import-order and
    // no-require rules would flag every playthrough test for doing the only
    // thing that works.
    files: ['**/__tests__/**/*.{ts,tsx}', 'testing/**/*.{ts,tsx}'],
    rules: {
      'import/first': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
