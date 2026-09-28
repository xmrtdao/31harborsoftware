#!/usr/bin/env node
// Restore the archived listing files from git with their original bytes.
//
// PowerShell's `git show ... > file` redirection writes UTF-16LE, which silently
// turned the archived listing into 37KB of NUL-interleaved text. Git is asked
// for the blob and Node writes the bytes verbatim, so the encoding survives.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// This script lives in tools/, so the repository root is one level up.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['index.html', 'PRESS_RELEASE.md', 'README.md', 'SALES_STRATEGY.md'];
const REV = 'origin/main';

function gitBlob(ref, path) {
  return execFileSync('git', ['show', `${ref}:${path}`], {
    cwd: ROOT, maxBuffer: 64 * 1024 * 1024,
  });
}

let bad = 0;
for (const file of FILES) {
  const dest = join(ROOT, 'listing', file);
  try {
    const buf = gitBlob(REV, file);
    // A UTF-16 artefact shows up as a BOM followed by a NUL on every odd byte.
    const looksUtf16 = buf[0] === 0xff && buf[1] === 0xfe;
    if (looksUtf16) { console.log(`  ${file}: refusing to write UTF-16 from git`); bad++; continue; }
    writeFileSync(dest, buf);
    const text = buf.toString('utf8');
    const hasTitle = /<title>([^<]*)<\/title>/.exec(text)?.[1] || '';
    console.log(`  ${file.padEnd(20)} ${String(buf.length).padStart(7)}b  utf8-clean=${!buf.includes(0)}  ${hasTitle ? 'title="' + hasTitle + '"' : ''}`);
  } catch (e) {
    console.log(`  ${file}: ${e.message.split('\n')[0]}`);
    bad++;
  }
}

// The root copies of the docs are the listing's own docs; keep them identical
// to what the remote has, byte for byte.
for (const file of FILES.slice(1)) {
  try {
    const buf = gitBlob(REV, file);
    writeFileSync(join(ROOT, file), buf);
    console.log(`  root ${file.padEnd(15)} synced from ${REV}`);
  } catch (e) {
    console.log(`  root ${file}: ${e.message.split('\n')[0]}`);
    bad++;
  }
}

console.log(bad === 0 ? '\nall archived files restored byte-accurately' : `\n${bad} file(s) could not be restored`);
process.exit(bad === 0 ? 0 : 1);
