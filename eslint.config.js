// Flat ESLint config for the Kimacha Expo app.
// Base ruleset comes from eslint-config-expo (matches the installed Expo SDK).
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/*', 'android/*', '.expo/*', 'word_batches/*', 'scripts/*'],
  },
];
