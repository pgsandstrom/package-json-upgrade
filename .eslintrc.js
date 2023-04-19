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
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    ecmaFeatures: {
      jsx: true,
    },
    project: ['./tsconfig.json'],
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'no-only-tests'],
  rules: {
    // turn off unwanted rules:
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/restrict-template-expressions': 'off', // this feels too verbose
    '@typescript-eslint/no-inferrable-types': 'off', // this brings very little value

    // activate extra rules:
    eqeqeq: ['error', 'smart'],
    curly: ['error'],
    'no-console': ['error', { allow: ['debug', 'warn', 'error'] }],
    '@typescript-eslint/no-unnecessary-type-assertion': ['error'],
    '@typescript-eslint/no-extra-non-null-assertion': ['error'],
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        vars: 'all',
        varsIgnorePattern: '_.*',
        args: 'none',
      },
    ],
    '@typescript-eslint/no-unnecessary-condition': ['error'],
    '@typescript-eslint/strict-boolean-expressions': [
      'error',
      {
        allowNullableBoolean: true,
      },
    ],
    '@typescript-eslint/prefer-enum-initializers': ['error'],
    'no-only-tests/no-only-tests': 'error',
    'sort-imports': [
      'error',
      {
        ignoreDeclarationSort: true,
      },
    ],
    '@typescript-eslint/no-misused-promises': [
      'error',
      {
        checksVoidReturn: {
          attributes: false,
        },
      },
    ],
  },
}
