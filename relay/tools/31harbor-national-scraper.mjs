#!/usr/bin/env node
/**
 * 31harbor-national-scraper.mjs
 * Collects real estate agent/broker emails across US and Canada.
 * Phase 2 uses direct Startpage.com HTML search (free, no captcha, no API key).
 *
 * Writes to relay-data/31harbor-contacts.json (separate pool).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchUrl, startpageSearch } from './search-provider.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'relay-data');
const CONTACTS_FILE = path.join(DATA_DIR, '31harbor-contacts.json');
const LOG_FILE = path.join(DATA_DIR, '31harbor-campaign.log');

fs.mkdirSync(DATA_DIR, { recursive: true });

const TARGET = parseInt(process.argv.find(a => a.startsWith('--target='))?.split('=')[1]) || 9000;
const CONCURRENCY = 10;

let totalFound = 0, totalErrors = 0, lastSaveCount = 0;

const BLOCKED_DOMAINS = new Set([
  // Consumer email providers
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'protonmail.com', 'proton.me', 'zoho.com', 'yandex.com',
  'mail.com', 'inbox.com', 'fastmail.com', 'tutanota.com',
  // Social / share platforms
  'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'tiktok.com',
  'linkedin.com', 'youtube.com', 'snapchat.com', 'pinterest.com',
  'reddit.com', 'tumblr.com', 'whatsapp.com', 'telegram.org',
  'discord.com', 'discord.gg', 'twitch.tv', 'medium.com',
  // Non-real-person domains
  'example.com', 'example.org', 'example.net',
  'noreply', 'donotreply', 'no-reply', 'mailer-daemon',
  'unsubscribe', 'newsletter', 'mailchimp', 'sendgrid',
  'hubspot', 'constantcontact', 'mailgun', 'sendinblue', 'brevo',
  // Government / military (not our target)
  '.gov', '.mil',
]);

const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp', 'tiff', 'tif',
  'avif', 'heic', 'heif', 'raw', 'psd', 'ai', 'eps',
]);

function isEmailAllowed(email) {
  const e = email.toLowerCase().trim();
  if (!e.includes('@')) return false;
  const [local, domain] = e.split('@');
  if (!domain || !domain.includes('.') || domain.length < 5) return false;

  // Block image filenames matched as emails (e.g. "logo@2x.png" where @2x is local part and png is TLD)
  const tld = domain.split('.').pop();
  if (IMAGE_EXTENSIONS.has(tld)) return false;

  // Exact match
  if (BLOCKED_DOMAINS.has(domain)) return false;
  // Suffix match for .gov / .mil
  for (const blocked of BLOCKED_DOMAINS) {
    if (blocked.startsWith('.') && domain.endsWith(blocked)) return false;
  }
  // Substring match for known auto-email domains
  for (const blocked of BLOCKED_DOMAINS) {
    if (domain.includes(blocked)) return false;
  }
  // Block auto-generated local-parts
  if (/^(noreply|donotreply|no-?reply|mailer-?daemon|unsubscribe|newsletter|admin|support|info|contact|webmaster|postmaster|abuse|spam)/i.test(local)) return false;
  // Block single-character local parts (likely form field labels like "e@domain.com", "n@domain.com")
  if (local.length <= 1) return false;
  // Block placeholder local parts
  if (/^(name|email|user|test|example|your|full|first|last)$/i.test(local)) return false;
  // Block suspicious multi-segment domains (likely spam traps)
  if ((domain.match(/\./g) || []).length >= 5) return false;
  return true;
}

function log(msg) {
  const entry = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(entry);
  try { fs.appendFileSync(LOG_FILE, entry); } catch {}
}

function extractEmails(text) {
  const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(regex) || [];
  return [...new Set(matches.filter(isEmailAllowed))];
}

// fetchUrl imported from search-provider.mjs

function loadExisting() {
  try { return JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf8')); } catch { return []; }
}

function saveContacts(contacts) {
  const unique = [];
  const seen = new Set();
  for (const c of contacts) {
    const key = c.email.toLowerCase().trim();
    if (!seen.has(key)) { seen.add(key); unique.push(c); }
  }
  fs.writeFileSync(CONTACTS_FILE, JSON.stringify(unique, null, 2));
  return unique;
}

function progressiveSave(newContacts) {
  const existing = loadExisting();
  const merged = [...existing, ...newContacts];
  const saved = saveContacts(merged);
  if (saved.length > lastSaveCount) {
    log(`  💾 Saved ${saved.length - lastSaveCount} new (pool: ${saved.length})`);
    lastSaveCount = saved.length;
  }
  return saved;
}

// ── Startpage.com search (free, no captcha, no API key) ───
async function searchScrape(query, region) {
  try {
    const urls = await startpageSearch(query);
    if (urls.length === 0) return [];
    const limit = Math.min(urls.length, 5);
    const emails = new Set();
    for (let i = 0; i < limit; i++) {
      try {
        const html = await fetchUrl(urls[i], 1);
        extractEmails(html).forEach(e => emails.add(e));
      } catch { /* skip failed page */ }
    }
    return [...emails].map(email => ({
      email: email.toLowerCase().trim(),
      source: `startpage: ${query}`,
      added: new Date().toISOString(),
      region,
      topics: 'real-estate-web-search',
      status: 'pending',
      sentCount: 0,
    }));
  } catch {
    return [];
  }
}

// ── Phase 1: High-yield real estate directory pages ──────────
const SOURCES = [
  // US — National Association of Realtors
  { url: 'https://www.nar.realtor/directories', region: 'US National' },
  { url: 'https://www.nar.realtor/find-a-realtor', region: 'US National' },

  // US — State real estate commissions (license lookup directories)
  { url: 'https://www.dre.ca.gov/', region: 'California' },
  { url: 'https://www.trec.texas.gov/', region: 'Texas' },
  { url: 'https://www.myfloridalicense.com/DBPR/', region: 'Florida' },
  { url: 'https://www.dos.ny.gov/licensing/realtors.html', region: 'New York' },

  // Large real estate firms — agent directories
  { url: 'https://www.compass.com/agents/', region: 'US National' },
  { url: 'https://www.coldwellbanker.com/real-estate-agents', region: 'US National' },
  { url: 'https://www.sothebysrealty.com/eng/associates', region: 'US National' },
  { url: 'https://www.remax.com/real-estate-agents', region: 'US National' },
  { url: 'https://www.kw.com/agent', region: 'US National' },
  { url: 'https://www.century21.com/real-estate-agents', region: 'US National' },
  { url: 'https://www.berkshirehathawayhs.com/agents', region: 'US National' },
  { url: 'https://www.weichert.com/agents/', region: 'US National' },

  // Canada — Major brokerages
  { url: 'https://www.royallepage.ca/en/real-estate-agents/', region: 'Canada National' },
  { url: 'https://www.realtor.ca/', region: 'Canada National' },
  { url: 'https://www.century21.ca/agents', region: 'Canada National' },
  { url: 'https://www.remax.ca/real-estate-agents', region: 'Canada National' },
  { url: 'https://www.rightathome.ca/agents', region: 'Canada National' },

  // Major metro Board of Realtors directories
  { url: 'https://www.nyrealtors.com/find-a-realtor', region: 'New York' },
  { url: 'https://www.larealtors.org/', region: 'Los Angeles California' },
  { url: 'https://www.chicagorealtors.com/', region: 'Chicago Illinois' },
  { url: 'https://www.miamirealtors.com/', region: 'Miami Florida' },
  { url: 'https://www.har.com/', region: 'Houston Texas' },
  { url: 'https://www.sdar.com/', region: 'San Diego California' },
  { url: 'https://www.philadelphiarealtors.com/', region: 'Philadelphia Pennsylvania' },
  { url: 'https://www.seattlerealtors.com/', region: 'Seattle Washington' },
  { url: 'https://www.bostonrealtors.org/', region: 'Boston Massachusetts' },
  { url: 'https://www.atlantarealtors.com/', region: 'Atlanta Georgia' },
  { url: 'https://www.dallasmckinneymls.com/', region: 'Dallas Texas' },
  { url: 'https://www.denverrealtors.com/', region: 'Denver Colorado' },
  { url: 'https://www.torontorealestateboard.com/', region: 'Toronto Ontario Canada' },
  { url: 'https://www.rebgv.ca/', region: 'Vancouver British Columbia Canada' },
  { url: 'https://www.greatermtl.com/', region: 'Montreal Quebec Canada' },
  { url: 'https://www.crea.ca/', region: 'Canada National' },
];

async function scrapeSource(src) {
  try {
    const html = await fetchUrl(src.url);
    const emails = extractEmails(html);
    return emails.map(email => ({
      email: email.toLowerCase().trim(),
      source: src.url,
      added: new Date().toISOString(),
      region: src.region,
      topics: 'real-estate-directory',
      status: 'pending',
      sentCount: 0,
    }));
  } catch {
    totalErrors++;
    return [];
  }
}

// ── Main ────────────────────────────────────────────────
async function main() {
  log(`╔══════════════════════════════════════════╗`);
  log(`║  🏠 31harbor National Scraper             ║`);
  log(`║  Target: ${TARGET} contacts (US + Canada)   ║`);
  log(`╚══════════════════════════════════════════╝`);

  const start = Date.now();
  const existing = loadExisting();
  log(`Pool starts at: ${existing.length} contacts\n`);
  let allNew = [];

  // Phase 1: Fetch real estate directory pages
  log(`📋 Phase 1: ${SOURCES.length} directory pages...\n`);
  for (let i = 0; i < SOURCES.length; i += CONCURRENCY) {
    const batch = SOURCES.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(scrapeSource));
    for (const contacts of results) {
      allNew.push(...contacts);
      totalFound = allNew.length;
    }
    const pct = Math.min(100, Math.round((totalFound / TARGET) * 100));
    const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));
    process.stdout.write(`\r  [${bar}] ${totalFound}/${TARGET} (${pct}%)`);

    if (allNew.length - lastSaveCount > 50) {
      progressiveSave(allNew);
    }
  }

  // Phase 2: Targeted searches via Startpage.com
  const searches = [
    // ── ALL 50 US STATES (2-3 cities each) ──────────────────────
    { q: 'Alabama real estate agent email Birmingham', r: 'Alabama' },
    { q: 'Alabama real estate agent email Montgomery', r: 'Alabama' },
    { q: 'Alabama real estate agent email Mobile', r: 'Alabama' },
    { q: 'Alaska real estate agent email Anchorage', r: 'Alaska' },
    { q: 'Alaska real estate agent email Fairbanks', r: 'Alaska' },
    { q: 'Arizona real estate agent email Phoenix', r: 'Arizona' },
    { q: 'Arizona real estate agent email Tucson', r: 'Arizona' },
    { q: 'Arizona real estate agent email Scottsdale', r: 'Arizona' },
    { q: 'Arkansas real estate agent email Little Rock', r: 'Arkansas' },
    { q: 'Arkansas real estate agent email Fayetteville', r: 'Arkansas' },
    { q: 'California real estate agent email Los Angeles', r: 'California' },
    { q: 'California real estate agent email San Francisco', r: 'California' },
    { q: 'California real estate agent email San Diego', r: 'California' },
    { q: 'California real estate agent email Sacramento', r: 'California' },
    { q: 'Colorado real estate agent email Denver', r: 'Colorado' },
    { q: 'Colorado real estate agent email Colorado Springs', r: 'Colorado' },
    { q: 'Colorado real estate agent email Aspen', r: 'Colorado' },
    { q: 'Connecticut real estate agent email Hartford', r: 'Connecticut' },
    { q: 'Connecticut real estate agent email New Haven', r: 'Connecticut' },
    { q: 'Connecticut real estate agent email Greenwich', r: 'Connecticut' },
    { q: 'Delaware real estate agent email Wilmington', r: 'Delaware' },
    { q: 'Delaware real estate agent email Dover', r: 'Delaware' },
    { q: 'Florida real estate agent email Miami', r: 'Florida' },
    { q: 'Florida real estate agent email Tampa', r: 'Florida' },
    { q: 'Florida real estate agent email Orlando', r: 'Florida' },
    { q: 'Florida real estate agent email Jacksonville', r: 'Florida' },
    { q: 'Florida real estate agent email Naples', r: 'Florida' },
    { q: 'Georgia real estate agent email Atlanta', r: 'Georgia' },
    { q: 'Georgia real estate agent email Savannah', r: 'Georgia' },
    { q: 'Georgia real estate agent email Augusta', r: 'Georgia' },
    { q: 'Hawaii real estate agent email Honolulu', r: 'Hawaii' },
    { q: 'Hawaii real estate agent email Maui', r: 'Hawaii' },
    { q: 'Idaho real estate agent email Boise', r: 'Idaho' },
    { q: 'Idaho real estate agent email Coeur dAlene', r: 'Idaho' },
    { q: 'Illinois real estate agent email Chicago', r: 'Illinois' },
    { q: 'Illinois real estate agent email Springfield', r: 'Illinois' },
    { q: 'Indiana real estate agent email Indianapolis', r: 'Indiana' },
    { q: 'Indiana real estate agent email Fort Wayne', r: 'Indiana' },
    { q: 'Iowa real estate agent email Des Moines', r: 'Iowa' },
    { q: 'Iowa real estate agent email Cedar Rapids', r: 'Iowa' },
    { q: 'Kansas real estate agent email Wichita', r: 'Kansas' },
    { q: 'Kansas real estate agent email Kansas City', r: 'Kansas' },
    { q: 'Kentucky real estate agent email Louisville', r: 'Kentucky' },
    { q: 'Kentucky real estate agent email Lexington', r: 'Kentucky' },
    { q: 'Louisiana real estate agent email New Orleans', r: 'Louisiana' },
    { q: 'Louisiana real estate agent email Baton Rouge', r: 'Louisiana' },
    { q: 'Maine real estate agent email Portland', r: 'Maine' },
    { q: 'Maine real estate agent email Bar Harbor', r: 'Maine' },
    { q: 'Maryland real estate agent email Baltimore', r: 'Maryland' },
    { q: 'Maryland real estate agent email Annapolis', r: 'Maryland' },
    { q: 'Massachusetts real estate agent email Boston', r: 'Massachusetts' },
    { q: 'Massachusetts real estate agent email Cape Cod', r: 'Massachusetts' },
    { q: 'Massachusetts real estate agent email Martha Vineyard', r: 'Massachusetts' },
    { q: 'Michigan real estate agent email Detroit', r: 'Michigan' },
    { q: 'Michigan real estate agent email Grand Rapids', r: 'Michigan' },
    { q: 'Michigan real estate agent email Traverse City', r: 'Michigan' },
    { q: 'Minnesota real estate agent email Minneapolis', r: 'Minnesota' },
    { q: 'Minnesota real estate agent email Duluth', r: 'Minnesota' },
    { q: 'Mississippi real estate agent email Jackson', r: 'Mississippi' },
    { q: 'Mississippi real estate agent email Gulfport', r: 'Mississippi' },
    { q: 'Missouri real estate agent email St Louis', r: 'Missouri' },
    { q: 'Missouri real estate agent email Kansas City', r: 'Missouri' },
    { q: 'Montana real estate agent email Bozeman', r: 'Montana' },
    { q: 'Montana real estate agent email Missoula', r: 'Montana' },
    { q: 'Nebraska real estate agent email Omaha', r: 'Nebraska' },
    { q: 'Nebraska real estate agent email Lincoln', r: 'Nebraska' },
    { q: 'Nevada real estate agent email Las Vegas', r: 'Nevada' },
    { q: 'Nevada real estate agent email Reno', r: 'Nevada' },
    { q: 'New Hampshire real estate agent email Manchester', r: 'New Hampshire' },
    { q: 'New Hampshire real estate agent email Portsmouth', r: 'New Hampshire' },
    { q: 'New Jersey real estate agent email Newark', r: 'New Jersey' },
    { q: 'New Jersey real estate agent email Jersey Shore', r: 'New Jersey' },
    { q: 'New Jersey real estate agent email Princeton', r: 'New Jersey' },
    { q: 'New Mexico real estate agent email Albuquerque', r: 'New Mexico' },
    { q: 'New Mexico real estate agent email Santa Fe', r: 'New Mexico' },
    { q: 'New York real estate agent email New York City', r: 'New York' },
    { q: 'New York real estate agent email Buffalo', r: 'New York' },
    { q: 'New York real estate agent email Hamptons', r: 'New York' },
    { q: 'North Carolina real estate agent email Charlotte', r: 'North Carolina' },
    { q: 'North Carolina real estate agent email Raleigh', r: 'North Carolina' },
    { q: 'North Carolina real estate agent email Outer Banks', r: 'North Carolina' },
    { q: 'North Dakota real estate agent email Fargo', r: 'North Dakota' },
    { q: 'North Dakota real estate agent email Bismarck', r: 'North Dakota' },
    { q: 'Ohio real estate agent email Columbus', r: 'Ohio' },
    { q: 'Ohio real estate agent email Cleveland', r: 'Ohio' },
    { q: 'Ohio real estate agent email Cincinnati', r: 'Ohio' },
    { q: 'Oklahoma real estate agent email Oklahoma City', r: 'Oklahoma' },
    { q: 'Oklahoma real estate agent email Tulsa', r: 'Oklahoma' },
    { q: 'Oregon real estate agent email Portland', r: 'Oregon' },
    { q: 'Oregon real estate agent email Bend', r: 'Oregon' },
    { q: 'Pennsylvania real estate agent email Philadelphia', r: 'Pennsylvania' },
    { q: 'Pennsylvania real estate agent email Pittsburgh', r: 'Pennsylvania' },
    { q: 'Rhode Island real estate agent email Providence', r: 'Rhode Island' },
    { q: 'Rhode Island real estate agent email Newport', r: 'Rhode Island' },
    { q: 'South Carolina real estate agent email Charleston', r: 'South Carolina' },
    { q: 'South Carolina real estate agent email Hilton Head', r: 'South Carolina' },
    { q: 'South Carolina real estate agent email Myrtle Beach', r: 'South Carolina' },
    { q: 'South Dakota real estate agent email Sioux Falls', r: 'South Dakota' },
    { q: 'South Dakota real estate agent email Rapid City', r: 'South Dakota' },
    { q: 'Tennessee real estate agent email Nashville', r: 'Tennessee' },
    { q: 'Tennessee real estate agent email Memphis', r: 'Tennessee' },
    { q: 'Tennessee real estate agent email Knoxville', r: 'Tennessee' },
    { q: 'Texas real estate agent email Houston', r: 'Texas' },
    { q: 'Texas real estate agent email Dallas', r: 'Texas' },
    { q: 'Texas real estate agent email Austin', r: 'Texas' },
    { q: 'Texas real estate agent email San Antonio', r: 'Texas' },
    { q: 'Utah real estate agent email Salt Lake City', r: 'Utah' },
    { q: 'Utah real estate agent email Park City', r: 'Utah' },
    { q: 'Vermont real estate agent email Burlington', r: 'Vermont' },
    { q: 'Vermont real estate agent email Stowe', r: 'Vermont' },
    { q: 'Virginia real estate agent email Richmond', r: 'Virginia' },
    { q: 'Virginia real estate agent email Virginia Beach', r: 'Virginia' },
    { q: 'Washington real estate agent email Seattle', r: 'Washington' },
    { q: 'Washington real estate agent email Spokane', r: 'Washington' },
    { q: 'West Virginia real estate agent email Charleston', r: 'West Virginia' },
    { q: 'West Virginia real estate agent email Morgantown', r: 'West Virginia' },
    { q: 'Wisconsin real estate agent email Milwaukee', r: 'Wisconsin' },
    { q: 'Wisconsin real estate agent email Madison', r: 'Wisconsin' },
    { q: 'Wyoming real estate agent email Jackson Hole', r: 'Wyoming' },
    { q: 'Wyoming real estate agent email Cheyenne', r: 'Wyoming' },

    // ── CANADA — All provinces/territories ─────────────────────
    { q: 'Ontario real estate agent email Toronto', r: 'Ontario Canada' },
    { q: 'Ontario real estate agent email Ottawa', r: 'Ontario Canada' },
    { q: 'Ontario real estate agent email Hamilton', r: 'Ontario Canada' },
    { q: 'British Columbia real estate agent email Vancouver', r: 'British Columbia Canada' },
    { q: 'British Columbia real estate agent email Victoria', r: 'British Columbia Canada' },
    { q: 'British Columbia real estate agent email Kelowna', r: 'British Columbia Canada' },
    { q: 'Quebec real estate agent email Montreal', r: 'Quebec Canada' },
    { q: 'Quebec real estate agent email Quebec City', r: 'Quebec Canada' },
    { q: 'Alberta real estate agent email Calgary', r: 'Alberta Canada' },
    { q: 'Alberta real estate agent email Edmonton', r: 'Alberta Canada' },
    { q: 'Manitoba real estate agent email Winnipeg', r: 'Manitoba Canada' },
    { q: 'Saskatchewan real estate agent email Saskatoon', r: 'Saskatchewan Canada' },
    { q: 'Saskatchewan real estate agent email Regina', r: 'Saskatchewan Canada' },
    { q: 'Nova Scotia real estate agent email Halifax', r: 'Nova Scotia Canada' },
    { q: 'New Brunswick real estate agent email Fredericton', r: 'New Brunswick Canada' },
    { q: 'Newfoundland real estate agent email St Johns', r: 'Newfoundland Canada' },
    { q: 'Prince Edward Island real estate agent email Charlottetown', r: 'Prince Edward Island Canada' },
    { q: 'Yukon real estate agent email Whitehorse', r: 'Yukon Canada' },
    { q: 'Northwest Territories real estate agent email Yellowknife', r: 'Northwest Territories Canada' },
    { q: 'Nunavut real estate agent email Iqaluit', r: 'Nunavut Canada' },

    // ── LUXURY / WATERFRONT / SPECIALTY MARKETS ────────────────
    { q: 'luxury waterfront real estate agent email Florida', r: 'Florida' },
    { q: 'Hamptons real estate agent email directory', r: 'New York' },
    { q: 'Martha Vineyard Nantucket real estate agent email', r: 'Massachusetts' },
    { q: 'Lake Tahoe waterfront real estate agent email', r: 'California Nevada' },
    { q: 'Michigan lakefront cottage real estate agent email', r: 'Michigan' },
    { q: 'Colorado mountain luxury real estate agent email', r: 'Colorado' },
    { q: 'Muskoka Ontario cottage real estate agent email', r: 'Ontario Canada' },
    { q: 'Lake of the Woods Ontario real estate agent email', r: 'Ontario Canada' },
    { q: 'Vancouver Island oceanfront real estate agent email', r: 'British Columbia Canada' },
    { q: 'Outer Banks North Carolina real estate agent email', r: 'North Carolina' },
    { q: 'Maine coastal real estate agent email', r: 'Maine' },
    { q: 'Cape Cod real estate agent email directory', r: 'Massachusetts' },
    { q: 'Newport Rhode Island waterfront real estate agent email', r: 'Rhode Island' },
    { q: 'Jersey Shore real estate agent email', r: 'New Jersey' },
    { q: 'Delaware beach real estate agent email', r: 'Delaware' },
    { q: 'South Carolina beach real estate agent email', r: 'South Carolina' },
    { q: 'Gulf Shores Alabama real estate agent email', r: 'Alabama' },
    { q: 'Destin Florida real estate agent email', r: 'Florida' },
    { q: 'Panama City Beach real estate agent email', r: 'Florida' },
    { q: 'Sarasota Florida real estate agent email', r: 'Florida' },
    { q: 'Palm Beach Florida real estate agent email', r: 'Florida' },
    { q: 'Fort Lauderdale real estate agent email', r: 'Florida' },
    { q: 'Kiawah Island South Carolina real estate agent email', r: 'South Carolina' },
    { q: 'Sea Island Georgia real estate agent email', r: 'Georgia' },
    { q: 'Amelia Island Florida real estate agent email', r: 'Florida' },
    { q: 'Hilton Head South Carolina real estate agent email', r: 'South Carolina' },
    { q: 'Napa Sonoma wine country real estate agent email', r: 'California' },
    { q: 'Aspen Vail ski resort real estate agent email', r: 'Colorado' },
    { q: 'Park City Deer Valley ski real estate agent email', r: 'Utah' },
    { q: 'Lake Como Italy real estate agent email', r: 'International' },
    { q: 'French Riviera real estate agent email', r: 'International' },
    { q: 'Costa Rica beach real estate agent email', r: 'International' },
    { q: 'Mexico Riviera Maya real estate agent email', r: 'International' },
    { q: 'Hawaii Big Island real estate agent email', r: 'Hawaii' },
    { q: 'Kauai real estate agent email directory', r: 'Hawaii' },

    // ── BROKER-SPECIFIC SEARCHES ──────────────────────────────
    { q: 'Coldwell Banker agent email directory United States', r: 'US National' },
    { q: 'REMAX agent email list United States', r: 'US National' },
    { q: 'Keller Williams real estate agent email directory', r: 'US National' },
    { q: 'Sothebys International Realty agent email list', r: 'US National' },
    { q: 'Century 21 real estate agent email USA', r: 'US National' },
    { q: 'Compass real estate agent email directory', r: 'US National' },
    { q: 'Berkshire Hathaway HomeServices agent email', r: 'US National' },
    { q: 'Weichert Realtors agent email directory', r: 'US National' },
    { q: 'Better Homes and Gardens real estate agent email', r: 'US National' },
    { q: 'ERA Real Estate agent email directory', r: 'US National' },
    { q: 'Realty Executives agent email list', r: 'US National' },
    { q: 'Howard Hanna real estate agent email', r: 'US National' },
    { q: 'Long and Foster real estate agent email', r: 'US National' },
    { q: 'Royal LePage real estate agent email Canada', r: 'Canada National' },
    { q: 'REMAX Canada real estate agent email', r: 'Canada National' },
    { q: 'Century 21 Canada real estate agent email', r: 'Canada National' },
    { q: 'Right at Home real estate agent email Canada', r: 'Canada National' },
    { q: 'Sutton Group real estate agent email Canada', r: 'Canada National' },

    // ── COMMERCIAL REAL ESTATE ─────────────────────────────────
    { q: 'commercial real estate agent email retail', r: 'US National' },
    { q: 'commercial real estate agent email office', r: 'US National' },
    { q: 'commercial real estate agent email industrial', r: 'US National' },
    { q: 'commercial real estate agent email multifamily', r: 'US National' },
    { q: 'commercial real estate agent email land', r: 'US National' },
    { q: 'property management company email list', r: 'US National' },
    { q: 'real estate investor email list', r: 'US National' },
    { q: 'real estate developer email contact', r: 'US National' },
    { q: 'commercial real estate broker email directory', r: 'US National' },
    { q: 'retail real estate leasing agent email', r: 'US National' },

    // ── NICHE SPECIALTIES ──────────────────────────────────────
    { q: 'vineyard winery real estate agent email', r: 'US National' },
    { q: 'equestrian horse farm real estate agent email', r: 'US National' },
    { q: 'golf course community real estate agent email', r: 'US National' },
    { q: 'ski resort mountain real estate agent email', r: 'US National' },
    { q: 'lakefront waterfront real estate agent email', r: 'US National' },
    { q: 'island property real estate agent email', r: 'US National' },
    { q: 'historic home real estate agent email', r: 'US National' },
    { q: 'beachfront coastal real estate agent email', r: 'US National' },
    { q: 'mountain cabin real estate agent email', r: 'US National' },
    { q: 'desert luxury real estate agent email', r: 'US National' },
    { q: 'ranch farm real estate agent email', r: 'US National' },
    { q: 'timber land real estate agent email', r: 'US National' },
    { q: 'conservation land real estate agent email', r: 'US National' },
    { q: 'green sustainable real estate agent email', r: 'US National' },
    { q: 'senior 55 plus real estate agent email', r: 'US National' },
    { q: 'vacation rental real estate agent email', r: 'US National' },
    { q: 'timeshare real estate agent email', r: 'US National' },
    { q: 'auction real estate agent email', r: 'US National' },
    { q: 'short sale foreclosure real estate agent email', r: 'US National' },
    { q: '1031 exchange real estate agent email', r: 'US National' },
    { q: 'tenant representation real estate agent email', r: 'US National' },
    { q: 'landlord representation real estate agent email', r: 'US National' },
    { q: 'HOA management real estate agent email', r: 'US National' },
    { q: 'condo co-op real estate agent email', r: 'US National' },
    { q: 'townhouse real estate agent email', r: 'US National' },
    { q: 'single family real estate agent email', r: 'US National' },
    { q: 'multi family duplex triplex real estate agent email', r: 'US National' },
    { q: 'apartment building real estate agent email', r: 'US National' },
    { q: 'self storage real estate agent email', r: 'US National' },
    { q: 'hotel motel resort real estate agent email', r: 'US National' },
    { q: 'private club yacht club real estate agent email', r: 'US National' },
    { q: 'golf club tennis club real estate agent email', r: 'US National' },
    { q: 'beach club surf club real estate agent email', r: 'US National' },
    { q: 'sailing club fishing club real estate agent email', r: 'US National' },
    { q: 'hunt club polo club real estate agent email', r: 'US National' },
    { q: 'equestrian center stable barn real estate agent email', r: 'US National' },
    { q: 'farm ranch vineyard real estate agent email', r: 'US National' },
    { q: 'winery distillery brewery real estate agent email', r: 'US National' },
    { q: 'wellness spa yoga retreat real estate agent email', r: 'US National' },
    { q: 'camp lodge cabin real estate agent email', r: 'US National' },
    { q: 'villa estate mansion real estate agent email', r: 'US National' },
    { q: 'chateau manor farmhouse real estate agent email', r: 'US National' },
    { q: 'cottage bungalow real estate agent email', r: 'US National' },

    // ── REAL ESTATE CONFERENCES / EVENTS ───────────────────────
    { q: 'NAR NXT real estate conference attendee email', r: 'US National' },
    { q: 'Inman Connect real estate agent email', r: 'US National' },
    { q: 'RISMedia real estate agent email list', r: 'US National' },
    { q: 'RealTrends real estate agent email', r: 'US National' },
    { q: 'Tom Ferry real estate agent email list', r: 'US National' },
    { q: 'Buffini real estate agent email', r: 'US National' },
    { q: 'Ninja Selling real estate agent email', r: 'US National' },
    { q: 'Mike Ferry real estate agent email', r: 'US National' },
    { q: 'Brian Buffini real estate agent email', r: 'US National' },
    { q: 'Ryan Serhant real estate agent email', r: 'US National' },
    { q: 'Grant Cardone real estate agent email', r: 'US National' },
    { q: 'Gary Vaynerchuk real estate agent email', r: 'US National' },
    { q: 'Barbara Corcoran real estate agent email', r: 'US National' },
    { q: 'Fredrik Eklund real estate agent email', r: 'US National' },
    { q: 'Dave Ramsey real estate agent email', r: 'US National' },
    { q: 'Brandon Turner real estate agent email', r: 'US National' },
    { q: 'Pace Morby real estate agent email', r: 'US National' },
    { q: 'David Greene real estate agent email', r: 'US National' },
  ];

  for (let i = 0; i < searches.length; i++) {
    const s = searches[i];
    const contacts = await searchScrape(s.q, s.r);
    allNew.push(...contacts);
    totalFound = allNew.length;
    if (contacts.length > 0) {
      log(`  ✓ "${s.q.slice(0, 55)}" → ${contacts.length} emails`);
    } else {
      log(`  · "${s.q.slice(0, 55)}" → 0`);
    }

    if (allNew.length - lastSaveCount > 100) {
      progressiveSave(allNew);
    }
  }

  // Final save
  log(`\n📦 Final merge...`);
  const merged = [...existing, ...allNew];
  const saved = saveContacts(merged);
  const elapsed = Math.round((Date.now() - start) / 1000);

  log(`\n╔══════════════════════════════════════════╗`);
  log(`║  ✅ DONE in ${elapsed}s                    ║`);
  log(`║  Found: ${allNew.length} new contacts      ║`);
  log(`║  Pool: ${saved.length} total               ║`);
  log(`║  Errors: ${totalErrors}                    ║`);
  log(`╚══════════════════════════════════════════╝\n`);
}

main().catch(e => {
  log(`\n❌ Fatal: ${e.message}`);
  process.exit(1);
});