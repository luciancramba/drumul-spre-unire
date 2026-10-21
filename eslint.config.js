const js=require('@eslint/js');
const globals=require('globals');

module.exports=[
  {ignores:['dist/**','dist-site/**','reference/**','tools/trailer/out/**']},
  js.configs.recommended,
  {
    files:['src/**/*.js','site/**/*.js'],
    languageOptions:{sourceType:'script',globals:{...globals.browser,DSU:'writable',Landing:'writable',module:'readonly',require:'readonly'}},
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
