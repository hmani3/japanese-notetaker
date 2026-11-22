/* global __dirname */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const distDir = path.join(__dirname, '..', 'dist');
console.log('[deploy] Building fresh web bundle with latest code...');
require('./build-web.js');

console.log('[deploy] Preparing to push dist/ to origin:gh-pages...');
const gitDir = path.join(distDir, '.git');
if (fs.existsSync(gitDir)) {
  fs.rmSync(gitDir, { recursive: true, force: true });
}

execSync('git init', { cwd: distDir, stdio: 'inherit' });
execSync('git checkout -B gh-pages', { cwd: distDir, stdio: 'inherit' });
execSync('git config user.name "hmani3"', { cwd: distDir, stdio: 'inherit' });
execSync('git config user.email "heemanijaz@gmail.com"', { cwd: distDir, stdio: 'inherit' });
execSync('git add -A', { cwd: distDir, stdio: 'inherit' });
execSync('git commit -m "Deploy permanent standalone version"', { cwd: distDir, stdio: 'inherit' });
execSync('git remote add origin git@github.com:hmani3/japanese-notetaker.git', { cwd: distDir, stdio: 'inherit' });
execSync('git push -f origin gh-pages', { cwd: distDir, stdio: 'inherit' });

fs.rmSync(gitDir, { recursive: true, force: true });
console.log('[deploy] Successfully deployed to gh-pages branch!');
