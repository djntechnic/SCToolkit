import js from '@eslint/js';
import userscripts from 'eslint-plugin-userscripts';

export default [
  {
    // dist/ is generated, but the built .user.js is still linted below — its
    // metadata block is what users install against.
    ignores: ['node_modules/**', 'legacy/**', 'test/fixtures/**', 'dist/**', '!dist/*.user.js']
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        requestIdleCallback: 'readonly',
        MutationObserver: 'readonly',
        ResizeObserver: 'readonly',
        AbortController: 'readonly',
        DOMParser: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        Intl: 'readonly',
        localStorage: 'readonly',
        GM_getValue: 'readonly',
        GM_setValue: 'readonly',
        GM_info: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error'
    }
  },
  {
    files: ['scripts/**/*.js', 'test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly'
      }
    }
  },
  {
    // Validate the generated ==UserScript== metadata block: known keys,
    // well-formed @match patterns, required fields. Code-quality rules are off
    // here — the body is bundler output, not authored source.
    files: ['dist/*.user.js'],
    plugins: { userscripts },
    languageOptions: { ecmaVersion: 2023, sourceType: 'script' },
    settings: { userscriptVersions: { tampermonkey: '*' } },
    rules: {
      ...userscripts.configs.recommended.rules,
      'no-unused-vars': 'off',
      'no-empty': 'off',
      'no-undef': 'off',
      'no-cond-assign': 'off',
      'no-control-regex': 'off',
      'no-fallthrough': 'off',
      'no-useless-escape': 'off',
      'no-prototype-builtins': 'off'
    }
  }
];
