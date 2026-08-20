import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

const eslintConfig = [
  {
    ignores: ['.next/**', 'out/**', 'build/**', 'node_modules/**', 'next-env.d.ts'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // CLAUDE.md: "NO `any` en TypeScript". Error, no warning.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Los scripts de infraestructura corren con node, fuera del bundle de Next.
    files: ['scripts/**/*.mjs'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      // Usan `cond ? ok(...) : falla(...)` para reportar; es deliberado y legible aquí.
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
]

export default eslintConfig
