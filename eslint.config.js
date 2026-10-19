// Flat ESLint config for the Kimacha Expo app.
// Base ruleset comes from eslint-config-expo (matches the installed Expo SDK).
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/*', 'android/*', '.expo/*', 'scripts/*'],
  },
  {
    // An empty catch block hides the failure: a swallowed error needs a line that says why that is fine.
    rules: { 'no-empty': ['error', { allowEmptyCatch: false }] },
  },
  {
    // Test files: jest.mock() calls are hoisted above imports by design, and a
    // module mock is a require() by definition, so the import-order and
    // no-require rules would flag every playthrough test for doing the only
    // thing that works. The expo-router mock calls useEffect(cb, []) on a
    // callback it is handed, which the hooks rule cannot analyse.
    files: ['**/__tests__/**/*.{ts,tsx}'],
    rules: {
      'import/first': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
  {
    // jest.setup.js runs inside Jest, which injects `jest`; the Expo base config knows no Jest globals,
    // so `eslint .` (what `rtk lint` runs for `npm run lint`) flagged it with no-undef.
    files: ['jest.setup.js'],
    languageOptions: { globals: { jest: 'readonly' } },
  },
];
