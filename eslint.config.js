import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  { ignores: ['dist', 'coverage'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      // React 17+ automatic JSX runtime: React need not be in scope.
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      // The project does not use prop-types.
      'react/prop-types': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }]
    }
  },
  {
    // Build tool configs run in Node.
    files: ['*.config.js'],
    languageOptions: { globals: globals.node }
  },
  {
    // Firestore rules tests run in Node (Vitest, node environment).
    files: ['tests/firestore-rules/**/*.js'],
    languageOptions: { globals: globals.node }
  },
  {
    // Vitest test files and setup (vitest `globals: true`).
    files: ['src/**/*.test.{js,jsx}', 'src/test/**/*.{js,jsx}'],
    languageOptions: { globals: globals.vitest }
  },
  // Must be last: turns off stylistic rules that conflict with Prettier.
  eslintConfigPrettier
];
