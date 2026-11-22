/* global __dirname */
const fs = require('fs');
const path = require('path');

// 1. Ensure kanji.min.js exists
const kanjiSrc = path.join(__dirname, '..', 'node_modules', 'kanji.js', 'dist', 'kanji.js');
const kanjiDst = path.join(__dirname, '..', 'node_modules', 'kanji.js', 'dist', 'kanji.min.js');
if (fs.existsSync(kanjiSrc) && !fs.existsSync(kanjiDst)) {
  fs.copyFileSync(kanjiSrc, kanjiDst);
  console.log('[patch] Created kanji.min.js');
}

// 2. Polyfill URL.parse for Node < 20.18.0 / 22.1.0 in Expo CLI
const polyfillSnippet = `
// Polyfill URL.parse for Node < 20.18.0
if (typeof URL !== 'undefined' && !URL.parse) {
  URL.parse = function(url, base) {
    try {
      return new URL(url, base);
    } catch {
      return null;
    }
  };
}
`;

const targets = [
  path.join(__dirname, '..', 'node_modules', 'expo', 'bin', 'cli'),
  path.join(__dirname, '..', 'node_modules', 'expo', 'node_modules', '@expo', 'cli', 'build', 'src', 'index.js'),
  path.join(__dirname, '..', 'node_modules', '@expo', 'cli', 'build', 'src', 'index.js'),
];

for (const target of targets) {
  if (fs.existsSync(target)) {
    let content = fs.readFileSync(target, 'utf8');
    if (!content.includes('Polyfill URL.parse')) {
      if (content.startsWith('#!/usr/bin/env node')) {
        content = content.replace('#!/usr/bin/env node', '#!/usr/bin/env node\n' + polyfillSnippet);
      } else {
        content = polyfillSnippet + '\n' + content;
      }
      fs.writeFileSync(target, content, 'utf8');
      console.log('[patch] Added URL.parse polyfill to', path.relative(path.join(__dirname, '..'), target));
    }
  }
}
