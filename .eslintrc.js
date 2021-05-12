module.exports = {
  env: {
    browser: false,
    es6: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    // 'prettier' disables linting rules that conflict with prettier (this is dependency eslint-config-prettier)
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2017,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
      generators: false,
      experimentalObjectRestSpread: true,
    },
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    // turn off unwanted rules:
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
    '@typescript-eslint/camelcase': 'off', // There are a few exceptions, like variables from the backend and stuff
    '@typescript-eslint/explicit-module-boundary-types': 'off', // This feels unnecessary and verbose
    '@typescript-eslint/no-floating-promises': 'off', // just feels a bit verbose with the vscode API

    // activate extra rules:
    eqeqeq: ['error', 'smart'],
    curly: ['error'],
    '@typescript-eslint/no-unnecessary-type-assertion': ['error'],
    '@typescript-eslint/no-extra-non-null-assertion': ['error'],
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        vars: 'all',
        args: 'none',
      },
    ],
    '@typescript-eslint/no-unnecessary-condition': ['error'],
    '@typescript-eslint/strict-boolean-expressions': ['error'],

    // here is frontend/backend exclusive rules

    'require-atomic-updates': 'off', // Currently a bit too buggy. See https://github.com/eslint/eslint/issues/11899
  },
}
