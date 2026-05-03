import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import checkFile from 'eslint-plugin-check-file';
import { defineConfig, globalIgnores } from 'eslint/config';

const RESTRICTED_IMPORT_PATHS = [
  { name: 'axios', message: 'Use fetch — the project does not use axios.' },
  { name: 'date-fns', message: 'Use native Date / Intl APIs.' },
  { name: 'dayjs', message: 'Use native Date / Intl APIs.' },
  { name: 'moment', message: 'Use native Date / Intl APIs.' },
  { name: 'zod', message: 'Import Zod from "zod/v4" instead of "zod".' },
];

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    plugins: {
      import: importPlugin,
      'check-file': checkFile,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
    },
    rules: {
      // No `any` types and no type assertions (allow `as const`)
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            "TSAsExpression:not([typeAnnotation.type='TSTypeReference'][typeAnnotation.typeName.name='const'])",
          message:
            'Type assertions (`as`) are not allowed except for `as const`. Documented exceptions: Mongoose enum casts (e.g. `user.role as Role`) and ms StringValue config — disable per-line for those.',
        },
      ],

      // Forbidden imports
      'no-restricted-imports': [
        'error',
        { paths: RESTRICTED_IMPORT_PATHS },
      ],

      // No console.* — use NestJS Logger
      'no-console': 'error',

      // kebab-case filenames
      'check-file/filename-naming-convention': [
        'error',
        { '**/*.ts': 'KEBAB_CASE' },
        { ignoreMiddleExtensions: true },
      ],
    },
  },

  // Test files: relax type-assertion warning (mocks frequently need `as unknown as T`)
  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
]);
