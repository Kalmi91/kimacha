// Flat ESLint config for the Kimacha Expo app.
// Base ruleset comes from eslint-config-expo (matches the installed Expo SDK).
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/*', 'android/*', '.expo/*', 'word_batches/*', 'scripts/*'],
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
