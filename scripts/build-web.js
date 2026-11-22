/* global __dirname */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('[build-web] Exporting web bundle with Expo (secrets stripped for public deployment)...');
// Ensure no private secrets are baked into the public bundle
const env = { ...process.env, EXPO_PUBLIC_GEMINI_API_KEY: '' };
execSync('npx expo export -p web', { stdio: 'inherit', env });

const distDir = path.join(__dirname, '..', 'dist');
const indexPath = path.join(distDir, 'index.html');

if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');

  // 1. Ensure viewport-fit=cover so iOS Safari does not letterbox with white margins
  html = html.replace(
    '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />'
  );

  // 2. Inject dark background reset styles to prevent any white margins/overscroll
  const darkStyle = `
    <style>
      html, body, #root {
        background-color: #131317 !important;
        color-scheme: dark;
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        height: 100dvh;
        min-height: 100dvh;
        overflow: hidden;
        overscroll-behavior: none;
        -webkit-user-select: none;
        user-select: none;
      }
      #root {
        display: flex;
        flex-direction: column;
      }
      @media (hover: none) and (pointer: coarse), (max-width: 768px) {
        #app-header {
          padding-top: max(env(safe-area-inset-top, 0px), 54px) !important;
        }
        #app-nav {
          padding-bottom: max(env(safe-area-inset-bottom, 0px), 20px) !important;
        }
      }
    </style>
  `;

  // 3. Inject iOS standalone PWA meta tags
  const pwaMeta = `
    <!-- iOS Full-screen Standalone App Support -->
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Manga Kanji" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="theme-color" content="#131317" />
    <link rel="apple-touch-icon" href="/japanese-notetaker/apple-touch-icon.png" />
  `;

  html = html.replace('<head>', '<head>' + darkStyle + pwaMeta);
  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('[build-web] Injected viewport-fit=cover, dark background reset, and iOS PWA meta tags');
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
