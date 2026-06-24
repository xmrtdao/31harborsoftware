#!/usr/bin/env node
/**
 * 31harbor-press-release-sender.mjs — Press release distribution sender
 * Sends the 31 Harbor Road press release to a curated press/media list.
 * Runs in parallel with the daily template campaign (31harbor-daily-sender.mjs).
 *
 * Usage: node relay/tools/31harbor-press-release-sender.mjs [count=50]
 *
 * Reads from relay-data/31harbor-press-release-list.json
 * Sends via Resend from david@31harbor.com
 * Has its own lock, sent tracking, and suppression files.
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..', '..');

// Load .env for the Resend key
const envPath = path.join(__dirname, '..', '.env');
const env = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
  const [k, ...v] = line.split('=');
  if (k) acc[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
  return acc;
}, {});

const RESEND_KEY = env.RESEND_31HARBOR_API_KEY || 're_VmTXTY9N_AyjCXtoRkWPZ5h715bDk2Muu';
const FROM_ADDRESS = 'David Elze <david@31harbor.com>';

const DATA_DIR = path.join(PROJECT_ROOT, 'relay-data');
const LIST_FILE = path.join(DATA_DIR, '31harbor-press-release-list.json');
const SENT_FILE = path.join(DATA_DIR, '31harbor-press-release-sent.json');
const SUPPRESSION_FILE = path.join(DATA_DIR, '31harbor-press-release-suppression.json');
const LOG_FILE = path.join(DATA_DIR, '31harbor-campaign.log');
const LOCK_FILE = path.join(DATA_DIR, '31harbor-press-release.lock');

function log(msg) {
  const entry = `[${new Date().toISOString()}] [PRESS-RELEASE] ${msg}\n`;
  process.stdout.write(entry);
  try { fs.appendFileSync(LOG_FILE, entry); } catch {}
}

function loadSuppression() {
  try {
    if (fs.existsSync(SUPPRESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SUPPRESSION_FILE, 'utf8'));
      return new Set(data.suppressed || []);
    }
  } catch {}
  return new Set();
}

function acquireLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const lockAge = Date.now() - fs.statSync(LOCK_FILE).mtimeMs;
      if (lockAge < 3600000) {
        log(`Press release sender already running (age: ${Math.round(lockAge/1000)}s) — exiting`);
        return false;
      }
      fs.unlinkSync(LOCK_FILE);
    }
    fs.writeFileSync(LOCK_FILE, String(Date.now()));
    return true;
  } catch { return false; }
}

function releaseLock() {
  try { if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE); } catch {}
}

if (!acquireLock()) process.exit(0);
process.on('exit', releaseLock);
process.on('SIGINT', () => { releaseLock(); process.exit(1); });
process.on('uncaughtException', () => { releaseLock(); process.exit(1); });

// Load press release distribution list
let contacts = [];
try { contacts = JSON.parse(fs.readFileSync(LIST_FILE, 'utf8')); } catch {
  log('No press release list found. Run build-press-release-list first.');
  process.exit(0);
}

let sentHistory = [];
try { sentHistory = JSON.parse(fs.readFileSync(SENT_FILE, 'utf8')); } catch { sentHistory = []; }

// Filter: not sent in last 30 days, not suppressed
const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
const recentSent = new Set(sentHistory.filter(s => s.ts > cutoff).map(s => s.email));
const suppressed = loadSuppression();

let available = contacts.filter(c =>
  !recentSent.has(c.email) &&
  c.email.includes('@') &&
  !suppressed.has(c.email)
);

if (available.length === 0) {
  log('No fresh press release contacts available.');
  releaseLock();
  process.exit(0);
}

const count = parseInt(process.argv[2]) || 50;
const sorted = [...available].sort((a, b) => (a.sentCount || 0) - (b.sentCount || 0));
const batch = sorted.slice(0, count);

log(`Press release list: ${contacts.length}, Available: ${available.length}, Sending: ${batch.length}`);

// ── Press Release HTML ──────────────────────────────────
const GH = 'https://raw.githubusercontent.com/xmrtdao/sea-hampton-house/main/assets';

function buildPressReleaseHtml() {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#e8e4de;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#e8e4de;padding:30px 10px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:4px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.08);">

<!-- Preheader -->
<tr><td style="background:#0f1a2e;padding:10px 40px;text-align:center;border-bottom:1px solid #1f2a3e;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td align="left" style="font-size:11px;color:#8a9baa;letter-spacing:1px;">FOR IMMEDIATE RELEASE</td>
<td align="right" style="font-size:11px;color:#8a9baa;letter-spacing:1px;">June 24, 2026</td>
</tr>
</table>
</td></tr>

<!-- Headline -->
<tr><td style="padding:36px 40px 20px;text-align:center;background:#ffffff;">
<p style="font-size:11px;color:#8a7a5a;letter-spacing:3px;text-transform:uppercase;margin:0 0 10px 0;font-weight:600;">Press Release</p>
<h1 style="font-size:24px;font-weight:700;color:#0f1a2e;margin:0 0 12px 0;line-height:1.3;font-family:Georgia,serif;">First Public Offering in Napeague Camping Club History:<br>Rare Waterfront Cottage Hits the Market at $750,000</h1>
<p style="font-size:13px;color:#6a7a8a;margin:0;font-style:italic;">31 Harbor Road, Amagansett, NY — A historic opportunity in one of the Hamptons' last authentic communities</p>
</td></tr>

<!-- Hero Image -->
<tr><td style="padding:0;line-height:0;">
<img src="${GH}/images/area%20overview.jpg" width="600" style="display:block;width:100%;max-width:600px;height:auto;" alt="Aerial view of Napeague Camping Club and 31 Harbor Road"/>
</td></tr>

<!-- Body -->
<tr><td style="padding:36px 40px 20px;">

<p style="font-size:14px;color:#1a2a3a;line-height:1.7;margin:0 0 16px 0;"><strong>AMAGANSETT, NY</strong> — For what is believed to be the first time in the history of the Napeague Camping Club, a residence within this private, waterfront community is being offered to the public market. 31 Harbor Road, a three-bedroom, two-bathroom cottage with direct access to Gardiners Bay, is listed at <strong>$750,000</strong>.</p>

<p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 16px 0;">The Napeague Camping Club traces its roots to a 1949 campground — a tent-and-trailer site that evolved into an incorporated not-for-profit community in 1964. For generations, this narrow strip of land between the Atlantic Ocean and Gardiners Bay has been home to baymen, fishermen, and seasonal cottagers. With a year-round population of only a few hundred people, Napeague remains one of the least populated and most authentic parts of the Hamptons.</p>

<p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 16px 0;">"This is not merely a property transaction," said David Elze, the owner of 31 Harbor Road. "It is an introduction to a way of life that has all but disappeared from the rest of the Hamptons. The Napeague Camping Club represents a piece of Old Hamptons — a community rooted in maritime culture, fishing traditions, and coastal history."</p>

<!-- Property Photo -->
<img src="${GH}/images/exterior/07.jpg" width="600" style="display:block;width:100%;max-width:600px;height:auto;border-radius:2px;margin:16px 0 24px;" alt="Wood deck overlooking the property"/>

<h2 style="font-size:18px;color:#0f1a2e;margin:24px 0 12px 0;font-family:Georgia,serif;font-weight:600;">Property Highlights</h2>

<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
<tr><td width="20" valign="top" style="color:#c9a84c;padding:0 6px 6px 0;font-size:14px;">+</td>
<td style="font-size:13px;color:#444;padding:0 0 6px 0;line-height:1.5;"><strong>Location:</strong> 31 Harbor Road, Amagansett, NY 11930</td></tr>
<tr><td width="20" valign="top" style="color:#c9a84c;padding:0 6px 6px 0;font-size:14px;">+</td>
<td style="font-size:13px;color:#444;padding:0 0 6px 0;line-height:1.5;"><strong>Price:</strong> $750,000</td></tr>
<tr><td width="20" valign="top" style="color:#c9a84c;padding:0 6px 6px 0;font-size:14px;">+</td>
<td style="font-size:13px;color:#444;padding:0 0 6px 0;line-height:1.5;"><strong>Bedrooms:</strong> 3 | <strong>Bathrooms:</strong> 2 | <strong>Square Footage:</strong> ~960 sq ft</td></tr>
<tr><td width="20" valign="top" style="color:#c9a84c;padding:0 6px 6px 0;font-size:14px;">+</td>
<td style="font-size:13px;color:#444;padding:0 0 6px 0;line-height:1.5;"><strong>Waterfront:</strong> Direct access to Gardiners Bay — private beach steps from the cottage</td></tr>
<tr><td width="20" valign="top" style="color:#c9a84c;padding:0 6px 6px 0;font-size:14px;">+</td>
<td style="font-size:13px;color:#444;padding:0 0 6px 0;line-height:1.5;"><strong>Year-Round:</strong> Open year-round — a full-time residence, not a seasonal rental</td></tr>
<tr><td width="20" valign="top" style="color:#c9a84c;padding:0 6px 6px 0;font-size:14px;">+</td>
<td style="font-size:13px;color:#444;padding:0 0 6px 0;line-height:1.5;"><strong>Community Fee:</strong> $175/month</td></tr>
<tr><td width="20" valign="top" style="color:#c9a84c;padding:0 6px 6px 0;font-size:14px;">+</td>
<td style="font-size:13px;color:#444;padding:0 0 6px 0;line-height:1.5;"><strong>Listing Brokerage:</strong> Douglas Elliman</td></tr>
</table>

<!-- Waterfront Photo -->
<img src="${GH}/images/waterfront/11.jpg" width="600" style="display:block;width:100%;max-width:600px;height:auto;border-radius:2px;margin:16px 0 24px;" alt="Sandy beach on Gardiners Bay"/>

<h2 style="font-size:18px;color:#0f1a2e;margin:24px 0 12px 0;font-family:Georgia,serif;font-weight:600;">Market Context</h2>

<p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 16px 0;">The Hamptons real estate market has seen median single-family home prices exceed $3 million in 2025, with waterfront properties routinely commanding premiums of 50-100% or more. At $750,000, 31 Harbor Road represents a rare entry point into a market that has become increasingly inaccessible to all but the wealthiest buyers.</p>

<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse;">
<tr><td style="padding:8px 12px;background:#f6f4f0;border-bottom:1px solid #ddd;font-size:12px;color:#0f1a2e;font-weight:600;">Comparable</td>
<td style="padding:8px 12px;background:#f6f4f0;border-bottom:1px solid #ddd;font-size:12px;color:#0f1a2e;font-weight:600;">Location</td>
<td style="padding:8px 12px;background:#f6f4f0;border-bottom:1px solid #ddd;font-size:12px;color:#0f1a2e;font-weight:600;">Price</td>
<td style="padding:8px 12px;background:#f6f4f0;border-bottom:1px solid #ddd;font-size:12px;color:#0f1a2e;font-weight:600;">$/Sq Ft</td></tr>
<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;">31 Harbor Road</td>
<td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;">Amagansett</td>
<td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;">$750,000</td>
<td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;">$781</td></tr>
<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;">Typical Hamptons Waterfront</td>
<td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;">Various</td>
<td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;">$3M-$10M+</td>
<td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;">$2,000+</td></tr>
<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;">Napeague Cottage (est.)</td>
<td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;">Napeague</td>
<td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;">$600K-$900K</td>
<td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;">$600-$950</td></tr>
</table>

<h2 style="font-size:18px;color:#0f1a2e;margin:24px 0 12px 0;font-family:Georgia,serif;font-weight:600;">Target Buyer Profiles</h2>

<p style="font-size:13px;color:#444;line-height:1.6;margin:0 0 6px 0;"><strong>The Coastal Lifestyle Buyer</strong> — Cash buyer, age 40-70, who values experiences over square footage and seeks an authentic Hamptons foothold.</p>
<p style="font-size:13px;color:#444;line-height:1.6;margin:0 0 6px 0;"><strong>The Hamptons Access Buyer</strong> — Wants a presence in the Hamptons without the $3M-$10M price tag, comfortable with alternative ownership structures.</p>
<p style="font-size:13px;color:#444;line-height:1.6;margin:0 0 6px 0;"><strong>The Collector</strong> — Recognizes this as a historically significant asset. The first of its kind. A story that cannot be replicated.</p>
<p style="font-size:13px;color:#444;line-height:1.6;margin:0 0 20px 0;"><strong>The Entrepreneur</strong> — Comfortable with complexity, sees value where others do not. This transaction may establish the benchmark for every future Napeague Camping Club sale.</p>

<!-- CTA -->
<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#0f1a2e;border-radius:2px;padding:32px 36px;text-align:center;">
<tr><td>
<h2 style="font-size:18px;color:#ffffff;margin:0 0 8px 0;font-family:Georgia,serif;font-weight:400;">About the Listing</h2>
<p style="font-size:13px;color:#8a9baa;line-height:1.6;margin:0 0 20px 0;">31 Harbor Road is listed exclusively by Douglas Elliman. For press inquiries, private showings, or to receive the full information package:</p>
<a href="https://31harbor.com" style="display:inline-block;background:#c9a84c;color:#0f1a2e;padding:14px 40px;border-radius:2px;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:0.5px;">View Full Listing &rarr;</a>
</td></tr>
</table>

</td></tr>

<!-- Footer -->
<tr><td style="background:#0f1a2e;padding:32px 40px;text-align:center;border-top:1px solid #1f2a3e;">
<p style="color:#c9a84c;font-size:16px;font-weight:700;margin:0 0 2px 0;font-family:Georgia,serif;">David Elze</p>
<p style="color:#8a9baa;font-size:12px;margin:0 0 2px 0;">Owner &middot; 31 Harbor Road</p>
<p style="color:#8a9baa;font-size:12px;margin:0 0 2px 0;">david@31harbor.com &middot; (631) 997-8503</p>
<p style="color:#6a7a8a;font-size:11px;margin:12px 0 0 0;">Listed by Douglas Elliman</p>
<p style="color:#5a6a7a;font-size:10px;margin:12px 0 0 0;">&copy; 2026 David Elze. All rights reserved.<br>Equal Housing Opportunity.</p>
</td></tr>

</table>
</td></tr></table>
</body>
</html>`;
}

function buildTextBody() {
  return `FOR IMMEDIATE RELEASE — June 24, 2026

FIRST PUBLIC OFFERING IN NAPEAGUE CAMPING CLUB HISTORY:
RARE WATERFRONT COTTAGE HITS THE MARKET AT $750,000

31 Harbor Road, Amagansett, NY — A historic opportunity in one of the Hamptons' last authentic communities.

AMAGANSETT, NY — For what is believed to be the first time in the history of the Napeague Camping Club, a residence within this private, waterfront community is being offered to the public market. 31 Harbor Road, a three-bedroom, two-bathroom cottage with direct access to Gardiners Bay, is listed at $750,000.

The Napeague Camping Club traces its roots to a 1949 campground — a tent-and-trailer site that evolved into an incorporated not-for-profit community in 1964. For generations, this narrow strip of land between the Atlantic Ocean and Gardiners Bay has been home to baymen, fishermen, and seasonal cottagers.

Property Highlights:
- Location: 31 Harbor Road, Amagansett, NY 11930
- Price: $750,000
- 3 Bedrooms, 2 Bathrooms, ~960 sq ft
- Direct waterfront access to Gardiners Bay
- Open year-round — full-time residence
- Community fee: $175/month
- Listed by Douglas Elliman

Market Context: The Hamptons real estate market has seen median single-family home prices exceed $3 million in 2025. At $750,000, 31 Harbor Road represents a rare entry point into a market that has become increasingly inaccessible.

Contact:
David Elze
david@31harbor.com
(631) 997-8503
https://31harbor.com

# # #`;
}

const htmlBody = buildPressReleaseHtml();
const textBody = buildTextBody();

let sent = 0, errors = 0;

function appendSent(email) {
  sentHistory.push({ email, ts: Date.now() });
  fs.writeFileSync(SENT_FILE, JSON.stringify(sentHistory, null, 2));
}

function sendNext() {
  if (sent + errors >= count || batch.length === 0) {
    const summary = `Press Release Campaign: ${sent} sent, ${errors} errors`;
    log(summary);
    releaseLock();
    return;
  }

  const entry = batch.shift();

  // Defense-in-depth: check not already sent this session
  const recentCheck = new Set(sentHistory.filter(s => s.ts > Date.now() - 30*24*60*60*1000).map(s => s.email));
  if (recentCheck.has(entry.email)) {
    sent++;
    setTimeout(sendNext, 10);
    return;
  }

  const postData = JSON.stringify({
    from: FROM_ADDRESS,
    to: entry.email,
    subject: 'Press Release: First Public Offering in Napeague Camping Club History — 31 Harbor Road, Amagansett',
    html: htmlBody,
    text: textBody,
  });

  const req = https.request({
    host: 'api.resend.com',
    path: '/emails',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  }, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      if (res.statusCode === 200 || res.statusCode === 201) {
        sent++;
        appendSent(entry.email);
        log(`  [${sent}/${count}] Sent press release to ${entry.email}`);
      } else if (res.statusCode === 429) {
        batch.unshift(entry);
        log(`  [RATE] ${entry.email}: HTTP 429, re-queued (batch ${batch.length})`);
        setTimeout(sendNext, 2000);
        return;
      } else {
        errors++;
        log(`  [ERR] ${entry.email}: HTTP ${res.statusCode} ${data.slice(0, 200)}`);
      }
      setTimeout(sendNext, 300);
    });
  });

  req.on('error', (err) => {
    errors++;
    log(`  [ERR] ${entry.email}: ${err.message}`);
    setTimeout(sendNext, 300);
  });

  req.write(postData);
  req.end();
}

sendNext();
