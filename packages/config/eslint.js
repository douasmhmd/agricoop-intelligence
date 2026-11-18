// Shared ESLint flat config for the apps/ and packages/ workspaces.
import js from '@eslint/js';
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/generated/**',
      '**/routeTree.gen.ts',
      // Keycloakify's generated entry (apps/keycloak-theme)
      '**/kc.gen.tsx',
      '**/playwright-report/**',
      '**/test-results/**',
      // Static files copied as is by Vite (e.g. the runtime config.js placeholder), outside any tsconfig.
      'apps/*/public/**',
      'public/**',
      'data/**',
      'infra/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  comments.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
      globals: { ...globals.node },
    },
    rules: {
      // Every `any` needs an explicit, described eslint-disable comment.
      '@typescript-eslint/no-explicit-any': 'error',
      '@eslint-community/eslint-comments/require-description': ['error', { ignore: [] }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        // Nest relies on emitted decorator metadata: type-only imports of injected classes break DI,
        // so type imports are only enforced where they are not used by decorators.
        { prefer: 'type-imports', fixStyle: 'inline-type-imports', disallowTypeAnnotations: false },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // NestJS sources: decorator metadata needs value imports of injected classes.
    files: ['apps/api/**/*.ts', 'apps/qr/**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
  {
    files: [
      '**/*.tsx',
      'apps/web/**/*.ts',
      'apps/backoffice/**/*.ts',
      'apps/keycloak-theme/**/*.ts',
    ],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // TanStack file routes export `Route` next to their component; shadcn/ui files export variants.
    files: ['**/src/routes/**/*.tsx', '**/src/components/ui/**/*.tsx', '**/src/main.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  prettier,
);
