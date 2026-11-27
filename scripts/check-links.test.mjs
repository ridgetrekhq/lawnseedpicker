// Tests for check-links.mjs. Run: node --test scripts/
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSite, parseAmazon, resolveSitePath, blankJsComments, attrs } from './check-links.mjs';

const RULES = {
  defaultTag: 'lawnseedpicke-20',
  tagByFile: [
    { match: '^picker/', tag: 'lsppicker-20' },
    { match: '^grass-windows\\.js$', tag: 'lspwindow-20' },
  ],
  approvedAsins: { B00E255LIU: 'Miniclover', B0DD2KNLPD: 'TF blend', B0RETIRED1: 'Old product' },
  skipDirs: ['pins'],
};

const page = (body) => `<!doctype html><html><body>${body}</body></html>`;
const good = (asin = 'B00E255LIU', tag = 'lawnseedpicke-20') =>
  `<a href="https://www.amazon.com/dp/${asin}?tag=${tag}" rel="noopener sponsored" target="_blank">Miniclover</a>`;

function run(files) {
  return checkSite('/x', RULES, { files: Object.keys(files), readFile: (f) => files[f] });
}
const codes = (r) => r.errors.map((e) => e.code).sort();

test('a correct page passes', () => {
  const r = run({ 'index.html': page(good() + '<a href="/guides">g</a>'), 'guides.html': page('') });
  assert.deepEqual(r.errors, []);
});

test('A1 missing tag, A2 wrong tag, A3 unknown ASIN', () => {
  const r = run({
    'a.html': page(
      '<a href="https://www.amazon.com/dp/B00E255LIU" rel="sponsored">x</a>' +
      good('B00E255LIU', 'lsppicker-20') +
      good('B0TYPO0000')),
  });
  assert.deepEqual(codes(r), ['A1', 'A2', 'A3']);
});

test('A4 rel rules', () => {
  const r = run({
    'a.html': page(
      '<a href="https://www.amazon.com/dp/B00E255LIU?tag=lawnseedpicke-20">x</a>' +
      '<a href="https://www.amazon.com/dp/B00E255LIU?tag=lawnseedpicke-20" rel="sponsored" target="_blank">x</a>'),
  });
  assert.deepEqual(codes(r), ['A4', 'A4']);
});

test('A5 price in link text', () => {
  const r = run({ 'a.html': page('<a href="https://www.amazon.com/dp/B00E255LIU?tag=lawnseedpicke-20" rel="sponsored">Miniclover, $24.99</a>') });
  assert.deepEqual(codes(r), ['A5']);
});

test('A6 short links and search links', () => {
  const r = run({ 'a.html': page('<a href="https://amzn.to/abc" rel="sponsored">x</a><a href="https://www.amazon.com/s?k=clover&tag=lawnseedpicke-20" rel="sponsored">x</a>') });
  assert.deepEqual(codes(r), ['A6', 'A6']);
});

test('picker files must use the picker tag; commented-out links are ignored', () => {
  const ok = run({ 'picker/src/data/retailers.js': "// old: https://www.amazon.com/dp/B0OLDOLD00?tag=x\nconst u = 'https://www.amazon.com/dp/B0DD2KNLPD?tag=lsppicker-20';" });
  assert.deepEqual(ok.errors, []);
  const bad = run({ 'picker/src/data/retailers.js': "const u = 'https://www.amazon.com/dp/B0DD2KNLPD?tag=lawnseedpicke-20';" });
  assert.deepEqual(codes(bad), ['A2']);
});

test('URL-builder scripts: tag constant and asin values are checked', () => {
  const src = (tag, asin) => `export const WINDOW_TAG = '${tag}';\nconst P = { a: { asin: '${asin}' } };\nexport function amazonUrl(asin) { return 'https://www.amazon.com/dp/' + asin + '?tag=' + WINDOW_TAG; }`;
  assert.deepEqual(run({ 'grass-windows.js': src('lspwindow-20', 'B00E255LIU') }).errors, []);
  assert.deepEqual(codes(run({ 'grass-windows.js': src('lawnseedpicke-20', 'B00E255LIU') })), ['A2', 'A2']);
  assert.deepEqual(codes(run({ 'grass-windows.js': src('lspwindow-20', 'B0NOTLISTD') })), ['A3']);
});

test('I1 broken internal links; pretty URLs, folders and assets resolve', () => {
  const r = run({
    'index.html': page('<a href="/guides">a</a><a href="/picker/">b</a><img src="/pins/x.png"><a href="style.css">c</a><a href="/gone">d</a><a href="https://lawnseedpicker.com/nope">e</a>'),
    'guides.html': page(''), 'picker/index.html': page(''), 'pins/x.png': '', 'style.css': '',
  });
  assert.deepEqual(codes(r), ['I1', 'I1']);
});

test('I2 missing anchors', () => {
  const r = run({
    'a.html': page('<a href="/b#faq">x</a><a href="/b#missing">y</a><a href="#top">z</a><h2 id="top">t</h2>'),
    'b.html': page('<section id="faq"></section>'),
  });
  assert.deepEqual(codes(r), ['I2']);
});

test('I3 sitemap/llms/feed URLs must exist', () => {
  const r = run({ 'sitemap.xml': '<loc>https://lawnseedpicker.com/a</loc><loc>https://lawnseedpicker.com/zzz</loc>', 'a.html': page('') });
  assert.deepEqual(codes(r), ['I3']);
});

test('W1 unused approved ASIN is a warning, not an error', () => {
  const r = run({ 'a.html': page(good()) });
  assert.equal(r.errors.length, 0);
  assert.ok(r.warnings.some((w) => w.msg.includes('B0RETIRED1')));
});

test('HTML comments are ignored', () => {
  const r = run({ 'a.html': page('<!-- <a href="/gone">x</a> https://amzn.to/x -->') });
  assert.deepEqual(r.errors, []);
});

test('helpers', () => {
  assert.deepEqual(parseAmazon('https://www.amazon.com/dp/B00E255LIU/?tag=a-20&amp;linkCode=ll2'), { kind: 'product', asin: 'B00E255LIU', tag: 'a-20' });
  assert.equal(parseAmazon('https://www.amazon.com/gp/product/B00E255LIU?tag=a').asin, 'B00E255LIU');
  const ex = (f) => ['index.html', 'a.html', 'p/index.html'].includes(f);
  assert.equal(resolveSitePath('/', ex), 'index.html');
  assert.equal(resolveSitePath('/a?x=1#y', ex), 'a.html');
  assert.equal(resolveSitePath('/p', ex), 'p/index.html');
  assert.equal(resolveSitePath('/q', ex), null);
  assert.equal(blankJsComments("a // c\nb /* d */ 'e//f'").replace(/\s+/g, ' '), "a b 'e//f'");
  assert.deepEqual(attrs('<a href="x" rel=sponsored data-x>'), { href: 'x', rel: 'sponsored', 'data-x': '' });
});
