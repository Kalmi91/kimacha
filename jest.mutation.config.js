// Jest config for `npm run test:mutation` (stryker.config.json) only. It runs the pure-logic tests of lib/sm2.ts and cloud/logic.ts
// without the jest-expo preset: that preset (react-native setup, expo transforms) costs tens of seconds per test file on a loaded
// machine, and a mutation run starts the tests once per mutant. The tests it runs import no React Native code.
// The normal `npm test` / `test:ci` keep using jest.config.js.
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[jt]sx?$': [
      'babel-jest',
      { babelrc: false, configFile: false, presets: ['@babel/preset-typescript'], plugins: ['@babel/plugin-transform-modules-commonjs'] },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '\\.(jpg|jpeg|png|gif|webp|svg|ttf|otf|mp3|wav)$': '<rootDir>/test-utils/assetStub.js',
    '^expo-(constants|sqlite)$': '<rootDir>/test-utils/assetStub.js',
  },
  testTimeout: 20000,
};
