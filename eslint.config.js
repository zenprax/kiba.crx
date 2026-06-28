// @ts-check
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsdoc from 'eslint-plugin-jsdoc';
import prettier from 'eslint-config-prettier';

/**
 * Flat ESLint config for kiba.crx.
 *
 * ESM module (package.json has `"type": "module"`); ESLint v9 fully supports it.
 * Layering: ignore globs -> typescript-eslint recommended -> react-hooks ->
 * jsdoc (TypeScript flavor) -> our overrides -> prettier last so formatting
 * rules never conflict with Prettier.
 */
export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'public/**', '*.config.js', '*.config.ts'],
  },

  // Base TypeScript rules for all source files.
  ...tseslint.configs.recommended,

  // JSDoc rules, TypeScript flavor (types live in code, not in @param tags).
  jsdoc.configs['flat/recommended-typescript'],

  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      // Core Hooks rules — stable across React 17-18.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Non-Compiler subset from react-hooks v7 (stable React 18 semantics).
      // Verified zero violations before promoting to 'error'.
      'react-hooks/void-use-memo': 'error',
      'react-hooks/set-state-in-render': 'error',
      'react-hooks/incompatible-library': 'warn',

      // React-Compiler-era rules (purity, immutability, static-components, refs,
      // globals, preserve-manual-memoization, use-memo, set-state-in-effect,
      // error-boundaries, config, gating, unsupported-syntax) flag many legitimate
      // React 18 patterns. Explicitly deferred until React Compiler adoption.

      // CLAUDE.md mandates no `any`; enforce it mechanically.
      '@typescript-eslint/no-explicit-any': 'error',

      // Underscore-prefixed args/vars are intentional placeholders.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // JSDoc policy: require docs only on *exported* declarations, not every
      // function. Description completeness starts as `warn` and is promoted to
      // `error` once the codebase-wide English pass (phase F4) is finished.
      'jsdoc/require-jsdoc': [
        'warn',
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
          },
          contexts: [
            'TSInterfaceDeclaration',
            'TSTypeAliasDeclaration',
            'TSEnumDeclaration',
          ],
        },
      ],
      'jsdoc/require-description': 'warn',
      // Types already document params/returns; don't force redundant tags
      // (especially noisy on destructured React component props -> `root0`).
      'jsdoc/require-param': 'off',
      'jsdoc/require-returns': 'off',
      // Tag/type consistency is cheap to satisfy and worth enforcing now.
      'jsdoc/check-param-names': 'error',
      // `@vitest-environment` is a Vitest file-level pragma, not a JSDoc tag.
      'jsdoc/check-tag-names': ['error', { typed: true, definedTags: ['vitest-environment'] }],
      // The TypeScript flavor does not need types in tags.
      'jsdoc/no-types': 'off',
      'jsdoc/require-param-type': 'off',
      'jsdoc/require-returns-type': 'off',
    },
  },

  // Test files: relax doc requirements.
  {
    files: ['src/**/*.test.{ts,tsx}'],
    rules: {
      'jsdoc/require-jsdoc': 'off',
    },
  },

  // Prettier compatibility — must be last.
  prettier,
);
