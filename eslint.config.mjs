// TODO add "@ts-check" when we have properly migrated to esm modules

import eslint from '@eslint/js'
import noOnlyTests from 'eslint-plugin-no-only-tests'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['.next', 'next-env.d.ts'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'no-only-tests': noOnlyTests,
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      // bugged in current version of eslint, crashes. Test in the future.
      // https://github.com/typescript-eslint/typescript-eslint/issues/11732
      // https://github.com/eslint/eslint/issues/20272
      '@typescript-eslint/unified-signatures': 'off',

      'no-only-tests/no-only-tests': 'error',
      'simple-import-sort/imports': 'error',

      // turn off unwanted rules:
      '@typescript-eslint/no-non-null-assertion': 'off', // too strict
      '@typescript-eslint/restrict-template-expressions': 'off', // too strict
      '@typescript-eslint/no-unsafe-enum-comparison': 'off', // we shouldnt be using enum either way
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'off', // this is just stylistic and unnecessary
      '@typescript-eslint/no-deprecated': 'off', // too strict
      '@typescript-eslint/restrict-plus-operands': 'off', // too strict

      // these rules are perfect for small simply projects that can avoid `any` type. But not for this project.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',

      // activate extra rules:
      '@typescript-eslint/prefer-nullish-coalescing': [
        'error',
        {
          // we want || for boolean logic and ?? for missing data.
          // Ignoring mixed logical expressions makes this rule ignore most boolean logic, so thats nice.
          ignoreMixedLogicalExpressions: true,
        },
      ],
      eqeqeq: ['error', 'smart'],
      'no-restricted-globals': [
        'error',
        // call them explicitly with `window.close` instead of just `close`. This is to prevent accidental calls to these functions.
        'alert',
        'blur',
        'close',
        'confirm',
        'event',
        'focus',
        'open',
        'scroll',
        'scrollBy',
        'scrollTo',
        'stop',
      ],
      curly: ['error'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        {
          allowNullableBoolean: true,
        },
      ],
      '@typescript-eslint/prefer-enum-initializers': ['error'],

      // change config of activated rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'none',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-confusing-void-expression': [
        'error',
        {
          // having this active is too verbose
          ignoreArrowShorthand: true,
        },
      ],
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: {
            arguments: false,
            attributes: false,
            returns: false,
          },
        },
      ],

      // this rule would be awesome if it worked properly
      // re-evaluate when this issue has been settled:
      // https://github.com/typescript-eslint/typescript-eslint/issues/8113
      '@typescript-eslint/no-invalid-void-type': ['off'],
    },
  },
  // in this object we fix so files not included in tsconfig can still be linted. We skip rules that require typechecking.
  {
    files: ['*.js', '*.mjs', '*.ts'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      'no-undef': 'off',
    },
  },
)
