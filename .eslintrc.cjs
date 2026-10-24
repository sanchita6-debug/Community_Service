/**
 * ESLint configuration for VoicePay.
 *
 * Deliberately light: the rules here catch real mistakes (undefined vars,
 * broken hooks, unused imports) and stay out of the way of formatting. There is
 * no Prettier step, so `npm run lint` is fast enough to run before every build.
 */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: 'detect' },
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  plugins: ['react', 'react-hooks'],
  ignorePatterns: ['dist', 'node_modules', 'client/public'],
  rules: {
    // Vite's React plugin uses the automatic JSX runtime, so `React` does not
    // need to be in scope in any file.
    'react/react-in-jsx-scope': 'off',
    // Props are spread in this codebase far more than they are declared, and
    // the components are presentational wrappers around <button>/<div>.
    'react/prop-types': 'off',
    // A handful of buttons set an explicit type; that is intentional.
    'react/button-has-type': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      // The server is plain Node ESM with no JSX.
      files: ['server/**/*.js', 'shared/**/*.js'],
      rules: { 'react/react-in-jsx-scope': 'off' },
    },
    {
      // TypeScript files. The project is JavaScript-first: only the new
      // .ts/.tsx files are parsed as TypeScript and only they are
      // type-checked (see client/tsconfig.json). The core parser cannot read
      // `export type HeroAction = {...}`, so these files need the
      // TypeScript parser, and the TypeScript plugin's own unused-variable
      // rule, which understands type-only imports.
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      plugins: ['@typescript-eslint'],
      extends: ['plugin:@typescript-eslint/recommended'],
      rules: {
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': [
          'warn',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
      },
    },
    {
      // The vendored glass headline. It is kept byte-identical to the file it
      // was copied from, so the rules that would demand edits to it (a const
      // assertion on a colour palette, a type-only import) are relaxed here
      // rather than the file being "improved" out of sync with its source.
      files: ['client/src/components/ui/glass-headline-hero.tsx'],
      rules: {
        '@typescript-eslint/prefer-as-const': 'off',
      },
    },
  ],
};
