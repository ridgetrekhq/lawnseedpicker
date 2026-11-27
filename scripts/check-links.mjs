#!/usr/bin/env node
// check-links.mjs — automatic link checks for LawnSeedPicker.com.
// Node built-ins only. Never contacts Amazon or any other website: every check
// reads the files in this repo.
//
// Amazon links (HTML pages and tool scripts):
//   A1  every Amazon link carries a tracking ID (tag=...)
//   A2  the tracking ID is the right one for the file (scripts/link-rules.json)
//   A3  the ASIN is on the approved list in scripts/link-rules.json
//   A4  HTML Amazon links have rel="sponsored" (and "noopener" with target=_blank)
//   A5  no dollar amount inside Amazon link text (Associates price rule)
//   A6  Amazon links point at a product (/dp/ or /gp/product/), not search pages;
//       amzn.to short links are refused because their product can't be checked
// Internal links:
//   I1  every href/src to a page or file on this site resolves to a real file
//   I2  every #anchor on an internal link exists on the target page
//   I3  every lawnseedpicker.com URL in sitemap.xml, llms.txt and feed.xml resolves
// Warnings (do not fail the run):
//   W1  an approved ASIN that no page uses any more
//
// Usage: node scripts/check-links.mjs [--quiet]
// Exit code 0 = no errors, 1 = errors found.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_HOSTS = ['lawnseedpicker.com', 'www.lawnseedpicker.com'];

// ---------------------------------------------------------------- helpers
export function lineOf(text, index) {
  let n = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#38;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** Replace JS comments with spaces (keeps offsets and line numbers). Strings are respected. */
export function blankJsComments(src) {
  let out = '';
  let i = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') { out += src[i + 1] ?? ''; i += 2; continue; }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += c; i++; continue; }
    if (c === '/' && d === '/') {
      while (i < src.length && src[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    if (c === '/' && d === '*') {
      out += '  '; i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; }
      out += '  '; i += 2;
      continue;
    }
    out += c; i++;
  }
  return out;
}

/** Blank out HTML comments, keeping offsets. */
export function blankHtmlComments(src) {
  return src.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
}

/** Parse the attributes of one HTML start tag. */
export function attrs(tag) {
  const out = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  const body = tag.replace(/^<[a-zA-Z0-9]+/, '').replace(/\/?>$/, '');
  let m;
  while ((m = re.exec(body))) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  return out;
}

export function tagFor(relFile, rules) {
  for (const r of rules.tagByFile || []) if (new RegExp(r.match).test(relFile)) return r.tag;
  return rules.defaultTag;
}

/** Classify one Amazon URL. Returns { asin, tag, kind } where kind is product|short|other. */
export function parseAmazon(url) {
  const u = decode(url);
  if (/^https?:\/\/(www\.)?amzn\.to\//i.test(u)) return { kind: 'short', asin: null, tag: null };
  const asin = (u.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?=[/?#&]|$)/) || [])[1] || null;
  const tag = (u.match(/[?&]tag=([^&#]+)/) || [])[1] || null;
  return { kind: asin ? 'product' : 'other', asin, tag };
}

const AMAZON_RE = /https?:\/\/(?:www\.)?(?:amazon\.com|amzn\.to)[^\s"'`<>)]*/gi;

// ---------------------------------------------------------------- file walk
export function walk(root, skipDirs) {
  const out = [];
  const skip = new Set(skipDirs);
  (function rec(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name);
      const rel = path.relative(root, abs).split(path.sep).join('/');
      if (ent.isDirectory()) { if (!skip.has(rel) && !skip.has(ent.name)) rec(abs); continue; }
      out.push(rel);
    }
  })(root);
  return out.sort();
}

// ---------------------------------------------------------------- internal link resolution
/** Map a site path (no host) to a repo file, the way Cloudflare Pages serves it. */
export function resolveSitePath(sitePath, exists) {
  let p = sitePath.split('#')[0].split('?')[0];
  try { p = decodeURIComponent(p); } catch { /* keep raw */ }
  p = p.replace(/^\/+/, '');
  if (p === '') return exists('index.html') ? 'index.html' : null;
  if (p.endsWith('/')) return exists(p + 'index.html') ? p + 'index.html' : null;
  if (exists(p)) return p;
  if (exists(p + '.html')) return p + '.html';
  if (exists(p + '/index.html')) return p + '/index.html';
  return null;
}

export function idsIn(html) {
  const ids = new Set();
  for (const m of html.matchAll(/\s(?:id|name)\s*=\s*["']([^"']+)["']/g)) ids.add(m[1]);
  return ids;
}

// ---------------------------------------------------------------- the check
export function checkSite(root, rules, { readFile = (f) => fs.readFileSync(path.join(root, f), 'utf8'), files } = {}) {
  // Every file counts for "does this link resolve"; only files outside skipDirs are scanned.
  const all = files || walk(root, ['.git', 'node_modules']);
  const fileSet = new Set(all);
  const skip = rules.skipDirs || [];
  const scanned = all.filter((f) => !skip.some((d) => f === d || f.startsWith(d + '/')));
  const exists = (f) => fileSet.has(f);
  const errors = [];
  const warnings = [];
  const used = new Map(); // asin -> Set(files)
  const approved = rules.approvedAsins || {};
  const err = (file, line, code, msg) => errors.push({ file, line, code, msg });
  const idCache = new Map();
  const idsOf = (f) => { if (!idCache.has(f)) idCache.set(f, idsIn(readFile(f))); return idCache.get(f); };

  const checkAmazonUrl = (file, line, url, expectedTag) => {
    const a = parseAmazon(url);
    if (a.kind === 'short') { err(file, line, 'A6', `amzn.to short link: use the full https://www.amazon.com/dp/ASIN?tag=${expectedTag} link so the product can be checked (${url})`); return; }
    if (a.kind === 'other') { err(file, line, 'A6', `Amazon link is not a product page (/dp/ASIN): ${url}`); return; }
    if (!used.has(a.asin)) used.set(a.asin, new Set());
    used.get(a.asin).add(file);
    if (!a.tag) err(file, line, 'A1', `Amazon link has no tracking ID (expected tag=${expectedTag}): ${url}`);
    else if (a.tag !== expectedTag) err(file, line, 'A2', `wrong tracking ID ${a.tag} (this file should use ${expectedTag}) on ${a.asin}`);
    if (!approved[a.asin]) err(file, line, 'A3', `ASIN ${a.asin} is not on the approved list in scripts/link-rules.json (typo, or a new product to add)`);
  };

  for (const file of scanned) {
    const isHtml = file.endsWith('.html');
    const isJs = file.endsWith('.js') || file.endsWith('.mjs');
    const isList = ['sitemap.xml', 'llms.txt', 'feed.xml'].includes(file);
    if (!isHtml && !isJs && !isList) continue;
    const raw = readFile(file);
    const expectedTag = tagFor(file, rules);

    if (isJs) {
      const src = blankJsComments(raw);
      // Full URLs written out in the script.
      for (const m of src.matchAll(AMAZON_RE)) {
        const url = m[0];
        if (/\/dp\/$/.test(url)) continue; // URL builder prefix, handled below
        checkAmazonUrl(file, lineOf(src, m.index), url, expectedTag);
      }
      // URL builders: 'https://www.amazon.com/dp/' + asin + '?tag=' + SOME_TAG
      if (/amazon\.com\/dp\/['"`]\s*\+/.test(src)) {
        const tagConst = (src.match(/\?tag=['"`]\s*\+\s*([A-Za-z_$][\w$]*)/) || [])[1];
        const tagVal = tagConst ? (src.match(new RegExp(`\\b${tagConst}\\s*=\\s*['"]([^'"]+)['"]`)) || [])[1] : null;
        const at = src.search(/amazon\.com\/dp\/['"`]\s*\+/);
        if (!tagVal) err(file, lineOf(src, at), 'A1', 'builds Amazon links but the tracking ID constant could not be found');
        else if (tagVal !== expectedTag) err(file, lineOf(src, at), 'A2', `builds Amazon links with ${tagVal} (this file should use ${expectedTag})`);
        for (const m of src.matchAll(/\basin\s*:\s*['"]([A-Z0-9]{10})['"]/g)) {
          checkAmazonUrl(file, lineOf(src, m.index), `https://www.amazon.com/dp/${m[1]}?tag=${tagVal || ''}`, expectedTag);
        }
      }
      continue;
    }

    if (isList) {
      for (const m of raw.matchAll(/https?:\/\/(?:www\.)?lawnseedpicker\.com(\/[^\s<>"'\])]*)?/g)) {
        const p = (m[1] || '/').replace(/&amp;/g, '&');
        if (!resolveSitePath(p, exists)) err(file, lineOf(raw, m.index), 'I3', `${m[0]} does not match any file in the site`);
      }
      continue;
    }

    // ---- HTML
    const html = blankHtmlComments(raw);
    // Amazon links inside inline scripts (rare) are checked as plain URLs.
    for (const s of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
      const body = blankJsComments(s[1]);
      for (const m of body.matchAll(AMAZON_RE)) {
        if (/\/dp\/$/.test(m[0])) continue;
        checkAmazonUrl(file, lineOf(html, s.index + s[0].indexOf(s[1]) + m.index), m[0], expectedTag);
      }
    }
    const noScripts = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (m) => m.replace(/[^\n]/g, ' '));

    for (const m of noScripts.matchAll(/<(a|link|img|script|source|iframe)\b[^>]*>/gi)) {
      const tagName = m[1].toLowerCase();
      const at = attrs(m[0]);
      const line = lineOf(noScripts, m.index);
      for (const key of ['href', 'src']) {
        const val = at[key];
        if (val == null || val === '') continue;
        const url = decode(val.trim());

        if (/^https?:\/\/(?:www\.)?(?:amazon\.com|amzn\.to)\b/i.test(url)) {
          checkAmazonUrl(file, line, url, expectedTag);
          if (tagName === 'a') {
            const rel = (at.rel || '').toLowerCase().split(/\s+/);
            if (!rel.includes('sponsored')) err(file, line, 'A4', 'Amazon link is missing rel="sponsored"');
            if ((at.target || '') === '_blank' && !rel.includes('noopener')) err(file, line, 'A4', 'Amazon link opens a new tab without rel="noopener"');
            const close = noScripts.indexOf('</a>', m.index);
            const text = close > 0 ? noScripts.slice(m.index + m[0].length, close).replace(/<[^>]+>/g, '') : '';
            if (/\$\s?\d/.test(text)) err(file, line, 'A5', `price inside Amazon link text ("${text.trim().slice(0, 60)}"); Amazon prices may only come from Amazon`);
          }
          continue;
        }

        // Internal links
        let sitePath = null;
        const hostM = url.match(/^https?:\/\/([^/]+)(\/.*)?$/i);
        if (hostM) { if (SITE_HOSTS.includes(hostM[1].toLowerCase())) sitePath = hostM[2] || '/'; else continue; }
        else if (/^(mailto:|tel:|javascript:|data:|\/\/)/i.test(url)) continue;
        else if (url.startsWith('#')) sitePath = '/' + file + url;
        else if (url.startsWith('/')) sitePath = url;
        else sitePath = '/' + path.posix.normalize(path.posix.join(path.posix.dirname(file), url));

        const target = resolveSitePath(sitePath, exists);
        if (!target) { err(file, line, 'I1', `${key}="${val}" points at a page or file that does not exist`); continue; }
        const frag = sitePath.includes('#') ? sitePath.slice(sitePath.indexOf('#') + 1) : '';
        if (frag && target.endsWith('.html') && !idsOf(target).has(decodeURIComponent(frag))) {
          err(file, line, 'I2', `${key}="${val}": no element with id "${frag}" on ${target}`);
        }
      }
    }
  }

  for (const asin of Object.keys(approved)) {
    if (!used.has(asin)) warnings.push({ code: 'W1', msg: `approved ASIN ${asin} (${approved[asin]}) is not used on any page; remove it from the list if it is retired` });
  }
  return { errors, warnings, used, fileCount: scanned.length };
}

export function report({ errors, warnings, used, fileCount }, quiet = false) {
  const lines = [];
  lines.push(`Link check: ${fileCount} files, ${used.size} Amazon products linked, ${errors.length} errors, ${warnings.length} warnings.`);
  if (!quiet && used.size) {
    lines.push('', 'Amazon products in use:');
    for (const [asin, files] of [...used].sort()) lines.push(`  ${asin}  ${files.size} file(s)`);
  }
  if (errors.length) {
    lines.push('', 'ERRORS (fix before merging):');
    for (const e of errors) lines.push(`  [${e.code}] ${e.file}:${e.line}  ${e.msg}`);
  }
  if (warnings.length) {
    lines.push('', 'Warnings:');
    for (const w of warnings) lines.push(`  [${w.code}] ${w.msg}`);
  }
  return lines.join('\n');
}

function main() {
  const rules = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'link-rules.json'), 'utf8'));
  const result = checkSite(REPO_ROOT, rules);
  console.log(report(result, process.argv.includes('--quiet')));
  process.exit(result.errors.length ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
