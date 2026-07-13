import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/coverage/**',
      '**/dist/**',
      '**/node_modules/**',
      '**/out/**',
      'apps/api/generated/**',
      'apps/desktop/src/generated/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: [
      'apps/api/**/*.{ts,tsx}',
      'apps/desktop/electron/**/*.{ts,tsx}',
      'apps/desktop/*.config.ts',
      'apps/worker/**/*.{ts,tsx}',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['apps/api/**/*.spec.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
  {
    files: ['apps/desktop/src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?:electron(?:/|$)|node:)',
              message: 'Renderer 代码不能直接依赖 Electron 或 Node.js 运行时模块。',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/desktop/src/**/*.{ts,tsx}'],
    ignores: ['apps/desktop/src/api/**', 'apps/desktop/src/generated/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?:electron(?:/|$)|node:)',
              message: 'Renderer 代码不能直接依赖 Electron 或 Node.js 运行时模块。',
            },
            {
              regex: '(^|/)generated/api(?:/|$)',
              message: '业务代码请通过 src/api 适配层访问生成客户端或 DTO 类型。',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/desktop/tests/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
);
