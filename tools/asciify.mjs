#!/usr/bin/env node
// Make the company page pure ASCII.
//
// index.html was corrupted once already: a PowerShell pass ran
// `Get-Content -Raw` over a BOM-less UTF-8 file, so Windows-1252 decoded the
// bytes and every em dash became the three characters 'â€"'. The page still
// served, so the damage was invisible until a screenshot.
//
// The durable fix is not to repair the mojibake but to remove the reason it
// exists. ASCII is a subset of every encoding, so a file containing only ASCII
// cannot be mis-decoded by any tool in this repo — including the next careless
// PowerShell pass. Punctuation goes out as HTML entities, which is what they
// should have been all along.
//
//   node tools/asciify.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TARGETS = ['index.html', 'brand/style.css'];

// U+00E2 U+20AC U+201D is the CP1252 reading of the em dash (E2 80 94).
// U+00E2 U+201D U+20AC is the CP1252 reading of the right quote (E2 80 9D).
const REPAIRS = [
  ['\u00e2\u20ac\u201d', '&mdash;'],  // â€"  ->  em dash
  ['\u00e2\u201d\u20ac', '&#8221;'],  // â€?  ->  right double quote
  ['\u00e2\u20ac\u2122', '&trade;'], // â€?  ->  trade mark
  ['\u00e2\u0080\u0093', '&mdash;'], // raw Latin-1 reading
  ['\u00e2\u0080\u0094', '&mdash;'],
];

let totalFixed = 0;
const report = [];

for (const rel of TARGETS) {
  const path = join(ROOT, rel);
  const before = readFileSync(path, 'utf8');
  let text = before;
  for (const [bad, good] of REPAIRS) {
    const n = text.split(bad).length - 1;
    if (n) { text = text.split(bad).join(good); totalFixed += n; }
  }

  // Whatever non-ASCII survived is reported rather than guessed at. Anything
  // left here needs a decision, not a silent substitution.
  const strays = [...new Set([...text].filter(c => c.codePointAt(0) > 127))];

  // Comment banners used box-drawing characters; plain dashes read the same.
  text = text.replace(/[\u2500-\u257F]/g, '-');

  const stillStray = [...new Set([...text].filter(c => c.codePointAt(0) > 127))];
  writeFileSync(path, text, 'utf8');

  report.push(`  ${rel.padEnd(18)} ${before.length}b -> ${text.length}b  repaired=${before.length - strays.length > 0 ? 'some' : 'none'}`);
  if (strays.length) report.push(`      strays seen before ASCII pass: ${strays.map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ')}`);
  if (stillStray.length) report.push(`      STILL NON-ASCII: ${stillStray.map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ')}`);
}

console.log(report.join('\n'));
console.log(totalFixed ? `\nrepaired ${totalFixed} mojibake sequence(s)` : '\nno mojibake found');
