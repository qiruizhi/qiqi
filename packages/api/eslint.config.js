export default [
  {
    ignores: ['dist/**', 'prisma/**'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': 'off',
    },
  },
];
