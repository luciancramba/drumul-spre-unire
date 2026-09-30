const js=require('@eslint/js');
const globals=require('globals');

module.exports=[
  {ignores:['dist/**','reference/**','tools/trailer/out/**']},
  js.configs.recommended,
  {
    files:['src/**/*.js'],
    languageOptions:{sourceType:'script',globals:{...globals.browser,DSU:'writable',module:'readonly',require:'readonly'}},
  },
  {
    files:['tests/**/*.js','eslint.config.js'],
    languageOptions:{sourceType:'commonjs',globals:globals.node},
  },
  {
    files:['**/*.mjs'],
    languageOptions:{sourceType:'module',globals:globals.node},
  },
];
