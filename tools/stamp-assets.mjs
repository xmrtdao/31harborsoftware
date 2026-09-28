#!/usr/bin/env node
// Stamp content-version query strings onto the company's local assets.
//
// Why this exists: GitHub Pages lets Cloudflare rewrite the origin's `no-cache`
// to `max-age=14400` — four hours. A visitor who loaded the site before the
// rebrand kept the old brand/style.css in their HTTP cache, and when the new
// index.html arrived the browser applied a stale stylesheet to new markup. The
// result rendered as an unstyled, scrambled page while the CDN was serving
// perfectly correct bytes. Verified: the deployed CSS was byte-identical to
// local and contained the new dark theme, yet the browser computed the old
// light background because it never asked.
//
// The fix is to change the URL whenever the bytes change. A query string makes
// it a different cache key, so a stale entry can never be selected. brand/check.js
// asserts every local asset is versioned and that the version matches the file,
// so forgetting to re-stamp fails the check instead of shipping.
//
//   node tools/stamp-assets.mjs          stamp before committing
//   node tools/stamp-assets.mjs --check  verify only, non-zero exit if stale
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = join(ROOT, 'index.html');
const CHECK_ONLY = process.argv.includes('--check');

/** Short content hash: long enough not to collide, short enough to read. */
export function assetVersion(relPath) {
  return createHash('sha256').update(readFileSync(join(ROOT, relPath))).digest('hex').slice(0, 10);
}

const ASSETS = ['brand/style.css'];

let page = readFileSync(PAGE, 'utf8');
let changed = 0;
const stamped = [];

for (const rel of ASSETS) {
  const want = assetVersion(rel);
  // Match the href with or without an existing ?v= so re-stamping is idempotent.
  const re = new RegExp(`(href="${rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?:\\?v=[0-9a-f]+)?(")`);
  const m = page.match(re);
  if (!m) {
    console.error(`  could not find a reference to ${rel} in index.html`);
    process.exit(1);
  }
  const have = /v=([0-9a-f]+)/.exec(m[0])?.[1] || null;
  stamped.push({ rel, want, have, ok: have === want });
  if (have !== want) {
    changed++;
    page = page.replace(re, `$1?v=${want}$2`);
  }
}

if (CHECK_ONLY) {
  const stale = stamped.filter(s => !s.ok);
  for (const s of stamped) {
    console.log(`  ${s.rel.padEnd(18)} v=${s.have || '(none)'}  want ${s.want}  ${s.ok ? 'ok' : 'STALE'}`);
  }
  if (stale.length) {
    console.error(`\n  ${stale.length} asset reference(s) stale — run: node tools/stamp-assets.mjs`);
    process.exit(1);
  }
  console.log('\n  all asset references are content-versioned and current');
  process.exit(0);
}

if (changed) {
  writeFileSync(PAGE, page, 'utf8');
  console.log(`  re-stamped ${changed} asset reference(s) in index.html`);
} else {
  console.log('  asset references already current — index.html unchanged');
}
for (const s of stamped) console.log(`  ${s.rel.padEnd(18)} ?v=${s.want}`);
