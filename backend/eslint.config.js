const js = require('@eslint/js');

/**
 * Deliberately light-touch: this is a plain Node/CommonJS/Express codebase
 * with no existing lint history, so the rule set below catches real bugs
 * (unused vars, undefined globals, unreachable code) without re-litigating
 * every existing file's style. Tighten it incrementally rather than
 * dropping in a strict config that immediately buries real findings under
 * hundreds of pre-existing style violations.
 */
module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'writable',
        exports: 'writable',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
      },
    },
    rules: {
      // A caught error that's deliberately unused (e.g. errorHandler.js's
      // Express-mandated 4-arg signature) is a normal, common pattern here
      // -- only flag genuinely unused *variables*, not that.
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
      'no-console': 'off', // logger.js wraps winston; nothing here should use console directly, but that's a convention, not a parse-time concern
    },
  },
  {
    // Jest's globals (describe/it/expect/jest/...) aren't real Node
    // globals, so *.test.js needs its own languageOptions rather than
    // sharing the plain-source block above.
    files: ['**/*.test.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        jest: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
  },
  {
    ignores: ['node_modules/', 'coverage/', 'uploads/', 'fonts/', 'dist/'],
  },
];
