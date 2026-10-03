import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// The stamp in index.html must be a content hash of brand/style.css.
//
// It used to be a hand-written literal, bumped by hand on every CSS edit. That is
// exactly the kind of step that gets forgotten, and when it is, the edit reaches
// nobody: GitHub Pages and Cloudflare both serve the old file under the old query
// string, the browser never revalidates, and the page silently renders with
// yesterday's CSS. That is not hypothetical - the partner portraits shipped with
// no CSS applied at all because the stamp had not moved, and the 512px images then
// pushed the layout 256px wider than a 360px screen.
//
// Deriving the stamp from the content removes the step. There is nothing to forget.

const ROOT = path.resolve(process.argv[2] || '.');
const CSS = path.join(ROOT, 'brand', 'style.css');
const HTML = path.join(ROOT, 'index.html');

const STAMP_RE = /(brand\/style\.css\?v=)([a-z0-9]+)/;
const REQUIRED = 10;

function contentStamp(css) {
  return createHash('sha256').update(css).digest('hex').slice(0, REQUIRED);
}

const css = fs.readFileSync(CSS, 'utf8');
const want = contentStamp(css);
const html = fs.readFileSync(HTML, 'utf8');

const m = html.match(STAMP_RE);
if (!m) {
  console.error('FAIL  no brand/style.css?v= stamp found in index.html');
  process.exit(1);
}
const have = m[2];

if (have === want) {
  console.log(`ok    style.css?v=${have}  matches the file (${css.length}b)`);
  process.exit(0);
}

if (process.argv.includes('--fix')) {
  // Replace every occurrence: index.html may reference the stylesheet more than once.
  let n = 0;
  const out = html.replace(new RegExp(STAMP_RE.source, 'g'), (full, pre) => {
    n++;
    return pre + want;
  });
  fs.writeFileSync(HTML, out);
  console.log(`fixed ${n} stamp(s): ${have} -> ${want}  (${css.length}b of CSS)`);
  process.exit(0);
}

console.error(`FAIL  index.html says ?v=${have} but brand/style.css hashes to ${want}`);
console.error('      GitHub Pages will serve the previous CSS to anyone who has this page cached.');
console.error('      Run:  node tools/css-stamp.mjs . --fix');
process.exit(1);