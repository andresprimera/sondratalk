import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import importPlugin from 'eslint-plugin-import'
import checkFile from 'eslint-plugin-check-file'
import { defineConfig, globalIgnores } from 'eslint/config'

const RESTRICTED_IMPORT_PATHS = [
  { name: 'axios', message: 'Use the fetch wrappers in @/lib/api instead of axios.' },
  { name: 'date-fns', message: 'Use native Date / Intl APIs.' },
  { name: 'dayjs', message: 'Use native Date / Intl APIs.' },
  { name: 'moment', message: 'Use native Date / Intl APIs.' },
  { name: 'zustand', message: 'Use React Query for server state and useState/Context for local state.' },
  { name: 'redux', message: 'Use React Query for server state and useState/Context for local state.' },
  { name: '@reduxjs/toolkit', message: 'Use React Query for server state and useState/Context for local state.' },
  { name: 'jotai', message: 'Use React Query for server state and useState/Context for local state.' },
  { name: 'zod', message: 'Import Zod from "zod/v4" instead of "zod".' },
  { name: '@hookform/resolvers/zod', message: 'Use standardSchemaResolver from "@hookform/resolvers/standard-schema".' },
]

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      import: importPlugin,
      'check-file': checkFile,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-hooks/immutability': 'off',

      // No `any` types and no type assertions (allow `as const`)
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            "TSAsExpression:not([typeAnnotation.type='TSTypeReference'][typeAnnotation.typeName.name='const'])",
          message:
            'Type assertions (`as`) are not allowed except for `as const`. Use type guards, generics, or proper narrowing.',
        },
        {
          selector: "ExpressionStatement[expression.type='Literal'][expression.value='use client']",
          message: '"use client" is a Next.js directive — this is a Vite + React SPA.',
        },
        {
          selector: "ExpressionStatement[expression.type='Literal'][expression.value='use server']",
          message: '"use server" is a Next.js directive — this is a Vite + React SPA.',
        },
      ],

      // Forbidden imports + `../` parent imports (use the @/ alias)
      'no-restricted-imports': [
        'error',
        {
          paths: RESTRICTED_IMPORT_PATHS,
          patterns: [
            {
              group: ['../*', '../**'],
              message: 'Use the "@/" alias instead of relative parent imports.',
            },
          ],
        },
      ],

      // Browser-native confirm/alert/prompt — use shadcn AlertDialog / sonner
      'no-alert': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'confirm', message: 'Use shadcn AlertDialog instead of window.confirm().' },
        { name: 'alert', message: 'Use sonner toast or shadcn Dialog instead of window.alert().' },
        { name: 'prompt', message: 'Use shadcn Dialog with a form instead of window.prompt().' },
      ],

      // No console.log / .error / .warn — surface errors via toast or React Query state
      'no-console': 'error',

      // Pages use default exports; everything else uses named exports
      'import/no-default-export': 'error',

      // kebab-case filenames
      'check-file/filename-naming-convention': [
        'error',
        { '**/*.{ts,tsx}': 'KEBAB_CASE' },
        { ignoreMiddleExtensions: true },
      ],
    },
  },

  // shadcn-managed components — exempt from project rules (do not edit these)
  {
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
      'no-restricted-syntax': 'off',
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Pages must use default exports
  {
    files: ['src/pages/**/*.{ts,tsx}'],
    rules: {
      'import/no-default-export': 'off',
    },
  },

  // i18next requires a default export from the config module
  {
    files: ['src/lib/i18n.ts'],
    rules: {
      'import/no-default-export': 'off',
    },
  },

  // Vite/Vitest config files use default exports by convention
  {
    files: ['*.config.{ts,js,mjs}', 'vite.config.ts', 'vitest.config.ts'],
    rules: {
      'import/no-default-export': 'off',
    },
  },

  // App.tsx / main.tsx — canonical Vite + React entry points
  {
    files: ['src/App.tsx', 'src/main.tsx'],
    rules: {
      'import/no-default-export': 'off',
      'check-file/filename-naming-convention': 'off',
    },
  },

  // Test files: relax type-assertion warning (mocks frequently need `as unknown as T`)
  {
    files: ['**/*.spec.{ts,tsx}', '**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
])
