#!/usr/bin/env node
// check-citations.mjs — verifies <!-- src: ... --> citation comments in the root
// guide HTML files against /sources PDFs, repo CSV/JSON/Markdown datasets, and
// free-text references. Node built-ins only. See CLAUDE.md and the execution-plan
// task #2 spec for the citation grammar this implements.
//
// Known, accepted v1 simplifications (see plan decisions D1-D9):
// - Claim boundary is literal: "text since the previous src comment in the same
//   block". A citation whose claim segment has zero numbers is reported NO-NUMBER,
//   never PASS — nothing here passes vacuously.
// - Compound citations with two excerpts at two different pages (D4) fold both
//   pages into one candidate-page set for a single check mode; the second clause's
//   own numbers are not independently re-verified.
// - Hyphenated page ranges (p.N-M) are capped at 3 pages (D5); wider ranges FAIL.
// - CSV "Data" mode covers exactly: cell-value, row-count, single-row ratio a/b,
//   and multi-row min/max of ratio a/b (spec §5). The one known 3-column derived
//   table (price_usd / net_weight_lb * extension_rate_min/max) is detected by name
//   and reported as UNVERIFIABLE (derived formula), never silently passed or failed
//   (D6) — nothing broader than that named formula is probed.
// - Date/heading-number exclusion from the number scanner is pattern-matching,
//   not a formal grammar (D9); every ignored number is listed with its reason in
//   non-quiet mode so a misclassification is visible.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const SOURCES_DIR = '/sources';

const BLOCK_TAGS = ['p', 'li', 'td', 'th', 'figcaption', 'dd'];
const SUPPRESS_TAGS = ['script', 'style', 'nav', 'header', 'footer'];

// ---------------------------------------------------------------------------
// Number scanning / normalization
// ---------------------------------------------------------------------------

const MONTH_RE =
  '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';

function overlapsAny(ranges, start, end) {
  for (const [s, e] of ranges) {
    if (start < e && end > s) return true;
  }
  return false;
}

/**
 * Scans text for numeric tokens. When `classify` is true, dates and
 * heading-numbering are pulled out into `ignored` with a reason instead of
 * `found` (used for guide HTML text). When false, every numeric-looking token
 * is just returned in `found` (used for source/page text, where we're only
 * checking presence, not classifying the guide's own prose).
 */
function scanNumbers(text, { classify = false } = {}) {
  const found = [];
  const ignored = [];
  const consumed = [];

  const claim = (start, end) => consumed.push([start, end]);
  const isConsumed = (start, end) => overlapsAny(consumed, start, end);

  if (classify) {
    // Year is now optional and, when present, must be a real 19xx/20xx year
    // (not \d{2,4}, which would read a small number right after the date —
    // "September 7, 43 products" — as a two-digit year and swallow it). Day
    // is restricted to 1-31. A bare month+day with no year still counts as a
    // date (fix 3, v1.3).
    const dateRe = new RegExp(
      `\\b${MONTH_RE}\\.?\\s+(?:3[01]|[12]\\d|0?[1-9])(?:st|nd|rd|th)?(?:,?\\s*(?:19|20)\\d{2})?\\b|\\b\\d{4}-\\d{2}-\\d{2}\\b`,
      'gi'
    );
    for (const m of text.matchAll(dateRe)) {
      if (isConsumed(m.index, m.index + m[0].length)) continue;
      ignored.push({ raw: m[0], reason: 'date', index: m.index });
      claim(m.index, m.index + m[0].length);
    }
    const headingRe = /\b(?:Table|Fig(?:ure)?\.?|§)\s*\d+[a-zA-Z]?\b|\bAG-\d+\b/gi;
    for (const m of text.matchAll(headingRe)) {
      if (isConsumed(m.index, m.index + m[0].length)) continue;
      ignored.push({ raw: m[0], reason: 'heading', index: m.index });
      claim(m.index, m.index + m[0].length);
    }

    // Unit denominator: "1,000"/"1000" directly preceded by "per"/"/" and
    // followed by a square-footage unit — this is the fixed denominator of a
    // rate expression ("lb per 1,000 sq ft"), not a citable data point.
    const unitDenomRe = /\b(1,000|1000)\b/g;
    for (const m of text.matchAll(unitDenomRe)) {
      if (isConsumed(m.index, m.index + m[0].length)) continue;
      const before = text.slice(Math.max(0, m.index - 5), m.index);
      const after = text.slice(m.index + m[0].length, m.index + m[0].length + 20);
      const precededByPerOrSlash = /(?:per\s*$|\/\s*$)/i.test(before);
      const followedByUnit = /^\s*(sq(?:uare)?[\s.-]?f(?:ee|oo)?t\.?|ft\s*[²2])\b/i.test(after);
      if (precededByPerOrSlash && followedByUnit) {
        ignored.push({ raw: m[0], reason: 'unit', index: m.index });
        claim(m.index, m.index + m[0].length);
      }
    }

    // Bare 4-digit year (1900-2099), no comma, unless followed by a unit that
    // would make it a real quantity rather than a year (e.g. "2024 seeds").
    const yearRe = /\b(19\d{2}|20\d{2})\b/g;
    for (const m of text.matchAll(yearRe)) {
      if (isConsumed(m.index, m.index + m[0].length)) continue;
      const after = text.slice(m.index + m[0].length, m.index + m[0].length + 15);
      const followedByUnit = /^\s*(sq\s?\.?\s?ft|square\s+feet|lbs?\b|pounds?\b|seeds?\b)/i.test(after);
      if (followedByUnit) continue;
      ignored.push({ raw: m[0], reason: 'year', index: m.index });
      claim(m.index, m.index + m[0].length);
    }
  }

  // Compound fractions: "1-1/2", "2 1/2"
  const compoundFracRe = /\b(\d+)[\s-](\d+)\/(\d+)\b/g;
  for (const m of text.matchAll(compoundFracRe)) {
    if (isConsumed(m.index, m.index + m[0].length)) continue;
    const whole = +m[1], num = +m[2], den = +m[3];
    if (den === 0) continue;
    const value = whole + num / den;
    found.push({ raw: m[0], type: 'fraction', canonical: String(value), value, min: null, max: null, index: m.index });
    claim(m.index, m.index + m[0].length);
  }

  // Unicode fractions
  const uniFracMap = {
    '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅕': 0.2, '⅖': 0.4,
    '⅗': 0.6, '⅘': 0.8, '⅙': 1 / 6, '⅚': 5 / 6, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
  };
  const uniFracRe = /[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g;
  for (const m of text.matchAll(uniFracRe)) {
    if (isConsumed(m.index, m.index + m[0].length)) continue;
    const value = uniFracMap[m[0]];
    found.push({ raw: m[0], type: 'fraction', canonical: String(value), value, min: null, max: null, index: m.index });
    claim(m.index, m.index + m[0].length);
  }

  // Plain fractions "1/2"
  const plainFracRe = /\b(\d+)\/(\d+)\b/g;
  for (const m of text.matchAll(plainFracRe)) {
    if (isConsumed(m.index, m.index + m[0].length)) continue;
    const num = +m[1], den = +m[2];
    if (den === 0) continue;
    const value = num / den;
    found.push({ raw: m[0], type: 'fraction', canonical: String(value), value, min: null, max: null, index: m.index });
    claim(m.index, m.index + m[0].length);
  }

  // Percentages
  const pctRe = /\b(\d+(?:\.\d+)?)\s*%/g;
  for (const m of text.matchAll(pctRe)) {
    if (isConsumed(m.index, m.index + m[0].length)) continue;
    const value = +m[1];
    found.push({ raw: m[0], type: 'percent', canonical: `${value}%`, value, min: null, max: null, index: m.index });
    claim(m.index, m.index + m[0].length);
  }

  // Multipliers "3.3×" "3.3x"
  const multRe = /\b(\d+(?:\.\d+)?)\s*[×xX]\b/g;
  for (const m of text.matchAll(multRe)) {
    if (isConsumed(m.index, m.index + m[0].length)) continue;
    const value = +m[1];
    found.push({ raw: m[0], type: 'multiplier', canonical: `${value}x`, value, min: null, max: null, index: m.index });
    claim(m.index, m.index + m[0].length);
  }

  // Hyphen-compound ranges: "2-to-4", "2- to 4-", "2-to-4-inch"
  const hyphenCompoundRangeRe = /\b(\d[\d,]*(?:\.\d+)?)-\s*to\s*-?(\d[\d,]*(?:\.\d+)?)-?/g;
  for (const m of text.matchAll(hyphenCompoundRangeRe)) {
    if (isConsumed(m.index, m.index + m[0].length)) continue;
    const a = parseFloat(m[1].replace(/,/g, ''));
    const b = parseFloat(m[2].replace(/,/g, ''));
    if (isNaN(a) || isNaN(b)) continue;
    const min = Math.min(a, b), max = Math.max(a, b);
    found.push({ raw: m[0], type: 'range', canonical: `${min}-${max}`, value: null, min, max, index: m.index });
    claim(m.index, m.index + m[0].length);
  }

  // Ranges "2-3", "2–3", "2 to 3"
  const rangeRe = /\b(\d[\d,]*(?:\.\d+)?)\s*(?:-|–|to)\s*(\d[\d,]*(?:\.\d+)?)\b/g;
  for (const m of text.matchAll(rangeRe)) {
    if (isConsumed(m.index, m.index + m[0].length)) continue;
    const a = parseFloat(m[1].replace(/,/g, ''));
    const b = parseFloat(m[2].replace(/,/g, ''));
    if (isNaN(a) || isNaN(b)) continue;
    const min = Math.min(a, b), max = Math.max(a, b);
    found.push({ raw: m[0], type: 'range', canonical: `${min}-${max}`, value: null, min, max, index: m.index });
    claim(m.index, m.index + m[0].length);
  }

  // Plain numbers
  const plainRe = /\b\d[\d,]*(?:\.\d+)?\b/g;
  for (const m of text.matchAll(plainRe)) {
    if (isConsumed(m.index, m.index + m[0].length)) continue;
    const raw = m[0];
    const value = parseFloat(raw.replace(/,/g, ''));
    if (isNaN(value)) continue;
    found.push({ raw, type: 'plain', canonical: String(value), value, min: null, max: null, index: m.index });
    claim(m.index, m.index + raw.length);
  }

  found.sort((a, b) => a.index - b.index);
  ignored.sort((a, b) => a.index - b.index);
  return { found, ignored };
}

// Source-side only (never applied to the guide's own claim text): spelled-out
// small numbers ("two to three times weekly") are common in extension prose
// and would otherwise never match a claim correctly written in digits.
const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
};
const NUMBER_WORD_RE = new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join('|')})\\b`, 'gi');

function convertNumberWords(text) {
  return text.replace(NUMBER_WORD_RE, (m) => String(NUMBER_WORDS[m.toLowerCase()]));
}

function extractNumberTokens(text) {
  return scanNumbers(convertNumberWords(text), { classify: false }).found;
}

// Adds a token's canonical form to `set`; for a range token, also adds its
// bare min/max endpoints so a plain claim number ("8") can match a source
// range ("6-8"). A claim that is itself a range must still match the whole
// range canonical — this augmentation only ever widens the SOURCE side.
function addCanonicalWithRangeEndpoints(set, tokens) {
  for (const t of tokens) {
    set.add(t.canonical);
    if (t.type === 'range') {
      set.add(String(t.min));
      set.add(String(t.max));
    }
  }
}

function normalizeTextForMatch(s) {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

// Consecutive "..."-separated segments of a quote must be found within
// maxGap normalized characters of each other. Without this bound, a quote
// like "sentence one...unrelated sentence three paragraphs later" would
// "match" anything containing both fragments anywhere on the page, which is
// indistinguishable from a fabricated splice.
function matchExcerpt(pageNorm, quoteNorm, { maxGap = 200 } = {}) {
  const ellipsisParts = quoteNorm.split(/\.\.\.|…/).map((s) => s.trim()).filter(Boolean);
  if (ellipsisParts.length <= 1) {
    return pageNorm.includes(quoteNorm);
  }
  let cursor = 0;
  let prevEnd = null;
  for (const part of ellipsisParts) {
    const idx = pageNorm.indexOf(part, cursor);
    if (idx === -1) return false;
    if (prevEnd !== null && idx - prevEnd > maxGap) return false;
    cursor = idx + part.length;
    prevEnd = cursor;
  }
  return true;
}

// ---------------------------------------------------------------------------
// HTML tokenizing
// ---------------------------------------------------------------------------

const TOKEN_RE = /<!--([\s\S]*?)-->|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^<>]*?)?)\s*\/?>/g;

function tokenize(html) {
  const tokens = [];
  for (const m of html.matchAll(TOKEN_RE)) {
    const start = m.index;
    const end = start + m[0].length;
    if (m[1] !== undefined) {
      tokens.push({ kind: 'comment', content: m[1], start, end, raw: m[0] });
    } else if (m[2] !== undefined) {
      tokens.push({ kind: 'close', name: m[2].toLowerCase(), start, end, raw: m[0] });
    } else {
      tokens.push({ kind: 'open', name: m[3].toLowerCase(), attrs: m[4] || '', start, end, raw: m[0] });
    }
  }
  return tokens;
}

function findSpans(tokens, tagName) {
  const spans = [];
  const stack = [];
  for (const t of tokens) {
    if (t.kind === 'open' && t.name === tagName) stack.push(t);
    else if (t.kind === 'close' && t.name === tagName) {
      const open = stack.pop();
      if (open) spans.push({ tag: tagName, start: open.end, end: t.start, openStart: open.start, closeEnd: t.end });
    }
  }
  return spans;
}

function buildLineIndex(html) {
  const offsets = [0];
  for (let i = 0; i < html.length; i++) {
    if (html[i] === '\n') offsets.push(i + 1);
  }
  return (pos) => {
    let lo = 0, hi = offsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (offsets[mid] <= pos) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  };
}

function stripTagsAndDecode(html) {
  const noTags = html.replace(/<[^>]*>/g, ' ');
  return decodeEntities(noTags);
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&times;/g, '×')
    .replace(/&divide;/g, '÷')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&rdquo;|&ldquo;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

function truncate(s, n = 120) {
  const clean = s.replace(/\s+/g, ' ').trim();
  return clean.length > n ? clean.slice(0, n - 1) + '…' : clean;
}

// ---------------------------------------------------------------------------
// Citation grammar parsing
// ---------------------------------------------------------------------------

function parseCitationRaw(raw) {
  let working = raw.trim();
  let note = null;
  const emIdx = working.indexOf(' — ');
  if (emIdx >= 0) {
    note = working.slice(emIdx + 3).trim();
    working = working.slice(0, emIdx);
  }

  const markers = [];
  const pMatch = working.match(/\sp\.\d/);
  if (pMatch) markers.push(pMatch.index);
  const parenIdx = working.indexOf(' (');
  if (parenIdx >= 0) markers.push(parenIdx);
  const rowMatch = working.match(/\srows?\b/);
  if (rowMatch) markers.push(rowMatch.index);

  const boundary = markers.length ? Math.min(...markers) : working.length;
  const target = working.slice(0, boundary).trim();
  const remainder = working.slice(boundary).trim();

  const pages = new Set();
  let rangeTooWide = false;
  for (const m of remainder.matchAll(/p\.(\d+)(?:-(\d+))?/g)) {
    const n = +m[1];
    if (m[2] !== undefined) {
      const n2 = +m[2];
      if (n2 - n > 2) rangeTooWide = true;
      else for (let k = n; k <= n2; k++) pages.add(k);
    } else {
      pages.add(n);
    }
  }

  const quoteSource = remainder.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  const quotes = [...quoteSource.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

  // Compound citations "row N (hint); row M (hint)" carry one clause per
  // semicolon-separated segment, each with its own optional column hint.
  // Every clause is parsed and unioned, not just the first (fix 7).
  let rowSpec = null;
  const rowGroups = [];
  const clauseRe = /\brows?\b\s*([\d,\s]+?)(?:\s*\(([^)]*)\))?(?=\s*;|$)/gi;
  for (const m of remainder.matchAll(clauseRe)) {
    const ids = [...m[1].matchAll(/\d+/g)].map((x) => +x[0]);
    if (!ids.length) continue;
    rowGroups.push({ ids, hint: m[2] ? m[2].trim() : null });
  }
  if (rowGroups.length) {
    const allIds = [...new Set(rowGroups.flatMap((g) => g.ids))];
    rowSpec = { ids: allIds, columnHint: rowGroups.length === 1 ? rowGroups[0].hint : null, groups: rowGroups };
  }

  return { target, pages, rangeTooWide, quotes, rowSpec, note };
}

// ---------------------------------------------------------------------------
// Target resolution
// ---------------------------------------------------------------------------

function buildResolutionContext() {
  const sourcesFiles = new Set(fs.readdirSync(SOURCES_DIR));
  return { sourcesFiles, repoRoot: REPO_ROOT };
}

function resolveTarget(target, ctx) {
  const lower = target.toLowerCase();

  if (lower.endsWith('.pdf')) {
    if (ctx.sourcesFiles.has(target)) return { kind: 'pdf', path: path.join(SOURCES_DIR, target), name: target };
    return { kind: 'notfound', raw: target };
  }

  if (target === 'lawn_species_database.json' || target === 'picker/src/data/lawn_species_database.json') {
    const p = path.join(ctx.repoRoot, 'picker/src/data/lawn_species_database.json');
    return { kind: 'json', path: p, name: target };
  }

  if (lower.endsWith('.md') && target.startsWith('data/')) {
    const p = path.join(ctx.repoRoot, target);
    if (!fs.existsSync(p)) return { kind: 'notfound', raw: target };
    return { kind: 'repo_md', path: p, name: target };
  }

  if (lower.endsWith('.md')) {
    if (ctx.sourcesFiles.has(target)) return { kind: 'sources_md', path: path.join(SOURCES_DIR, target), name: target };
    return { kind: 'notfound', raw: target };
  }

  if (target.startsWith('data/') && lower.endsWith('.csv')) {
    const p = path.join(ctx.repoRoot, target);
    if (!fs.existsSync(p)) return { kind: 'notfound', raw: target };
    return { kind: 'csv', path: p, name: target };
  }

  return { kind: 'reference', raw: target };
}

// ---------------------------------------------------------------------------
// PDF text (memoized)
// ---------------------------------------------------------------------------

const pdfPageCacheLayout = new Map();
const pdfPageCachePlain = new Map();

function runPdftotext(file, page, extraArgs) {
  try {
    return execFileSync('pdftotext', ['-f', String(page), '-l', String(page), ...extraArgs, file, '-'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
}

// -layout preserves visual column position, which is exactly what breaks it
// on two-column PDFs: it interleaves alternating lines from each column into
// one linear string, splitting phrases that read correctly in natural
// (plain) reading order. Quote matching therefore uses plain text only, per
// v1.2 fix 2. Numbers-mode checks the union of both, since a real fact is a
// real fact regardless of which extraction mode's line-splitting affected it.
function getPdfPageTextLayout(file, page) {
  const key = file + '#' + page;
  if (pdfPageCacheLayout.has(key)) return pdfPageCacheLayout.get(key);
  const text = runPdftotext(file, page, ['-layout']);
  pdfPageCacheLayout.set(key, text);
  return text;
}

function getPdfPageTextPlain(file, page) {
  const key = file + '#' + page;
  if (pdfPageCachePlain.has(key)) return pdfPageCachePlain.get(key);
  const text = runPdftotext(file, page, []);
  pdfPageCachePlain.set(key, text);
  return text;
}

const pdfPageCountCache = new Map();

function getPdfPageCount(file) {
  if (pdfPageCountCache.has(file)) return pdfPageCountCache.get(file);
  let count = 0;
  try {
    const info = execFileSync('pdfinfo', [file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const m = info.match(/^Pages:\s*(\d+)/m);
    if (m) count = +m[1];
  } catch {
    count = 0;
  }
  pdfPageCountCache.set(file, count);
  return count;
}

function isTextLayer(text) {
  return Boolean(text) && text.replace(/\s/g, '').length > 50;
}

function pageIsTextLayer(filePath, page) {
  return isTextLayer(getPdfPageTextPlain(filePath, page)) || isTextLayer(getPdfPageTextLayout(filePath, page));
}

function pageNumberSet(filePath, page) {
  const set = new Set();
  addCanonicalWithRangeEndpoints(set, extractNumberTokens(getPdfPageTextPlain(filePath, page)));
  addCanonicalWithRangeEndpoints(set, extractNumberTokens(getPdfPageTextLayout(filePath, page)));
  return set;
}

function findNumberOnOtherPages(filePath, excludePages, canonical) {
  const total = getPdfPageCount(filePath);
  for (let p = 1; p <= total; p++) {
    if (excludePages.includes(p)) continue;
    if (!pageIsTextLayer(filePath, p)) continue;
    if (pageNumberSet(filePath, p).has(canonical)) return p;
  }
  return null;
}

function findExcerptOnOtherPages(filePath, excludePages, quoteNorm) {
  const total = getPdfPageCount(filePath);
  for (let p = 1; p <= total; p++) {
    if (excludePages.includes(p)) continue;
    if (!isTextLayer(getPdfPageTextPlain(filePath, p))) continue;
    if (matchExcerpt(normalizeTextForMatch(getPdfPageTextPlain(filePath, p)), quoteNorm)) return p;
  }
  return null;
}

// ---------------------------------------------------------------------------
// CSV (memoized)
// ---------------------------------------------------------------------------

const csvCache = new Map();

function parseCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

function parseCsv(filePath) {
  if (csvCache.has(filePath)) return csvCache.get(filePath);
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const fields = parseCsvLine(line);
    const row = {};
    header.forEach((h, i) => { row[h] = fields[i] !== undefined ? fields[i] : ''; });
    return row;
  });
  const idToRow = new Map();
  for (const row of rows) {
    const id = parseInt(row.id, 10);
    if (!isNaN(id)) idToRow.set(id, row);
  }
  const numericColumns = header.filter((h) => rows.some((row) => parseNumericCell(row[h]) !== null));
  const result = { header, rows, idToRow, numericColumns };
  csvCache.set(filePath, result);
  return result;
}

function parseNumericCell(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === '') return null;
  const cleaned = s.replace(/[$,]/g, '');
  const f = parseFloat(cleaned);
  return isNaN(f) ? null : f;
}

function decimalPlaces(numStr) {
  const m = String(numStr).match(/\.(\d+)/);
  return m ? m[1].length : 0;
}

function roundTo(value, places) {
  const factor = Math.pow(10, places);
  return Math.round(value * factor) / factor;
}

// ---------------------------------------------------------------------------
// JSON (memoized flatten)
// ---------------------------------------------------------------------------

const jsonCache = new Map();

function flattenJsonNumbers(filePath) {
  if (jsonCache.has(filePath)) return jsonCache.get(filePath);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const numbers = new Set();
  const walk = (node) => {
    if (typeof node === 'number') { numbers.add(node); return; }
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node && typeof node === 'object') { Object.values(node).forEach(walk); }
  };
  walk(data);
  jsonCache.set(filePath, numbers);
  return numbers;
}

function jsonHasNumber(numberToken, numberSet, tolerance = 1e-6) {
  const has = (v) => {
    for (const n of numberSet) if (Math.abs(n - v) < tolerance) return true;
    return false;
  };
  if (numberToken.type === 'range') return has(numberToken.min) && has(numberToken.max);
  return has(numberToken.value);
}

// ---------------------------------------------------------------------------
// Per-mode checkers
// ---------------------------------------------------------------------------

// A page number beyond the PDF's actual page count is a citation error, not
// a scanning/OCR problem — pdftotext returns empty output for it exactly as
// it would for a genuinely scanned page, so this must be checked explicitly
// and first, or an out-of-range page silently reads as "scanned-pdf".
function checkPageRange(filePath, pages) {
  const total = getPdfPageCount(filePath);
  const outOfRange = pages.filter((p) => p < 1 || p > total);
  if (outOfRange.length) {
    return { reason: 'page out of range', detail: `p.${outOfRange.join(',')} (PDF has ${total} pages)` };
  }
  return null;
}

function checkQuoteMode(parsed, claimNumbers, resolved) {
  const pages = [...parsed.pages].sort((a, b) => a - b);
  const rangeError = checkPageRange(resolved.path, pages);
  if (rangeError) return { status: 'FAIL', ...rangeError, pages };
  const textLayerPages = pages.filter((p) => isTextLayer(getPdfPageTextPlain(resolved.path, p)));
  if (textLayerPages.length === 0) return { status: 'UNVERIFIABLE', reason: 'scanned-pdf', pages };

  let matchedPage = null;
  for (const q of parsed.quotes) {
    const qNorm = normalizeTextForMatch(q);
    let found = false;
    for (const p of textLayerPages) {
      const pageNorm = normalizeTextForMatch(getPdfPageTextPlain(resolved.path, p));
      if (matchExcerpt(pageNorm, qNorm)) {
        found = true;
        if (matchedPage == null) matchedPage = p;
        break;
      }
    }
    if (!found) {
      const foundPage = findExcerptOnOtherPages(resolved.path, pages, qNorm);
      const detail = q + (foundPage ? ` (found on p.${foundPage})` : '');
      return { status: 'FAIL', reason: 'quote not on page', detail, pages };
    }
  }
  const quoteCanon = new Set();
  for (const q of parsed.quotes) addCanonicalWithRangeEndpoints(quoteCanon, extractNumberTokens(q));
  for (const num of claimNumbers) {
    if (!quoteCanon.has(num.canonical)) {
      return { status: 'FAIL', reason: 'number not in excerpt', detail: num.raw, pages };
    }
  }
  return { status: 'PASS', mode: 'quote', page: matchedPage };
}

function checkNumbersModePdf(parsed, claimNumbers, resolved) {
  const pages = [...parsed.pages].sort((a, b) => a - b);
  const rangeError = checkPageRange(resolved.path, pages);
  if (rangeError) return { status: 'FAIL', ...rangeError, pages };
  const textLayerPages = pages.filter((p) => pageIsTextLayer(resolved.path, p));
  if (textLayerPages.length === 0) return { status: 'UNVERIFIABLE', reason: 'scanned-pdf', pages };

  const canonSet = new Set();
  for (const p of textLayerPages) {
    for (const c of pageNumberSet(resolved.path, p)) canonSet.add(c);
  }
  for (const num of claimNumbers) {
    if (!canonSet.has(num.canonical)) {
      const foundPage = findNumberOnOtherPages(resolved.path, pages, num.canonical);
      const detail = num.raw + (foundPage ? ` (found on p.${foundPage})` : '');
      return { status: 'FAIL', reason: 'number not on page', detail, pages };
    }
  }
  return { status: 'PASS', mode: 'numbers', pages: textLayerPages };
}

function checkNumbersModeWholeFile(claimNumbers, resolved) {
  const text = fs.readFileSync(resolved.path, 'utf8');
  const canonSet = new Set();
  addCanonicalWithRangeEndpoints(canonSet, extractNumberTokens(text));
  for (const num of claimNumbers) {
    if (!canonSet.has(num.canonical)) {
      return { status: 'FAIL', reason: 'number not in file', detail: num.raw };
    }
  }
  return { status: 'PASS', mode: 'numbers', wholeFile: true };
}

// A ratio check may only pair two columns that share a unit, so it can't
// silently equate (say) a dollar figure with a square-footage figure just
// because the arithmetic happens to land on the claimed number. The unit is
// read off the column-name suffix; a column whose suffix isn't recognized is
// excluded from every ratio check entirely (it can still be matched by cell
// value, row count, or the named derivedFormulaProbe below).
function columnUnit(name) {
  if (/_lb_per_1000$/.test(name)) return 'lb_per_1000';
  if (/_per_lb_usd$/.test(name)) return 'usd_per_lb';
  if (/_usd$/.test(name)) return 'usd';
  if (/_sqft$/.test(name)) return 'sqft';
  if (/_lb$/.test(name)) return 'lb';
  return null;
}

function sameUnit(a, b) {
  const ua = columnUnit(a), ub = columnUnit(b);
  return ua !== null && ua === ub;
}

// The one known 3-column derived table (seed-bag-coverage-claims.html's "Cost
// per 1,000 sq ft" figures): price_usd / net_weight_lb * extension_rate_{min,max}.
// Detected by exact column name, not a general combinatorial search (D6) — a
// match here means "known gap", never a pass.
function derivedFormulaProbe(row, target, places) {
  const price = parseNumericCell(row.price_usd);
  const weight = parseNumericCell(row.net_weight_lb);
  const rmin = parseNumericCell(row.extension_rate_min);
  const rmax = parseNumericCell(row.extension_rate_max);
  if (price === null || weight === null || weight === 0) return false;
  const candidates = [];
  if (rmin !== null) candidates.push(price / weight * rmin);
  if (rmax !== null) candidates.push(price / weight * rmax);
  return candidates.some((v) => roundTo(v, places) === roundTo(target, places));
}

// A number's immediate textual neighbor in the CLAIM ("40 lb", "1,865 sq
// ft", "$38.96") tells us which column UNIT it's describing, which is enough
// to safely match it against that unit-group's cells across multiple cited
// rows without a column hint (fix 6). Bare numbers and "N times"/"N×" have no
// such neighbor and so get no multi-row cell route, by design.
function unitFromWord(word) {
  const w = word.toLowerCase();
  if (/^lb/.test(w) || /^pound/.test(w)) return 'lb';
  if (/^sq/.test(w) || /^square/.test(w) || /^ft/.test(w)) return 'sqft';
  return null;
}

function detectAdjacentUnit(text, token) {
  if (!text) return null;
  const before = text.slice(Math.max(0, token.index - 3), token.index);
  const after = text.slice(token.index + token.raw.length, token.index + token.raw.length + 40);
  if (/\$\s*$/.test(before)) return 'usd';
  if (/^\s*(lbs?\.?|pounds?)\s*(?:per|\/)\s*1,?000\b/i.test(after)) return 'lb_per_1000';
  if (/^\s*(lbs?\.?|pounds?)\b/i.test(after)) return 'lb';
  if (/^\s*(sq\.?\s?f(?:ee|oo)?t\.?|square\s+feet|ft\s*[²2])\b/i.test(after)) return 'sqft';
  // Fix 4: unit inheritance — "N vs. M unit" / "N and M unit" / "N or M unit"
  // gives N the SAME unit as M, since the unit is written once for the pair.
  const pairMatch = after.match(/^\s*(?:vs\.?|and|or)\s*[\d,]+(?:\.\d+)?\s*(lbs?\.?|pounds?|sq\.?\s?f(?:ee|oo)?t\.?|square\s+feet|ft\s*[²2])\b/i);
  if (pairMatch) return unitFromWord(pairMatch[1]);
  return null;
}

// A claim number that appears as a token embedded in a non-numeric text
// column ("Kentucky 31" in `product`) of a cited row is a real, unambiguous
// match — the number names the row, it doesn't describe a data value (fix 3).
function checkTextCellMatch(numberToken, rows, textColumns) {
  if (numberToken.type === 'range') return false;
  for (const row of rows) {
    for (const col of textColumns) {
      const cellText = row[col];
      if (!cellText) continue;
      for (const t of extractNumberTokens(cellText)) {
        if (t.canonical === numberToken.canonical) return true;
      }
    }
  }
  return false;
}

function checkCsvPlain(numberToken, rows, cols, textColumns, hintGroups, claimText) {
  const target = numberToken.value;
  const places = decimalPlaces(numberToken.raw);
  const isMultiRow = rows.length > 1;

  // 1. cell value
  if (!isMultiRow) {
    for (const row of rows) {
      for (const col of cols) {
        const v = parseNumericCell(row[col]);
        if (v !== null && Math.abs(v - target) < 1e-6) return { matched: true, via: 'cell' };
      }
    }
  } else {
    // multi-row: a hinted group's own rows/column (fix 7 + fix 12: hint narrows only this route)
    for (const g of hintGroups) {
      if (!g.hint) continue;
      for (const row of g.rows) {
        const v = parseNumericCell(row[g.hint]);
        if (v !== null && Math.abs(v - target) < 1e-6) return { matched: true, via: 'cell' };
      }
    }
    // multi-row, no hint needed: an adjacent unit in the claim text disambiguates the column (fix 6)
    const adjUnit = detectAdjacentUnit(claimText, numberToken);
    if (adjUnit) {
      for (const row of rows) {
        for (const col of cols) {
          if (columnUnit(col) !== adjUnit) continue;
          const v = parseNumericCell(row[col]);
          if (v !== null && Math.abs(v - target) < 1e-6) return { matched: true, via: `cell (${col})` };
        }
      }
    }
  }

  // text-cell match always runs, single or multi row, hint or not (fix 3, fix 12)
  if (checkTextCellMatch(numberToken, rows, textColumns)) {
    return { matched: true, via: 'text cell' };
  }

  // row count
  if (rows.length === target) return { matched: true, via: 'row-count' };

  // single-row ratio a/b (spec §5: "ratio of two cited columns")
  if (rows.length === 1) {
    const row = rows[0];
    for (const a of cols) {
      const va = parseNumericCell(row[a]);
      if (va === null) continue;
      for (const b of cols) {
        if (a === b || !sameUnit(a, b)) continue;
        const vb = parseNumericCell(row[b]);
        if (vb === null || vb === 0) continue;
        if (roundTo(va / vb, places) === roundTo(target, places)) {
          return { matched: true, via: `ratio ${a}/${b}` };
        }
      }
    }
    if (derivedFormulaProbe(row, target, places)) {
      return { matched: false, gap: 'derived-formula' };
    }
  }

  // multi-row min/max of ratio a/b
  if (rows.length > 1) {
    for (const a of cols) {
      for (const b of cols) {
        if (a === b || !sameUnit(a, b)) continue;
        const ratios = rows
          .map((r) => {
            const va = parseNumericCell(r[a]);
            const vb = parseNumericCell(r[b]);
            return va !== null && vb !== null && vb !== 0 ? va / vb : null;
          })
          .filter((v) => v !== null);
        if (!ratios.length) continue;
        const mn = Math.min(...ratios), mx = Math.max(...ratios);
        if (roundTo(mn, places) === roundTo(target, places)) return { matched: true, via: `multirow ratio ${a}/${b} (min)` };
        if (roundTo(mx, places) === roundTo(target, places)) return { matched: true, via: `multirow ratio ${a}/${b} (max)` };
      }
    }
  }

  return { matched: false };
}

// A claim range ("2.0 to 3.3") passes single-row only if BOTH ends are cell
// values in that one row (hint, if any, narrows which columns are checked —
// this is still the "cell route", fix 12); multi-row if the SAME column
// pair's ratio produces that exact min AND max (fix 8: also true if ONE
// column's own raw values, across the cited rows, have that min and max).
function checkCsvRange(numberToken, rows, cols, columnHint) {
  const places = decimalPlaces(numberToken.raw);

  if (rows.length === 1) {
    const row = rows[0];
    const candidateCols = columnHint ? [columnHint] : cols;
    let minFound = false, maxFound = false;
    for (const col of candidateCols) {
      const v = parseNumericCell(row[col]);
      if (v === null) continue;
      if (Math.abs(v - numberToken.min) < 1e-6) minFound = true;
      if (Math.abs(v - numberToken.max) < 1e-6) maxFound = true;
    }
    return minFound && maxFound ? { matched: true, via: 'cell (range)' } : { matched: false };
  }

  // single-column min/max across the cited rows (fix 8)
  for (const col of cols) {
    const vals = rows.map((r) => parseNumericCell(r[col])).filter((v) => v !== null);
    if (!vals.length) continue;
    const mn = Math.min(...vals), mx = Math.max(...vals);
    if (roundTo(mn, places) === roundTo(numberToken.min, places) && roundTo(mx, places) === roundTo(numberToken.max, places)) {
      return { matched: true, via: `multirow column min/max (${col})` };
    }
  }

  // ratio-of-two-same-unit-columns min/max across the cited rows
  for (const a of cols) {
    for (const b of cols) {
      if (a === b || !sameUnit(a, b)) continue;
      const ratios = rows
        .map((r) => {
          const va = parseNumericCell(r[a]);
          const vb = parseNumericCell(r[b]);
          return va !== null && vb !== null && vb !== 0 ? va / vb : null;
        })
        .filter((v) => v !== null);
      if (!ratios.length) continue;
      const mn = Math.min(...ratios), mx = Math.max(...ratios);
      if (roundTo(mn, places) === roundTo(numberToken.min, places) && roundTo(mx, places) === roundTo(numberToken.max, places)) {
        return { matched: true, via: `multirow ratio ${a}/${b} (range)` };
      }
    }
  }
  return { matched: false };
}

function checkCsvSingleNumber(numberToken, rows, numericColumns, textColumns, hintGroups, columnHint, claimText) {
  const cols = numericColumns.filter((c) => c !== 'id');
  if (numberToken.type === 'range') return checkCsvRange(numberToken, rows, cols, columnHint);
  return checkCsvPlain(numberToken, rows, cols, textColumns, hintGroups, claimText);
}

function checkCsv(parsed, claimNumbers, resolved, claimText) {
  const { header, idToRow, numericColumns } = parseCsv(resolved.path);
  const groupsSpec = parsed.rowSpec ? (parsed.rowSpec.groups || [{ ids: parsed.rowSpec.ids, hint: parsed.rowSpec.columnHint }]) : [];
  const allIds = parsed.rowSpec ? parsed.rowSpec.ids : [];
  const missing = allIds.filter((id) => !idToRow.has(id));
  if (missing.length) {
    return { status: 'FAIL', reason: 'row id not found in CSV', detail: missing.join(',') };
  }
  const rows = allIds.map((id) => idToRow.get(id));
  const hintGroups = groupsSpec.map((g) => ({
    rows: g.ids.map((id) => idToRow.get(id)),
    hint: g.hint && numericColumns.includes(g.hint) ? g.hint : null,
  }));
  // single-clause citations still get the range-mode "narrow to this column" behavior
  const singleHint = groupsSpec.length === 1 ? hintGroups[0].hint : null;
  const textColumns = header.filter((h) => !numericColumns.includes(h) && h !== 'id');

  let derivedGap = false;
  const routes = [];
  for (const num of claimNumbers) {
    const result = checkCsvSingleNumber(num, rows, numericColumns, textColumns, hintGroups, singleHint, claimText);
    if (result.matched) { routes.push(result.via); continue; }
    if (result.gap === 'derived-formula') { derivedGap = true; continue; }
    return { status: 'FAIL', reason: 'number not derivable from cited rows', detail: num.raw };
  }
  if (derivedGap) return { status: 'UNVERIFIABLE', reason: 'derived formula not covered by v1' };
  return { status: 'PASS', mode: 'data', route: routes.join(', ') || 'no numbers checked' };
}

function checkJson(claimNumbers, resolved) {
  const numberSet = flattenJsonNumbers(resolved.path);
  for (const num of claimNumbers) {
    if (!jsonHasNumber(num, numberSet)) {
      return { status: 'FAIL', reason: 'number not in file', detail: num.raw };
    }
  }
  return { status: 'PASS', mode: 'data', route: 'json value' };
}

// Independent of which member ends up supporting which claim number, every
// member of a group must be structurally sound on its own: file exists,
// page range not absurd, cited CSV rows exist, and — for a quote-mode member
// — its own excerpt is actually on its own page. A structural failure in any
// one member fails the whole group; it is never rescued by another member
// happening to support the same numbers.
function checkTargetStructure(parsed, resolved) {
  if (resolved.kind === 'notfound') return { ok: false, reason: 'file not found', detail: resolved.raw };
  if (parsed.rangeTooWide) return { ok: false, reason: 'page range too wide' };
  if (resolved.kind === 'csv') {
    const { idToRow } = parseCsv(resolved.path);
    const ids = parsed.rowSpec ? parsed.rowSpec.ids : [];
    const missing = ids.filter((id) => !idToRow.has(id));
    if (missing.length) return { ok: false, reason: 'row id not found in CSV', detail: missing.join(',') };
  }
  if (resolved.kind === 'pdf') {
    const pages = [...parsed.pages].sort((a, b) => a - b);
    const rangeError = checkPageRange(resolved.path, pages);
    if (rangeError) return { ok: false, ...rangeError };
    const qualifyingQuotes = parsed.quotes.filter((q) => q.trim().split(/\s+/).filter(Boolean).length >= 4);
    if (qualifyingQuotes.length > 0) {
      const textLayerPages = pages.filter((p) => isTextLayer(getPdfPageTextPlain(resolved.path, p)));
      if (textLayerPages.length > 0) {
        for (const q of qualifyingQuotes) {
          const qNorm = normalizeTextForMatch(q);
          const found = textLayerPages.some((p) => matchExcerpt(normalizeTextForMatch(getPdfPageTextPlain(resolved.path, p)), qNorm));
          if (!found) {
            const foundPage = findExcerptOnOtherPages(resolved.path, pages, qNorm);
            const detail = q + (foundPage ? ` (found on p.${foundPage})` : '');
            return { ok: false, reason: 'quote not on page', detail };
          }
        }
      }
      // no text-layer page at all: deferred to per-number checking, which
      // reports it as UNVERIFIABLE (scanned-pdf), not a structural FAIL.
    }
  }
  return { ok: true };
}

// Fix 2 (v1.3): adjacent src comments (nothing but whitespace between them)
// describe the same claim segment as a GROUP, not independently — each
// carries its own target, and a claim number is verified if ANY target in
// the group supports it. Structural validity (above) is checked for every
// member regardless of any-of matching; only the per-number "does this
// value appear" step is any-of. Every unsupported number is collected, not
// just the first, so the FAIL detail names all of them at once.
function checkCitationGroup(parsedList, resolvedList, signoffList, claimNumbers, claimText) {
  // A single-member "group" is just a citation — delegate immediately and
  // identically to the pre-fix-2 behavior. This must come before the
  // empty-claim short-circuit below: checkCitation's own notfound/
  // rangeTooWide checks run regardless of claim number count, and skipping
  // straight to NO-NUMBER here would hide a bad filename behind an empty
  // claim (confirmed by W3/W4/W5 regressing when this was ordered wrong).
  if (resolvedList.length === 1) {
    return checkCitation(parsedList[0], claimNumbers, resolvedList[0], signoffList[0], claimText);
  }

  // Multi-member groups: structural validity is checked for every member
  // before anything else, including before the empty-claim short-circuit.
  for (let i = 0; i < resolvedList.length; i++) {
    const structural = checkTargetStructure(parsedList[i], resolvedList[i]);
    if (!structural.ok) {
      const detail = `${parsedList[i].target}: ${structural.detail || ''}`.trim().replace(/:$/, '');
      return { status: 'FAIL', reason: structural.reason, detail };
    }
  }

  if (claimNumbers.length === 0) {
    const allReference = resolvedList.every((r) => r.kind === 'reference');
    return { status: allReference ? 'REFERENCE' : 'NO-NUMBER' };
  }

  const perNumber = [];
  const unsupported = [];
  let sawUnverifiable = null;
  for (const num of claimNumbers) {
    let matched = null;
    let localUnverifiable = null;
    for (let i = 0; i < resolvedList.length; i++) {
      const single = checkCitation(parsedList[i], [num], resolvedList[i], signoffList[i], claimText);
      if (single.status === 'PASS') { matched = { target: parsedList[i].target }; break; }
      if (single.status === 'UNVERIFIABLE' && !localUnverifiable) localUnverifiable = single;
    }
    if (matched) { perNumber.push({ num: num.raw, target: matched.target }); continue; }
    if (localUnverifiable) { if (!sawUnverifiable) sawUnverifiable = localUnverifiable; continue; }
    unsupported.push(num.raw);
  }
  if (unsupported.length) {
    return { status: 'FAIL', reason: 'number not supported by any source in the group', detail: unsupported.join(', ') };
  }
  if (sawUnverifiable) return { status: 'UNVERIFIABLE', reason: sawUnverifiable.reason };
  return { status: 'PASS', mode: 'group', perNumber };
}

function checkCitation(parsed, claimNumbers, resolved, signoff, claimText) {
  if (resolved.kind === 'notfound') return { status: 'FAIL', reason: 'file not found', detail: resolved.raw };
  if (parsed.rangeTooWide) return { status: 'FAIL', reason: 'page range too wide' };

  if (resolved.kind === 'reference') {
    if (claimNumbers.length === 0) return { status: 'REFERENCE' };
    if (signoff) return { status: 'PASS', mode: 'signed-off', signoff };
    return { status: 'UNVERIFIABLE', reason: 'reference-numeric' };
  }

  if (resolved.kind === 'pdf') {
    // A quoted fragment under 4 words (e.g. "instant lawn") is decorative,
    // not a verbatim excerpt to test claim numbers against — treat it as
    // plain text and fall through to Numbers mode instead (fix 9).
    const qualifyingQuotes = parsed.quotes.filter((q) => q.trim().split(/\s+/).filter(Boolean).length >= 4);
    if (qualifyingQuotes.length > 0) {
      return checkQuoteMode({ ...parsed, quotes: qualifyingQuotes }, claimNumbers, resolved);
    }
    if (claimNumbers.length === 0) return { status: 'NO-NUMBER' };
    return checkNumbersModePdf(parsed, claimNumbers, resolved);
  }

  if (resolved.kind === 'sources_md' || resolved.kind === 'repo_md') {
    if (claimNumbers.length === 0) return { status: 'NO-NUMBER' };
    return checkNumbersModeWholeFile(claimNumbers, resolved);
  }

  if (resolved.kind === 'csv') {
    if (claimNumbers.length === 0) return { status: 'NO-NUMBER' };
    return checkCsv(parsed, claimNumbers, resolved, claimText);
  }

  if (resolved.kind === 'json') {
    if (claimNumbers.length === 0) return { status: 'NO-NUMBER' };
    return checkJson(claimNumbers, resolved);
  }

  return { status: 'FAIL', reason: 'unresolvable target' };
}

// ---------------------------------------------------------------------------
// Table row-attribution convention (fix 1)
// ---------------------------------------------------------------------------

// A src comment adjacent to a table row can mean "describes the row that
// follows" (before) or "describes the row that just closed" (after) — both
// conventions are used across these guides. The only structurally
// unambiguous evidence is at the table's edges: a comment before the very
// first <tr> can only be a "before" citation (there is no prior row it could
// be "after"); a comment after the very last </tr>, with no further row,
// can only be an "after" citation. A table showing both kinds of edge
// evidence, or neither, can't be resolved from structure alone — unless the
// table declares its own convention via `data-src-convention="before|after"`
// (fix 1, v1.3), which always wins over detection.
function detectTableConventions(tokens, trSpans) {
  const tableSpans = findSpans(tokens, 'table');
  const tableOpenAttrs = new Map();
  for (const t of tokens) {
    if (t.kind === 'open' && t.name === 'table') tableOpenAttrs.set(t.start, t.attrs);
  }
  const srcComments = tokens.filter((t) => t.kind === 'comment' && t.content.trim().startsWith('src:'));
  const conventions = [];
  for (const tbl of tableSpans) {
    const trsInTable = trSpans
      .filter((s) => s.openStart >= tbl.start && s.closeEnd <= tbl.end)
      .sort((a, b) => a.openStart - b.openStart);
    if (!trsInTable.length) continue;

    const attrs = tableOpenAttrs.get(tbl.openStart) || '';
    const declared = attrs.match(/data-src-convention\s*=\s*"(before|after)"/i);
    if (declared) {
      conventions.push({ start: tbl.start, end: tbl.end, trs: trsInTable, convention: declared[1].toLowerCase(), source: 'declared' });
      continue;
    }

    const firstTr = trsInTable[0];
    const lastTr = trsInTable[trsInTable.length - 1];
    const beforeEvidence = srcComments.some((c) => c.start >= tbl.start && c.start < firstTr.openStart);
    const afterEvidence = srcComments.some((c) => c.start >= lastTr.closeEnd && c.start < tbl.end);
    let convention;
    if (beforeEvidence && afterEvidence) convention = 'ambiguous';
    else if (beforeEvidence) convention = 'before';
    else if (afterEvidence) convention = 'after';
    else convention = 'ambiguous';
    conventions.push({ start: tbl.start, end: tbl.end, trs: trsInTable, convention, source: convention === 'ambiguous' ? 'ambiguous' : 'detected' });
  }
  return conventions;
}

// ---------------------------------------------------------------------------
// Page (file) processing
// ---------------------------------------------------------------------------

function processFile(filePath, ctx) {
  const html = fs.readFileSync(filePath, 'utf8');
  const tokens = tokenize(html);
  const lineOf = buildLineIndex(html);

  const blockSpans = [];
  for (const tag of BLOCK_TAGS) blockSpans.push(...findSpans(tokens, tag));
  const trSpans = findSpans(tokens, 'tr');
  const suppressSpans = [];
  for (const tag of SUPPRESS_TAGS) {
    for (const s of findSpans(tokens, tag)) suppressSpans.push({ ...s, tag });
  }

  function findInnermostBlock(pos) {
    let best = null;
    for (const s of blockSpans) {
      if (pos >= s.start && pos < s.end) {
        if (!best || s.end - s.start < best.end - best.start) best = s;
      }
    }
    return best;
  }

  const srcComments = tokens.filter((t) => t.kind === 'comment' && t.content.trim().startsWith('src:'));
  const tableConventions = detectTableConventions(tokens, trSpans);
  function findEnclosingTable(pos) {
    return tableConventions.find((t) => pos >= t.start && pos < t.end) || null;
  }

  // Fix 2 (v1.3): adjacent src comments (nothing but whitespace between them)
  // are one citation GROUP sharing one claim segment, not independent
  // citations. A run breaks at real text OR at a `verified:` sign-off
  // comment (which applies to one specific citation, not a shared group).
  const runs = [];
  for (const c of srcComments) {
    const last = runs.length ? runs[runs.length - 1] : null;
    if (last && html.slice(last[last.length - 1].end, c.start).trim() === '') {
      last.push(c);
    } else {
      runs.push([c]);
    }
  }

  const groups = new Map(); // key -> {kind, span, citations: [run, run, ...]}
  const tokenIndexOf = new Map();
  tokens.forEach((t, i) => tokenIndexOf.set(t, i));

  for (const run of runs) {
    const pos = run[0].start;
    const block = findInnermostBlock(pos);
    let key, kind, span;
    // A comment inside a <tr> but outside any cell (e.g. right after <tr> or
    // between two <td>s) unambiguously describes that row — no table
    // convention needed at all (fix 1, v1.3).
    const enclosingTr = trSpans.find((s) => pos >= s.start && pos < s.end);
    if (block) {
      kind = 'block';
      span = block;
      key = `block:${span.start}:${span.end}`;
    } else if (enclosingTr) {
      kind = 'row';
      span = enclosingTr;
      key = `row:${span.start}:${span.end}`;
    } else {
      const table = findEnclosingTable(pos);
      let rowSpan = null;
      let ambiguous = false;
      if (table) {
        if (table.convention === 'before') {
          rowSpan = table.trs.find((s) => s.openStart > pos) || null;
        } else if (table.convention === 'after') {
          const priorRows = table.trs.filter((s) => s.closeEnd <= pos);
          rowSpan = priorRows.length ? priorRows[priorRows.length - 1] : null;
        } else {
          ambiguous = true;
        }
      }
      if (ambiguous) {
        kind = 'ambiguous';
        span = null;
        key = `ambiguous:${pos}`;
      } else if (rowSpan) {
        kind = 'row';
        span = rowSpan;
        key = `row:${span.start}:${span.end}`;
      } else {
        kind = 'loose';
        span = null;
        key = `loose:${pos}`;
      }
    }
    if (!groups.has(key)) groups.set(key, { kind, span, citations: [] });
    groups.get(key).citations.push(run);
  }

  const citations = [];
  for (const group of groups.values()) {
    group.citations.sort((a, b) => a[0].start - b[0].start);
    const isSpanless = group.kind === 'loose' || group.kind === 'ambiguous';
    let prevEnd = isSpanless ? null : group.span.start;
    group.citations.forEach((run, i) => {
      const runStart = run[0].start;
      const runEnd = run[run.length - 1].end;
      let claimStart, claimEnd;
      if (group.kind === 'row') {
        claimStart = i === 0 ? group.span.start : group.span.end;
        claimEnd = group.span.end;
      } else if (group.kind === 'block') {
        claimStart = i === 0 ? group.span.start : prevEnd;
        claimEnd = runStart;
        prevEnd = runEnd;
      } else {
        claimStart = runStart;
        claimEnd = runStart;
      }
      const lastIdx = tokenIndexOf.get(run[run.length - 1]);
      const next = tokens[lastIdx + 1];
      let signoff = null;
      if (next && next.kind === 'comment') {
        const t = next.content.trim();
        const m = t.match(/^verified:\s*(\S+)\s+(\d{4}-\d{2}-\d{2})/);
        if (m) signoff = { name: m[1], date: m[2] };
      }
      citations.push({
        line: lineOf(runStart),
        claimStart,
        claimEnd,
        rawContents: run.map((c) => c.content.trim().replace(/^src:\s*/, '')),
        signoff,
        ambiguous: group.kind === 'ambiguous',
      });
    });
  }

  const consumedRanges = [];
  const pageIgnored = [];
  const pageDetail = {
    passQuote: 0, passNumbers: 0, passData: 0, passGroup: 0, signedOff: 0,
    passDetail: [], noNumber: [], reference: 0, unverifiable: [], fail: [], uncited: [],
  };

  for (const cit of citations) {
    if (cit.claimStart < cit.claimEnd) consumedRanges.push([cit.claimStart, cit.claimEnd]);
    const claimTextRaw = html.slice(cit.claimStart, cit.claimEnd);
    const claimText = stripTagsAndDecode(claimTextRaw);
    const { found, ignored } = scanNumbers(claimText, { classify: true });
    for (const ig of ignored) pageIgnored.push({ ...ig, line: cit.line });

    const parsedList = cit.rawContents.map((raw) => parseCitationRaw(raw));
    const resolvedList = parsedList.map((p) => resolveTarget(p.target, ctx));
    const signoffList = parsedList.map(() => cit.signoff);
    const result = cit.ambiguous
      ? { status: 'UNVERIFIABLE', reason: 'row attribution ambiguous' }
      : checkCitationGroup(parsedList, resolvedList, signoffList, found, claimText);

    const claimSnippet = truncate(claimText || '(empty)');
    const source = parsedList.map((p) => p.target).join(' + ');
    const allPages = [...new Set(parsedList.flatMap((p) => [...p.pages]))].sort((a, b) => a - b);
    const pagesStr = allPages.join(', ');

    switch (result.status) {
      case 'PASS': {
        let routeStr = '';
        if (result.mode === 'quote') { pageDetail.passQuote++; routeStr = `p.${result.page}`; }
        else if (result.mode === 'numbers') { pageDetail.passNumbers++; routeStr = result.wholeFile ? 'whole file' : `p.${(result.pages || []).join(',')}`; }
        else if (result.mode === 'data') { pageDetail.passData++; routeStr = result.route || ''; }
        else if (result.mode === 'signed-off') {
          pageDetail.signedOff++;
          routeStr = `signed off by ${result.signoff.name} ${result.signoff.date}`;
        } else if (result.mode === 'group') {
          pageDetail.passGroup++;
          routeStr = result.perNumber.map((p) => `${p.num}→${p.target}`).join(', ');
        }
        pageDetail.passDetail.push({ line: cit.line, mode: result.mode, source, route: routeStr });
        break;
      }
      case 'NO-NUMBER':
        pageDetail.noNumber.push({ line: cit.line, claim: claimSnippet, source, page: pagesStr });
        break;
      case 'REFERENCE':
        pageDetail.reference++;
        break;
      case 'UNVERIFIABLE':
        pageDetail.unverifiable.push({ line: cit.line, claim: claimSnippet, source, page: pagesStr, reason: result.reason });
        break;
      case 'FAIL':
        pageDetail.fail.push({
          line: cit.line, claim: claimSnippet, source, page: pagesStr,
          reason: result.reason, detail: result.detail,
        });
        break;
      default:
        pageDetail.fail.push({ line: cit.line, claim: claimSnippet, source, page: pagesStr, reason: 'unknown result' });
    }
  }

  // Uncited scan: every block span minus consumed (claimed) ranges
  for (const span of blockSpans) {
    const text = html.slice(span.start, span.end);
    const chars = text.split('');
    for (const [s, e] of consumedRanges) {
      const rs = Math.max(s, span.start) - span.start;
      const re = Math.min(e, span.end) - span.start;
      if (rs < re) for (let i = rs; i < re; i++) chars[i] = ' ';
    }
    const masked = stripTagsAndDecode(chars.join(''));
    const { found, ignored } = scanNumbers(masked, { classify: true });
    for (const ig of ignored) pageIgnored.push({ ...ig, line: lineOf(span.start) });
    for (const num of found) {
      pageDetail.uncited.push({ line: lineOf(span.start), text: truncate(stripTagsAndDecode(text)), number: num.raw });
    }
  }

  // Suppressed regions (script/style/nav/header/footer): report their numbers as ignored
  for (const s of suppressSpans) {
    const text = html.slice(s.openStart, s.closeEnd).replace(/<[^>]*>/g, ' ');
    const { found } = scanNumbers(text, { classify: false });
    for (const num of found) {
      pageIgnored.push({
        raw: num.raw,
        reason: s.tag === 'script' || s.tag === 'style' ? 'script/style' : 'nav/header/footer',
        line: lineOf(s.openStart),
      });
    }
  }

  // href attribute numbers
  for (const t of tokens) {
    if (t.kind !== 'open') continue;
    const hrefMatch = t.attrs.match(/href\s*=\s*"([^"]*)"/);
    if (!hrefMatch) continue;
    const { found } = scanNumbers(hrefMatch[1], { classify: false });
    for (const num of found) pageIgnored.push({ raw: num.raw, reason: 'href', line: lineOf(t.start) });
  }

  let numbersFound = 0;
  for (const cit of citations) {
    const claimText = stripTagsAndDecode(html.slice(cit.claimStart, cit.claimEnd));
    numbersFound += scanNumbers(claimText, { classify: true }).found.length;
  }
  numbersFound += pageDetail.uncited.length;

  return {
    file: path.basename(filePath),
    claims: citations.length,
    numbers: numbersFound,
    ignored: pageIgnored,
    passQuote: pageDetail.passQuote,
    passNumbers: pageDetail.passNumbers,
    passData: pageDetail.passData,
    passGroup: pageDetail.passGroup,
    signedOff: pageDetail.signedOff,
    passDetail: pageDetail.passDetail,
    noNumber: pageDetail.noNumber,
    reference: pageDetail.reference,
    unverifiable: pageDetail.unverifiable,
    fail: pageDetail.fail,
    uncited: pageDetail.uncited,
    tableConventions: tableConventions.map((t) => ({ line: lineOf(t.start), convention: t.convention, source: t.source })),
  };
}

// ---------------------------------------------------------------------------
// Report rendering
// ---------------------------------------------------------------------------

function renderReport(fileResults, { quiet = false } = {}) {
  const lines = [];
  const hash = crypto.createHash('sha256').update(fs.readFileSync(SCRIPT_PATH)).digest('hex');
  let commit = 'unknown', dirty = false;
  try {
    commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
    const status = execFileSync('git', ['status', '--porcelain'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
    dirty = status.length > 0;
  } catch { /* not fatal */ }
  const sourceCount = fs.readdirSync(SOURCES_DIR).length;

  lines.push(`CITATION CHECK  ${new Date().toISOString()}`);
  lines.push(`checker sha256: ${hash}`);
  lines.push(`repo commit:    ${commit}  (dirty: ${dirty ? 'yes' : 'no'})`);
  lines.push(`sources:        ${sourceCount} files in ${SOURCES_DIR}`);
  lines.push('');

  let totalPass = 0, totalNoNumber = 0, totalReference = 0, totalUnverifiable = 0,
    totalSignedOff = 0, totalFail = 0, totalUncited = 0;

  for (const r of fileResults) {
    lines.push(`PAGE ${r.file}`);
    if (r.tableConventions.length) {
      lines.push('  -- table row-attribution convention:');
      for (const t of r.tableConventions) {
        lines.push(`     L${t.line} <table> -> ${t.convention} (${t.source})`);
      }
    }
    lines.push(`  claims: ${r.claims}   numbers: ${r.numbers}   ignored: ${r.ignored.length}`);
    lines.push(`  PASS quote:    ${r.passQuote}`);
    lines.push(`  PASS numbers:  ${r.passNumbers}`);
    lines.push(`  PASS data:     ${r.passData}`);
    lines.push(`  PASS group:    ${r.passGroup}`);
    lines.push(`  NO-NUMBER:     ${r.noNumber.length}`);
    lines.push(`  REFERENCE:     ${r.reference}`);
    lines.push(`  UNVERIFIABLE:  ${r.unverifiable.length}`);
    lines.push(`  FAIL:          ${r.fail.length}`);
    lines.push(`  UNCITED:       ${r.uncited.length}`);

    if (r.fail.length) {
      lines.push('  -- FAIL detail:');
      for (const f of r.fail) {
        lines.push(`     L${f.line} "${f.claim}" | ${f.source}${f.page ? ' p.' + f.page : ''} | ${f.reason}${f.detail ? ': ' + f.detail : ''}`);
      }
    }
    if (r.noNumber.length && !quiet) {
      lines.push('  -- NO-NUMBER detail:');
      for (const n of r.noNumber) {
        lines.push(`     L${n.line} "${n.claim}" | ${n.source}${n.page ? ' p.' + n.page : ''}`);
      }
    }
    if (r.uncited.length) {
      lines.push('  -- UNCITED detail:');
      for (const u of r.uncited) {
        lines.push(`     L${u.line} "${u.text}" | number: ${u.number}`);
      }
    }
    if (r.ignored.length && !quiet) {
      lines.push('  -- IGNORED detail:');
      for (const ig of r.ignored) {
        lines.push(`     L${ig.line} ${ig.raw} | reason: ${ig.reason}`);
      }
    }
    if (r.unverifiable.length) {
      lines.push('  -- SPOT-CHECK list:');
      for (const u of r.unverifiable) {
        lines.push(`     L${u.line} "${u.claim}" | ${u.source}${u.page ? ' p.' + u.page : ''} | reason: ${u.reason}`);
      }
    }
    if (r.passDetail.length && !quiet) {
      lines.push('  -- PASS detail:');
      for (const p of r.passDetail) {
        lines.push(`     L${p.line} ${p.mode} | ${p.source} | ${p.route}`);
      }
    }
    lines.push('');

    totalPass += r.passQuote + r.passNumbers + r.passData + r.passGroup + r.signedOff;
    totalNoNumber += r.noNumber.length;
    totalReference += r.reference;
    totalUnverifiable += r.unverifiable.length;
    totalSignedOff += r.signedOff;
    totalFail += r.fail.length;
    totalUncited += r.uncited.length;
  }

  const numericReferenceUnsigned = fileResults.reduce(
    (sum, r) => sum + r.unverifiable.filter((u) => u.reason === 'reference-numeric').length, 0
  );
  const result = totalFail === 0 && totalUncited === 0 && numericReferenceUnsigned === 0 ? 'PASS' : 'FAIL';

  lines.push(
    `TOTAL  pass ${totalPass} | no-number ${totalNoNumber} | reference ${totalReference} | ` +
    `unverifiable ${totalUnverifiable} (signed off ${totalSignedOff}) | fail ${totalFail} | uncited ${totalUncited}`
  );
  lines.push(`RESULT: ${result}`);

  return { text: lines.join('\n'), result };
}

// ---------------------------------------------------------------------------
// Exports (for the test harness) + CLI entry
// ---------------------------------------------------------------------------

export {
  scanNumbers, extractNumberTokens, tokenize, findSpans, parseCitationRaw, resolveTarget,
  buildResolutionContext, processFile, renderReport, getPdfPageTextLayout, getPdfPageTextPlain, getPdfPageCount,
  parseCsv, parseNumericCell, flattenJsonNumbers, stripTagsAndDecode,
  normalizeTextForMatch, matchExcerpt, checkCitation, isTextLayer,
};

function discoverFiles(argv) {
  if (argv.length > 0) {
    return argv.map((f) => (path.isAbsolute(f) ? f : path.resolve(REPO_ROOT, f)));
  }
  return fs.readdirSync(REPO_ROOT)
    .filter((f) => f.endsWith('.html'))
    .filter((f) => fs.statSync(path.join(REPO_ROOT, f)).isFile())
    .map((f) => path.join(REPO_ROOT, f));
}

function main() {
  const args = process.argv.slice(2);
  const quiet = args.includes('--quiet');
  const fileArgs = args.filter((a) => a !== '--quiet');
  const files = discoverFiles(fileArgs);
  const ctx = buildResolutionContext();
  const results = files.map((f) => processFile(f, ctx));
  const { text, result } = renderReport(results, { quiet });
  console.log(text);
  process.exitCode = result === 'PASS' ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main();
}
