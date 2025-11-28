module.exports = {
  env: {
    es6: true,
    node: true
  },
  extends: [
    'standard' // Use the Standard style guide
    // 'plugin:security/recommended' // Use recommended security rules
    // 'eslint:recommended',
    // 'plugin:react/recommended',
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly'
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    // 'no-console': 'warn',
    semi: ['error', 'always']
    // 'no-async-promise-executor': 'off',
    // 'max-params': ['warn', {
    //   max: 6
    // }],
    // 'space-before-function-paren': ['error', {
    //   anonymous: 'ignore',
    //   named: 'ignore',
    //   asyncArrow: 'ignore'
    // }],
    // 'no-case-declarations': 'warn',
    // 'max-lines-per-function': ['error', {
    //   max: 3000
    // }],
    // 'max-lines': ['error', {
    //   max: 3000
    // }]
  }
};
