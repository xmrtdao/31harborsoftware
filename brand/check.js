/* Structure and asset-integrity check for the Jobby brand site.
 *
 *   npx serve@14 -l 8899 --no-clipboard .
 *   node brand/check.js
 *
 * Catches the two failure modes that only show up after a deploy: an asset
 * reference that 404s in production, and the archived property listing losing a
 * file when the brand page replaced the site root.
 *
 * Colour contrast is measured separately in a real browser engine — see
 * brand/contrast.js, which runs the same pairs through Chromium.
 */
const BASE = process.env.SITE_URL || 'http://127.0.0.1:8899';

let fails = 0;
const check = (label, cond, detail) => {
  if (cond) { console.log('  PASS  ' + label); return; }
  fails++;
  console.log('  FAIL  ' + label + (detail !== undefined ? `  -> ${JSON.stringify(detail)}` : ''));
};

async function main() {
  console.log('=== brand page ===');
  const page = await fetch(BASE + '/');
  const html = page.ok ? await page.text() : '';
  check('root serves 200', page.ok, page.status);
  check('root is the Jobby brand page',
    /Jobby McJobberson/.test(html) && !/Amagansett/.test(html));
  check('has a title', /<title>[^<]+<\/title>/.test(html));
  check('has a meta description', /name="description" content="[^"]{40,}"/.test(html));
  check('has Open Graph tags', /property="og:title"/.test(html));
  check('links to the working product', /https:\/\/jobby\.mobilemonero\.com/.test(html));
  check('links to the archived listing', /href="\/listing\/"/.test(html));

  console.log('\n=== brand assets ===');
  for (const asset of ['/brand/style.css', '/brand/app.js']) {
    const r = await fetch(BASE + asset);
    check(`${asset} serves`, r.ok, r.status);
  }

  console.log('\n=== every referenced asset resolves ===');
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1])
    .filter(u => u.startsWith('/') && !u.startsWith('//'));
  for (const ref of new Set(refs)) {
    const r = await fetch(BASE + ref);
    check(`asset ${ref} resolves`, r.ok, r.status);
  }

  console.log('\n=== the archived listing survived ===');
  const listing = await fetch(BASE + '/listing/');
  const listingHtml = listing.ok ? await listing.text() : '';
  check('archived listing serves', listing.ok, listing.status);
  check('archive is still the property listing', /Amagansett|Harbor Road/i.test(listingHtml));
  check('listing contact form still targets the relay',
    /relay\.mobilemonero\.com\/api\/contact\/31harbor/.test(listingHtml));
  check('listing has no absolute paths that would break under /listing/',
    !/(?:href|src)="\//.test(listingHtml));

  const listingRefs = [...listingHtml.matchAll(/(?:href|src)="([^"]+)"/g)]
    .map(m => m[1])
    .filter(u => u && !u.startsWith('http') && !u.startsWith('mailto:') &&
      !u.startsWith('tel:') && !u.startsWith('#') && !u.startsWith('data:') && !u.startsWith('//'));
  const uniqueRefs = [...new Set(listingRefs)];
  const broken = [];
  for (const ref of uniqueRefs) {
    const r = await fetch(`${BASE}/listing/${ref}`);
    if (!r.ok) broken.push(`${ref} -> ${r.status}`);
  }
  check(`all ${uniqueRefs.length} archived listing assets resolve`, broken.length === 0, broken);

  for (const page2 of ['thank-you.html', 'PRESS_RELEASE.md', 'SALES_STRATEGY.md']) {
    const r = await fetch(`${BASE}/listing/${page2}`);
    check(`archived ${page2} kept`, r.ok, r.status);
  }

  console.log('\n=== no placeholder text left behind ===');
  check('no "TODO" in the brand page', !/\bTODO\b/.test(html));
  check('no lorem ipsum', !/lorem ipsum/i.test(html));
  check('no unresolved template braces', !/\{\{[^}]+\}\}/.test(html));

  console.log('\n' + (fails === 0 ? 'all brand-site structure checks passed' : fails + ' FAILED'));
  process.exit(fails === 0 ? 0 : 1);
}

main().catch(e => { console.error(e.message); process.exit(1); });
