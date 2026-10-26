// Flat ESLint config for the Kimacha Expo app.
// Base ruleset comes from eslint-config-expo (matches the installed Expo SDK).
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/*', 'android/*', '.expo/*', 'scripts/*', 'cloud/*'],
  },
  {
    // An empty catch block hides the failure: a swallowed error needs a line that says why that is fine.
    rules: { 'no-empty': ['error', { allowEmptyCatch: false }] },
  },
  {
    // Colors come from the theme tokens (constants/Colors.ts: `colors.successFill`, `colors.card` ...), not from a hex
    // literal in a screen or component. The literals that were already there are counted in eslint-suppressions.json:
    // that count can only go down (`npx eslint . --prune-suppressions` after removing one).
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
    ignores: ['**/__tests__/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]', message: 'Take the color from the theme tokens (constants/Colors.ts), not a hex literal.' },
      ],
    },
  },
  {
    // File size ceiling: past 600 lines a file gets split (hook / view / styles) instead of growing.
    files: ['**/*.{ts,tsx}'],
    ignores: ['**/__tests__/**'],
    rules: { 'max-lines': ['error', 600] },
  },
  {
    // The files that were already over the ceiling when it was added are capped at their size then:
    // they can only shrink. Lower a cap when its file gets smaller, never raise one.
    files: ['components/grammar/GrammarDrill.tsx'],
    rules: { 'max-lines': ['error', 627] },
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
