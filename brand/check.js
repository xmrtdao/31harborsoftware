/* Structure and asset-integrity check for the 31 Harbor company site.
 *
 *   npx serve@14 -l 8899 --no-clipboard .
 *   node brand/check.js
 *
 * Catches the three failure modes that only show up after a deploy: an asset
 * reference that 404s in production, the archived property listing losing a file
 * when the company page replaced the site root, and the site overstating what
 * actually ships.
 *
 * The honesty checks are the point. A company site that claims a product is
 * live when it is not is worse than no site, so "live" and "not ready" are
 * asserted against the page rather than trusted.
 *
 * Colour contrast is measured separately in a real browser engine — see
 * brand/contrast.js, which runs the same pairs through Chromium.
 */
const BASE = process.env.SITE_URL || 'http://127.0.0.1:8899';

// The product URL lives here and nowhere else, so the domain move is a
// single-line change in two files (this and index.html).
//
// INTENDED: https://jobby.31harbor.com — the app is to move off the mobilemonero
// host onto the company's own domain. That needs a DNS record for
// jobby.31harbor.com pointing at the tunnel, which cannot be created from this
// machine: the Cloudflare token on disk is truncated to 32 characters (Cloudflare
// tokens are 40) and the local cloudflared cert belongs to a different account
// than the running tunnel. Until that record exists the host does not resolve,
// so the site links to the host that does.
const APP = 'https://jobby.mobilemonero.com';

let fails = 0;
const check = (label, cond, detail) => {
  if (cond) { console.log('  PASS  ' + label); return; }
  fails++;
  console.log('  FAIL  ' + label + (detail !== undefined ? `  -> ${JSON.stringify(detail)}` : ''));
};

async function main() {
  console.log('=== company page ===');
  const page = await fetch(BASE + '/');
  const html = page.ok ? await page.text() : '';
  check('root serves 200', page.ok, page.status);
  check('root is the 31 Harbor company page',
    /31 Harbor/.test(html) && !/Amagansett/.test(html));
  check('has a title', /<title>[^<]+<\/title>/.test(html));
  check('has a meta description', /name="description" content="[^"]{40,}"/.test(html));
  check('has Open Graph tags', /property="og:title"/.test(html));
  check('links to the working product', html.includes(APP));
  check('links to the archived listing', /href="\/listing\/"/.test(html));
  // The company must never advertise a product URL that does not resolve. This
  // is the single most damaging thing a company site can do, and it is exactly
  // what a half-finished domain move produces.
  const live = await fetch(APP, { method: 'GET', redirect: 'follow' });
  check(`every product link resolves (${APP})`, live.ok, `${live.status} ${live.statusText}`);

  console.log('\n=== the site does not overstate what ships ===');
  // Every product marked Live must have a working link, and the roadmap must
  // carry at least one honest "not ready" state.
  const liveCards = [...html.matchAll(/<article class="product is-live">([\s\S]*?)<\/article>/g)];
  check('exactly one product is marked live', liveCards.length === 1, liveCards.length);
  check('the live product links to the app',
    liveCards.length === 1 && liveCards[0][1].includes(APP));
  check('the live product carries a Live badge',
    liveCards.length === 1 && /badge-live">Live</.test(liveCards[0][1]));
  check('the unbuilt product is labelled not ready',
    /badge-next">Not ready</.test(html));
  check('roadmap marks in-progress work as building, not live',
    (html.match(/badge-next/g) || []).length >= 1 &&
    !/class="badge badge-live">Live<\/span>[\s\S]{0,400}?Not ready<\/i>/.test(html));
  check('no unbuilt product claims to be live',
    (html.match(/badge-live">Live</g) || []).length === liveCards.length);
  check('no fake customer counts or user numbers',
    !/\b[\d,.]+\+?\s*(users|customers|companies|hires|placements)\b/i.test(html));
  check('no invented testimonials', !/testimonial|—\s*[\w.]+@|"\s*[-—]\s*[^<]{6,},"/.test(html));
  // Assert the absence of an actual capture mechanism, not of the word. Copy
  // that *denies* having a waitlist still contains the word, so matching the
  // bare string produced a false positive.
  check('no email capture on the company page', !/type="email"/.test(html));
  check('no early-access / subscribe CTA',
    !/(early[\s-]?access|join the list|subscribe|sign up to be notified)/i.test(html));
  check('no pre-order or "coming soon" claim',
    !/(coming soon|pre-?order|reserve your|enroll now)/i.test(html));
  check('no stale mobilemonero product link',
    html.includes(APP) && !/https:\/\/jobby\.mobilemonero\.com/.test(html.replaceAll(APP, '')));
  check('no dead product link left behind',
    !/jobby\.31harbor\.com/.test(html),
    'jobby.31harbor.com does not resolve yet — do not link it until the DNS record exists');

  console.log('\n=== brand assets ===');
  for (const asset of ['/brand/style.css']) {
    const r = await fetch(BASE + asset);
    check(`${asset} serves`, r.ok, r.status);
  }
  // The company page ships no JavaScript. A script tag here would mean a
  // behaviour nobody can name, so its absence is asserted rather than assumed.
  // (Cloudflare Pages may inject its own analytics beacon; only first-party
  // script references are asserted against.)
  check('no first-party JavaScript on the company page',
    !/<script(?![^>]*cloudflareinsights)/i.test(html), html.match(/<script[^>]*>/g));

  console.log('\n=== assets are content-versioned ===');
  // This is the check whose absence let a broken deploy ship. GitHub Pages lets
  // Cloudflare rewrite `no-cache` to `max-age=14400`, so a visitor who loaded
  // the site before a redesign kept the old stylesheet for four hours and got
  // the new markup rendered with the old CSS. The CDN was serving correct bytes
  // the whole time — the browser never asked. A content-versioned URL makes that
  // impossible, so every local asset reference must carry ?v= and it must match
  // the file it points at.
  // Local asset references are relative (brand/style.css), not absolute, and
  // anything with a scheme, a protocol-relative prefix, or a fragment is not a
  // local file we control the cache key for.
  const localRefs = [...html.matchAll(
    /(?:href|src)="((?!https?:|\/\/|#|mailto:)[^"?#]+\.(?:css|js))(?:\?v=([0-9a-f]+))?"/g)];
  check('the page references at least one local stylesheet', localRefs.length > 0, localRefs.length);
  for (const [, rel, version] of localRefs) {
    const path = '/' + rel.replace(/^\//, '');
    if (!version) {
      check(`${rel} is versioned`, false, 'no ?v= — a stale cached copy could be reused');
      continue;
    }
    // Fetch the versioned URL and the bare URL; both must serve the same bytes.
    const [vRes, bareRes] = await Promise.all([fetch(BASE + path + '?v=' + version), fetch(BASE + path)]);
    const [vBuf, bareBuf] = await Promise.all([vRes.arrayBuffer(), bareRes.arrayBuffer()]);
    check(`${rel}?v=${version} serves`, vRes.ok, vRes.status);
    const a = new Uint8Array(vBuf), b = new Uint8Array(bareBuf);
    const sameBytes = a.length === b.length && a.every((x, i) => x === b[i]);
    check(`${rel}?v=${version} matches the unversioned file`, sameBytes,
      sameBytes ? undefined : 'versioned and bare URLs differ — the edge is serving something stale');
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
  // The form posts from listing/js/main.js, not inline in the page, and targets
  // inbox.31harbor.com rather than the relay host.
  const listingJs = await (await fetch(BASE + '/listing/js/main.js')).text();
  check('listing contact form still posts to the relay',
    /https:\/\/(inbox\.31harbor\.com|relay\.mobilemonero\.com)\/api\/contact\/31harbor/.test(listingJs));
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

  console.log('\n=== encoding ===');
  // index.html was shipped once with every em dash turned into 'â€"' because a
  // PowerShell pass decoded a BOM-less UTF-8 file as Windows-1252. The page
  // still returned 200, so only a screenshot caught it. The company page is now
  // pure ASCII by policy (punctuation as HTML entities), which makes that whole
  // class of corruption impossible — these assertions keep it that way.
  const htmlBytes = new Uint8Array(await (await fetch(BASE + '/')).arrayBuffer());
  const nonAscii = [...htmlBytes].filter(b => b > 127);
  check('company page is pure ASCII on the wire', nonAscii.length === 0,
    nonAscii.length ? `${nonAscii.length} non-ASCII bytes` : undefined);
  check('declares UTF-8', /<meta charset="UTF-8">/i.test(html));
  // The specific mojibake signatures, in case the policy is ever relaxed.
  check('no CP1252 mojibake sequences',
    !/â€|Ã©|Ã¡|Â·|ï¿½|â€™|â€œ/.test(html),
    html.match(/.{0,20}(â€|Ã©|Ã¡|Â·|ï¿½).{0,20}/)?.[0]);
  check('em dashes are entities, not raw bytes', /&mdash;/.test(html));

  console.log('\n=== no placeholder text left behind ===');
  check('no "TODO" in the brand page', !/\bTODO\b/.test(html));
  check('no lorem ipsum', !/lorem ipsum/i.test(html));
  check('no unresolved template braces', !/\{\{[^}]+\}\}/.test(html));

  console.log('\n' + (fails === 0 ? 'all brand-site structure checks passed' : fails + ' FAILED'));
  process.exit(fails === 0 ? 0 : 1);
}

main().catch(e => { console.error(e.message); process.exit(1); });
