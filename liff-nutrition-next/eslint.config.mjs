import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'
import tseslint from 'typescript-eslint'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const eslintConfig = [
  // Ignore certain directories
  {
    ignores: ['.next/', 'node_modules/', 'out/', '*.config.*'],
  },

  // Extend Next.js configs
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  // TypeScript-specific configuration
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: true, // ใช้ project: true แทน array
        tsconfigRootDir: __dirname,
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      // ปิด rules ที่อาจจะ conflict
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]

export default eslintConfig
