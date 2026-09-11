/**
 * Fold the built app into one .html file. No server, no internet: the file is
 * opened straight from a phone or a laptop and it works.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const assets = readdirSync(join(dist, 'assets'));
const js = assets.find((f) => f.endsWith('.js'));
const css = assets.find((f) => f.endsWith('.css'));

let html = readFileSync(join(dist, 'index.html'), 'utf8');
const code = readFileSync(join(dist, 'assets', js), 'utf8');
const style = css ? readFileSync(join(dist, 'assets', css), 'utf8') : '';

// the bundle is full of $& and $` from minified names, and those are magic
// inside a replacement string, so every insert goes through a function
html = html
  .replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '')
  .replace(/<link[^>]*rel="stylesheet"[^>]*>/g, '')
  .replace('</head>', () => `<style>${style}</style></head>`)
  .replace('</body>', () => `<script>${code.replace(/<\/script/gi, '<\\/script')}</script></body>`);

// a broken inline script is a white page on a phone with no console, so the
// build refuses to ship one
new Function(code);           // throws on a syntax error, before anyone downloads it

writeFileSync('شجرة-العائلة.html', html);
console.log('wrote شجرة-العائلة.html', (html.length / 1024).toFixed(0) + ' kB');
