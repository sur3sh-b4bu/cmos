// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'coms',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'coms',
          style: 'kebab-case',
        },
      ],
      // `any` shows up deliberately throughout the list/table components
      // (e.g. `rows = signal<any[]>([])` -- a table's row shape genuinely
      // varies per config-driven list). Retyping all of that is a much
      // bigger, riskier effort than adding lint tooling itself, so this
      // stays a warning (visible, not blocking) rather than an error until
      // it's tackled deliberately.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {
      // autofocus on the login form's username field and the command
      // palette's search box (opened by an explicit user action, e.g.
      // Ctrl+K) is a deliberate, common UX choice, not an oversight --
      // kept as a warning rather than silenced outright since the
      // accessibility concern (screen-reader focus jumping unannounced) is
      // real, just outweighed here.
      '@angular-eslint/template/no-autofocus': 'warn',
    },
  },
]);
