const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('[build-web] Exporting web bundle with Expo...');
execSync('npx expo export -p web', { stdio: 'inherit' });

const distDir = path.join(__dirname, '..', 'dist');
const indexPath = path.join(distDir, 'index.html');

if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');

  // Inject iOS standalone PWA meta tags
  const pwaMeta = `
    <!-- iOS Full-screen Standalone App Support -->
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Manga Kanji" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="theme-color" content="#111113" />
    <link rel="apple-touch-icon" href="/japanese-notetaker/apple-touch-icon.png" />
  `;

  html = html.replace('<head>', '<head>' + pwaMeta);
  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('[build-web] Injected iOS PWA meta tags into index.html');
}

// Copy icon to apple-touch-icon.png for iOS Home Screen icon
const iconSrc = path.join(__dirname, '..', 'assets', 'icon.png');
const iconDst = path.join(distDir, 'apple-touch-icon.png');
if (fs.existsSync(iconSrc)) {
  fs.copyFileSync(iconSrc, iconDst);
  console.log('[build-web] Created apple-touch-icon.png');
}

// Crucial: Create .nojekyll so GitHub Pages serves _expo/ directories
const noJekyllPath = path.join(distDir, '.nojekyll');
fs.writeFileSync(noJekyllPath, '', 'utf8');
console.log('[build-web] Created .nojekyll for GitHub Pages');

console.log('[build-web] Standalone web build complete!');
