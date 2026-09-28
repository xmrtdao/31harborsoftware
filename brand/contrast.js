/* Contrast pairs for the Jobby brand site, measured in a real engine.
 *
 * The nav CTA once rendered grey-on-green (~2:1) because `.nav-links a`
 * outranked `.btn` on specificity. That was invisible in the HTML and only
 * showed up in a screenshot, so the pairs that carry meaning are asserted.
 *
 * Paste-free usage: this file is loaded by the browser as part of the check
 * harness below. Thresholds follow WCAG AA: 4.5:1 for body text, 3:1 for
 * large text (>=24px, or >=18.66px bold).
 */
window.JOBBY_CONTRAST_PAIRS = [
  { sel: '.nav-links .btn', min: 4.5, name: 'nav CTA' },
  { sel: '.nav-links a:not(.btn)', min: 4.5, name: 'nav link' },
  { sel: 'body', min: 4.5, name: 'body text' },
  { sel: 'h1', min: 3.0, name: 'h1' },
  { sel: 'h1 em', min: 3.0, name: 'h1 accent' },
  { sel: 'h2', min: 3.0, name: 'h2' },
  { sel: 'h3', min: 4.5, name: 'h3' },
  { sel: '.lede', min: 4.5, name: 'lede' },
  { sel: '.muted', min: 4.5, name: 'muted note' },
  { sel: '.eyebrow', min: 4.5, name: 'eyebrow' },
  { sel: '.chip', min: 4.5, name: 'status chip' },
  { sel: '.chip b', min: 4.5, name: 'chip value' },
  { sel: '.line .who', min: 4.5, name: 'console role label' },
  { sel: '.line .msg', min: 4.5, name: 'console message' },
  { sel: '.console-bar', min: 4.5, name: 'console chrome' },
  { sel: '.product p', min: 4.5, name: 'product body' },
  { sel: '.product-id', min: 4.5, name: 'product id' },
  { sel: '.feature-list li', min: 4.5, name: 'feature bullet' },
  { sel: '.badge-live', min: 4.5, name: 'live badge' },
  { sel: '.badge-next', min: 4.5, name: 'not-ready badge' },
  { sel: '.rm-when', min: 4.5, name: 'roadmap when' },
  { sel: '.rm-what', min: 4.5, name: 'roadmap what' },
  { sel: '.rm-row.shipping .rm-state', min: 4.5, name: 'roadmap live state' },
  { sel: '.rm-row.building .rm-state', min: 4.5, name: 'roadmap building state' },
  { sel: '.rm-row.planned .rm-state', min: 4.5, name: 'roadmap planned state' },
  { sel: '.principle p', min: 4.5, name: 'principle body' },
  { sel: '.principle h3 code', min: 4.5, name: 'principle number' },
  { sel: '.fact dt', min: 4.5, name: 'fact label' },
  { sel: '.fact dd', min: 4.5, name: 'fact value' },
  { sel: '.btn', min: 4.5, name: 'primary button' },
  { sel: '.btn-ghost', min: 4.5, name: 'secondary button' },
  { sel: 'footer', min: 4.5, name: 'footer' },
  { sel: '.foot-links a', min: 4.5, name: 'footer link' },
  { sel: '.brand-name small', min: 4.5, name: 'brand tagline' },
];

window.JOBBY_MEASURE_CONTRAST = function measureContrast() {
  const parse = (s) => {
    const m = String(s).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    return m[1].split(',').map((x) => parseFloat(x.trim()));
  };
  const lin = (c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

  // Walk up for the first opaque background: a card sits on the page tint, and
  // comparing text against the wrong layer is how false passes happen.
  // The fallback is the body, not white — this site is dark, so a hardcoded
  // white fallback would report every light-on-dark pair as a failure.
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && (c.length < 4 || c[3] > 0.85)) return c.slice(0, 3);
      n = n.parentElement;
    }
    const bodyBg = parse(getComputedStyle(document.body).backgroundColor);
    if (bodyBg && (bodyBg.length < 4 || bodyBg[3] > 0.85)) return bodyBg.slice(0, 3);
    return [0, 0, 0];
  };

  const results = [];
  for (const pair of window.JOBBY_CONTRAST_PAIRS) {
    const el = document.querySelector(pair.sel);
    if (!el) { results.push({ ...pair, ratio: null, error: 'selector not found' }); continue; }
    const fgRaw = parse(getComputedStyle(el).color);
    if (!fgRaw) { results.push({ ...pair, ratio: null, error: 'no colour' }); continue; }
    const bg = bgOf(el);
    const alpha = fgRaw.length > 3 ? fgRaw[3] : 1;
    const fg = fgRaw.slice(0, 3).map((c, i) => c * alpha + bg[i] * (1 - alpha));
    const l1 = lum(fg);
    const l2 = lum(bg);
    const hi = Math.max(l1, l2);
    const lo = Math.min(l1, l2);
    results.push({
      ...pair,
      ratio: Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100,
      color: getComputedStyle(el).color,
      bg: `rgb(${bg.join(',')})`,
    });
  }
  return results;
};
