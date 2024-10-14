module.exports = {
  // ... other configurations ...
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.spec.ts'],
      rules: {
        'no-unused-expressions': 'off',
      },
    },
  ],
};

