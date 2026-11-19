import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config(
  { ignores: ['dist/**', 'dist-server/**', 'node_modules/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['public/sw.js'],
    languageOptions: {
      globals: {
        self: 'readonly',
        caches: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
      },
    },
  },
  {
    files: ['scheduler/*.js'],
    languageOptions: {
      globals: { fetch: 'readonly', console: 'readonly', URL: 'readonly', AbortSignal: 'readonly' },
    },
  },
  { files: ['**/*.js'], languageOptions: { globals: { process: 'readonly' } } },
);
