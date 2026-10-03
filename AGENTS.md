# AGENTS.md — working in this repository

## What this repository is

Two things, and confusing them is the main risk here:

1. **`index.html` + `brand/` + `assets/team/` + `og/`** — the **31harbor.com company
   site**. Live, this is the company's public face.
2. **`listing/`** — an **archived, inactive** real-estate listing for a property
   at 31 Harbor Road, Amagansett NY. Distribution was halted in July 2026 by
   directive. It is retained for reference only.

**The software company is what the domain is now for.** The listing history is
kept below the fold and in the README, never removed, and never promoted.

---

## Standing rule: do not promote the listing

> ALL DISTRIBUTION HALTED per David Elze directive.
> The property is a **Douglas Elliman exclusive** (MLS #422823, Julie Gauger).
> Key corrections: "Waterfront" → **Bay View + Association Beach Rights**.
> "First public offering" hook RETIRED. House built 2018.

- Do not add marketing copy, CTAs, share buttons or SEO to `/listing/`.
- `robots.txt` disallows `/listing/`. Leave that in place.
- It is not in `sitemap.xml`. Leave it that way.
- If asked to "improve the listing", confirm the instruction supersedes the
  halt before touching it.

---

## The company

- **Partners:** Joe Lee, Cory Gray
- **Address:** Calle 442, La Fortuna, Costa Rica 21007
- **Products:** Jobby (job agent), GrayTech Security (face recognition), Suite
  (agent operations)
- **Stack:** Node, Postgres, Python, local-first inference. No cloud dependency
  for the core.

Source for GrayTech lives in its own repo: `github.com/xmrtdao/graytech`.

---

## Working on the site

**It is static.** Plain HTML with one stylesheet. No build step, no bundler, no
framework. Do not introduce one to make a change easier — the deployment is
GitHub Pages reading these files directly, and a build step means the repo and
the served site can disagree.

**The stylesheet is cache-busted by hash in the HTML:**

```html
<link rel="stylesheet" href="brand/style.css?v=3f9c2a71e5">
```

**Bump that hash whenever `brand/style.css` changes.** Without it the edit
reaches nobody — GitHub Pages serves the old file until the query changes. This
is the same failure mode as Cloudflare edge-caching a script on the relay
dashboard, and it has bitten twice.

---

## House style

- Sentence case in headings. No exclamation marks. No "revolutionary",
  "game-changing", "seamless", "cutting-edge".
- **Never overstate what ships.** The page says a thing is live when it is live,
  and "not ready" when it is not. A page that overstates how little it has is the
  same failure as one that overstates how much.
- Lead with what a thing *does*, then give the specifics that make the claim
  checkable. A technical buyer asks three questions; answering them in the copy
  is cheaper than being asked.
- Third person, present tense. "Jobby sends from your own address", not "we send".

### Never invent

The site's own principle, and it binds this repository too:

- A gap is recorded as a gap. An unstated field stays unstated.
- **Never invent an accuracy figure.** State the set it was measured on. "97% on
  2,562 studio portraits" is defensible; "97% accurate" is not.
- Never invent a partner's bio, title, or background. Joe and Cory are named
  partners; if a role or credential is not stated, it is not there.
- **Do not add testimonials, logos, client names, or funding claims.** None
  exist, and inventing any of them is the fastest way to lose a technical buyer.

---

## Social and SEO

If you change the brand, headline or positioning, update all of these together —
they drift apart otherwise:

- `<title>`, `meta[name=description]`, `meta[name=keywords]`
- `og:title`, `og:description`, `og:image`, `og:url`, `og:site_name`
- `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`
- `og/31harbor-og.png` (1200×630, PNG)
- `README.md` headline and the products table

**Absolute URLs only in OG/Twitter tags.** Relative paths resolve against the
scraper's own base, not ours, and produce a broken card.

`og:image` must be a real file at a real public URL. Verify it returns 200 and
`image/png` — a card with a broken image is worse than no card, because the
platform falls back to a screenshot of a blank page.

---

## Partner photos

`assets/team/*.webp` and `*.jpg` are square crops (512×512) taken from the Faces
dataset using the face detector to locate the subject — **not** a manual centre
crop, which reliably decapitates head-and-shoulders photos.

- If a photo is replaced, regenerate both formats. WebP for `<img>`, JPEG for
  compatibility.
- `alt` text names the person and their role. It is read aloud by screen
  readers; "photo of a man" is not an acceptable substitute.
- Do not crop tighter than the current framing. Joe's is already close.

---

## Things that will bite you

- **`listing/` duplicates the root files.** `listing/index.html`, `listing/css/`,
  `listing/js/` and `listing/data/` are copies. Changing the company site does
  **not** change the listing, and that is correct — they are different sites.
- **`data/31harbor-contacts.json` is 354 KB** of press contacts. Do not inline or
  minify it; nothing on the company site reads it.
- **Jekyll is not enabled.** There is no `_config.yml`, so GitHub Pages serves
  these files as-is. A `_layouts/` or `Gemfile` appearing without discussion
  means a build step just got introduced.
- **Mojibake in the old listing README.** The archived copy contains `â€"`-style
  encoding damage from an earlier save. It is archival; leave it rather than
  half-fixing it.

---

## Before committing

- `git status` — `listing/` changes mean you touched the archived site
- The `?v=` hash matches `brand/style.css`
- No credential, key or token appears anywhere. `relay/.env` is a different repo
  and is gitignored; nothing from it belongs here.
- The listing's distribution-halt notice is still present and intact.