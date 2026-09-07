import js from '@eslint/js';
import globals from 'globals';
import pluginVue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'public/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2020,
      },
    },
  },
  {
    files: ['resources/js/**/*.{ts,vue}'],
    rules: {
      // AGENTS.md: Composition API with <script setup lang="ts"> ONLY.
      'vue/component-api-style': ['error', ['script-setup']],
      // AGENTS.md: strict type safety, zero use of `any`.
      '@typescript-eslint/no-explicit-any': 'error',
      // Best-effort localStorage guards intentionally use empty catch blocks.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Single-word name is fine for the single-page app root (not a reusable component).
      'vue/multi-word-component-names': 'off',
      'no-console': 'off',
    },
  }
);