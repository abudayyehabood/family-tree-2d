/**
 * Same bundle as the one-file build, but shaped for a hosted page: no
 * <html>/<head>/<body> of its own, since the host wraps it.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const assets = readdirSync('dist/assets');
const js = readFileSync(join('dist/assets', assets.find((f) => f.endsWith('.js'))), 'utf8');
const cssFile = assets.find((f) => f.endsWith('.css'));
const css = cssFile ? readFileSync(join('dist/assets', cssFile), 'utf8') : '';

const page = `<title>شجرة العائلة</title>
<style>
html, body { height: 100%; margin: 0; background: #f4f1e8; }
#root { height: 100dvh; }
${css}
</style>
<div id="root"></div>
<script>${js}</script>
`;

writeFileSync('artifact/family-tree.html', page);
console.log('wrote artifact/family-tree.html', (page.length / 1024).toFixed(0) + ' kB');
