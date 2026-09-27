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
  { sel: 'body', min: 4.5, name: 'body text' },
  { sel: 'h1', min: 3.0, name: 'h1' },
  { sel: 'h2', min: 3.0, name: 'h2' },
  { sel: '.lede', min: 4.5, name: 'lede' },
  { sel: '.muted', min: 4.5, name: 'muted note' },
  { sel: '.eyebrow', min: 4.5, name: 'eyebrow' },
  { sel: '.step p', min: 4.5, name: 'step body' },
  { sel: '.track p', min: 4.5, name: 'track body' },
  { sel: '.track-when', min: 4.5, name: 'track caption' },
  { sel: '.rule-col li', min: 4.5, name: 'rule list item' },
  { sel: '.rule-col h3', min: 3.0, name: 'rule heading' },
  { sel: '.agent-name', min: 4.5, name: 'agent name' },
  { sel: '.agent-role', min: 4.5, name: 'agent role' },
  { sel: '.agent-line span:first-child', min: 4.5, name: 'agent card label' },
  { sel: '.agent-line b', min: 4.5, name: 'agent card value' },
  { sel: '.tag', min: 4.5, name: 'status tag' },
  { sel: '.stamp', min: 4.5, name: 'status stamp' },
  { sel: '.stat span', min: 4.5, name: 'stat caption' },
  { sel: 'summary', min: 4.5, name: 'FAQ question' },
  { sel: 'details p', min: 4.5, name: 'FAQ answer' },
  { sel: 'footer', min: 4.5, name: 'footer' },
  { sel: '.btn-ghost', min: 4.5, name: 'secondary button' },
  { sel: '.btn', min: 4.5, name: 'primary button' },
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
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && (c.length < 4 || c[3] > 0.85)) return c.slice(0, 3);
      n = n.parentElement;
    }
    return [255, 255, 255];
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
