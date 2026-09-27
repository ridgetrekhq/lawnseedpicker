#!/usr/bin/env node
// check-citations.test.mjs — acceptance test for scripts/check-citations.mjs.
//
// Fixtures are inline HTML strings (never committed .html files — a fixture
// page with deliberately wrong claims must never be servable on the live
// site). Each fixture is written to a throwaway temp file only long enough
// for processFile() to read it, then deleted.
//
// The 10 "real" fixtures cite genuine /sources PDFs (text-layer pages only,
// confirmed against the B. coverage report before being locked in here) and
// genuine repo data files, so they exercise the real pdftotext/fs resolution
// path end to end — there is no mock/fake resolver anywhere in this harness;
// check-citations.mjs has none to inject, so every fixture, real or wrong,
// resolves through the same real files and real pdftotext calls it would in
// production. Run: node scripts/check-citations.test.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { processFile, buildResolutionContext } from './check-citations.mjs';

function runFixture(html) {
  const tmpPath = path.join(os.tmpdir(), `citation-check-fixture-${crypto.randomUUID()}.html`);
  fs.writeFileSync(tmpPath, `<!DOCTYPE html><html><body>${html}</body></html>`);
  try {
    const ctx = buildResolutionContext();
    return processFile(tmpPath, ctx);
  } finally {
    fs.unlinkSync(tmpPath);
  }
}

function classify(result) {
  if (result.fail.length) return { status: 'FAIL', detail: result.fail[0] };
  if (result.passQuote + result.passNumbers + result.passData + result.passGroup + result.signedOff > 0) {
    return { status: 'PASS', detail: result.passDetail[0] };
  }
  if (result.noNumber.length) return { status: 'NO-NUMBER', detail: result.noNumber[0] };
  if (result.unverifiable.length) return { status: 'UNVERIFIABLE', detail: result.unverifiable[0] };
  if (result.reference) return { status: 'REFERENCE', detail: null };
  return { status: 'UNCITED-ONLY', detail: result.uncited[0] };
}

// ---------------------------------------------------------------------------
// 10 real citations — every one must genuinely PASS (not NO-NUMBER, not
// UNVERIFIABLE) against a text-layer /sources page or a real repo data file.
// At most 1 of these 10 may fail per the acceptance criteria.
// ---------------------------------------------------------------------------

const realFixtures = [
  {
    id: 'R1',
    label: 'quote — USDA Kentucky bluegrass p.1',
    html: '<p>Kentucky bluegrass produces enormous quantities of seed: "There are approximately 2,177,000 seeds per pound."<!-- src: USDA_KENTUCKY BLUEGRASS Fact Sheet.pdf p.1 ("There are approximately 2,177,000 seeds per pound.") --></p>',
  },
  {
    id: 'R2',
    label: 'quote — USDA Perennial ryegrass p.1',
    html: '<p>Perennial ryegrass seed is much finer: "There are approximately 230,000 seeds per pound."<!-- src: USDA_PERENNIAL RYEGRASS Fact Sheet.pdf p.1 ("There are approximately 230,000 seeds per pound.") --></p>',
  },
  {
    id: 'R3',
    label: 'numbers — USDA Bermudagrass p.1',
    html: '<p>Bermudagrass withstands pH ranges from about 5.0 to 8.5.<!-- src: USDA_BERMUDAGRASS Fact Sheet.pdf p.1 (withstands pH ranges from about 5.0 to 8.5) --></p>',
  },
  {
    id: 'R4',
    label: 'numbers — USDA Hard fescue p.1',
    html: '<p>Hard fescue performs best at a pH of 5-6 and needs at least 12 inches of precipitation.<!-- src: USDA_HARD FESCUE Fact Sheet.pdf p.1 (performs best at a pH of 5-6; needs at least 12 inches of precipitation) --></p>',
  },
  {
    id: 'R5',
    label: 'data (CSV, single row, cell value) — row 26',
    html: '<table><tr><td>Scotts Rapid Grass Sun &amp; Shade Mix</td><td>5.6 lb</td><td>839 sq ft</td><td>2,800 sq ft</td></tr><!-- src: data/seed-bag-coverage-2026.csv row 26 --></table>',
  },
  {
    id: 'R6',
    label: 'data (CSV, single row, derived ratio a/b) — row 26',
    html: '<p>For that product, the overseeding coverage is 3.3&times; the new-lawn coverage.<!-- src: data/seed-bag-coverage-2026.csv row 26 --></p>',
  },
  {
    id: 'R7',
    label: 'data (CSV, multi-row, derived min/max ratio)',
    html: '<p>Across the rows we checked, the overseeding figure runs 2.0 times the new-lawn figure at the low end and 3.3 times at the high end.<!-- src: data/seed-bag-coverage-2026.csv rows 7, 10, 12, 13, 15, 17, 19, 23, 24, 26, 27, 28, 33, 37, 39, 40 --></p>',
  },
  {
    id: 'R8',
    label: 'data (repo JSON) — lawn_species_database.json',
    html: "<p>The picker's own species database confirms Kentucky bluegrass seed at roughly 2,177,000 seeds per pound.<!-- src: lawn_species_database.json --></p>",
  },
  {
    id: 'R9',
    label: 'numbers, whole file (repo Markdown) — data/README-dataset.md',
    html: '<p>Our dataset covers 43 retail grass seed products.<!-- src: data/README-dataset.md --></p>',
  },
  {
    id: 'R10',
    label: 'numbers, whole file (/sources Markdown) — NC_State_Carolina_Lawns_VERIFIED_RATES.md',
    html: "<p>NC State's warm-season table lists bahiagrass at 5 lb per 1,000 sq ft.<!-- src: NC_State_Carolina_Lawns_VERIFIED_RATES.md (AG-69 p.33) --></p>",
  },
  {
    id: 'R11',
    label: 'data (CSV, multi-row, derived range min/max ratio, same column pair)',
    html: '<p>The overseeding figure runs 2.0 to 3.3 times the new-lawn figure across the products we checked.<!-- src: data/seed-bag-coverage-2026.csv rows 7, 10, 12, 13, 15, 17, 19, 23, 24, 26, 27, 28, 33, 37, 39, 40 --></p>',
  },
  {
    // v1.2 fix 1: a "before"-convention table (2 rows, both preceding their
    // <tr>). Comment 2 sits between row 1's close and row 2's open — the
    // exact position the old heuristic misattributed backward to row 1. If
    // it were misattributed here, its "230,000" claim number would have to
    // be found inside a quote about 2,177,000 and would FAIL.
    id: 'R12',
    label: 'fix 1 — before-convention table, interior comment attaches forward',
    html: `<table><tbody>
<!-- src: USDA_KENTUCKY BLUEGRASS Fact Sheet.pdf p.1 ("There are approximately 2,177,000 seeds per pound.") -->
<tr><th scope="row">Kentucky bluegrass</th><td>2,177,000</td></tr>
<!-- src: USDA_PERENNIAL RYEGRASS Fact Sheet.pdf p.1 ("There are approximately 230,000 seeds per pound.") -->
<tr><th scope="row">Perennial ryegrass</th><td>230,000</td></tr>
</tbody></table>`,
  },
  {
    // v1.2 fix 2: this exact quote FAILed under -layout (two-column
    // interleave); plain pdftotext reads it correctly.
    id: 'R13',
    label: 'fix 2 — Bermudagrass pH quote, plain-mode pdftotext',
    html: '<p>Bermudagrass tolerates a wide pH range: "It withstands pH ranges from about 5.0 to 8.5"<!-- src: USDA_BERMUDAGRASS Fact Sheet.pdf p.1 ("It withstands pH ranges from about 5.0 to 8.5") --></p>',
  },
  {
    id: 'R14',
    label: 'fix 3 — CSV text-cell match ("Kentucky 31" cultivar name)',
    html: "<p>Pennington's Kentucky 31 blend is a 20 lb bag.<!-- src: data/seed-bag-coverage-2026.csv row 12 --></p>",
  },
  {
    id: 'R15',
    label: 'fix 4 — unit-denominator "1,000" ignored, range still checked',
    html: '<p>Tall fescue rates run 6-8 lb per 1,000 sq ft, per the collected extension sources.<!-- src: data/README-dataset.md --></p>',
  },
  {
    id: 'R16',
    label: 'fix 6 — multi-row cell match via adjacent unit ("40 lb")',
    html: '<p>One of the cited bags weighs 40 lb.<!-- src: data/seed-bag-coverage-2026.csv rows 10, 12, 13, 19 --></p>',
  },
  {
    id: 'R17',
    label: 'fix 7 — compound "row N (hint); row M (hint)" citation',
    html: '<p>Scotts lists new-lawn coverage of 930 sq ft for a 7 lb bag of Turf Builder Sun &amp; Shade Mix, which is coated, and 1,865 sq ft for a 7 lb bag of Heritage Sun &amp; Shade Mix, which is uncoated.<!-- src: data/seed-bag-coverage-2026.csv row 39 (coated, per coated_source); row 24 (uncoated, per coated_source) --></p>',
  },
  {
    id: 'R18',
    label: 'fix 8 — multi-row single-column min/max range',
    html: '<p>Four Pennington tall fescue listings imply new-lawn rates of 12.00 to 12.05 lb per 1,000 sq ft.<!-- src: data/seed-bag-coverage-2026.csv rows 10, 12, 13, 19 --></p>',
  },
  {
    id: 'R19',
    label: 'fix 10 — hyphen-compound range "2-to-4-inch" on the source side',
    html: '<p>Plugs are small squares of sod (2-4 inches) set at intervals.<!-- src: UF_IFAS_ENH03_Establishing_Your_Florida_Lawn.pdf p.3 (Plugging is the planting of 2-to-4-inch circular or block-shaped pieces of sod) --></p>',
  },
  {
    id: 'R20',
    label: 'fix 11 — source-side word-number conversion ("two to three" -> 2-3)',
    html: '<p>Then reduce watering frequency to 2-3 times a week.<!-- src: UF_IFAS_ENH03_Establishing_Your_Florida_Lawn.pdf p.2 (reduce the frequency to two to three times weekly) --></p>',
  },
  {
    // v1.3 fix 3: "September 7, 2026" (month + day + real 19/20xx year) must
    // be ignored as a date; the real claim number ($2.99, row 11) still checks.
    id: 'R21',
    label: 'fix 3 — "September 7, 2026" ignored as a date, real number still checked',
    html: "<p>On September 7, 2026 Pennington Kentucky 31 Tall Fescue's per-pound price for the 3 lb bag was $2.99.<!-- src: data/seed-bag-coverage-2026.csv row 11 --></p>",
  },
  {
    // v1.3 fix 1: comment sits inside <tr>, outside any cell — unambiguous,
    // no table-convention detection needed at all.
    id: 'R22',
    label: 'fix 1 — src comment inside <tr>, outside any cell, attaches to that row',
    html: '<table><tbody><tr><!-- src: USDA_PERENNIAL RYEGRASS Fact Sheet.pdf p.1 ("There are approximately 230,000 seeds per pound.") --><th scope="row">Perennial ryegrass</th><td>230,000</td></tr></tbody></table>',
  },
  {
    // v1.3 fix 1: data-src-convention="before" overrides detection. Without
    // the declaration this table would detect "ambiguous" or misattach (the
    // citation sits after an uncited header row, so a naive "prev token is
    // </tr>" heuristic would grab the wrong row) — the declaration forces
    // forward attachment to the real target row.
    id: 'R23',
    label: 'fix 1 — data-src-convention="before" overrides detection',
    html: `<table data-src-convention="before"><tbody>
<tr><th>Header row, no citation</th></tr>
<!-- src: USDA_PERENNIAL RYEGRASS Fact Sheet.pdf p.1 ("There are approximately 230,000 seeds per pound.") -->
<tr><th scope="row">Perennial ryegrass</th><td>230,000</td></tr>
</tbody></table>`,
  },
  {
    // v1.3 fix 2: two adjacent src comments (CSV + JSON) share one claim
    // segment. "1,660" exists only as a CSV cell (row 12); "227,000" exists
    // only in the JSON (tall fescue seeds_per_pound). Confirmed by direct
    // command that JSON has the literal value 227000 and CSV row 12 has no
    // such cell — this fixture can only PASS if any-of genuinely tries both
    // members for each number, not just the first.
    id: 'R24',
    label: 'fix 2 — adjacent CSV+JSON pair, any-of (CSV-only and JSON-only numbers)',
    html: '<p>Pennington Kentucky 31 Tall Fescue, 20 lb, covers 1,660 sq ft as a new lawn; tall fescue seed runs about 227,000 seeds per pound.<!-- src: data/seed-bag-coverage-2026.csv row 12 --><!-- src: lawn_species_database.json --></p>',
  },
];

// ---------------------------------------------------------------------------
// Deliberately wrong citations — every one must FAIL. R1-R5's real/text-
// layer counterparts are reused so the wrong-page, wrong-number, and
// quote-not-on-page cases run through the real pdftotext resolver against a
// genuine text-layer PDF, exactly as the acceptance criteria require.
// ---------------------------------------------------------------------------

const wrongFixtures = [
  {
    id: 'W1',
    label: 'wrong page number (real text-layer PDF, real quote, wrong page)',
    html: '<p>Kentucky bluegrass seed counts run high: "There are approximately 2,177,000 seeds per pound."<!-- src: USDA_KENTUCKY BLUEGRASS Fact Sheet.pdf p.2 ("There are approximately 2,177,000 seeds per pound.") --></p>',
  },
  {
    id: 'W2',
    label: 'wrong number in the claim (real text-layer PDF, real page, wrong number)',
    html: '<p>Hard fescue performs best at a pH of 9 to 10.<!-- src: USDA_HARD FESCUE Fact Sheet.pdf p.1 (performs best at a pH of 9 to 10) --></p>',
  },
  {
    id: 'W3',
    label: 'nonexistent filename',
    html: '<p>Some other tall fescue rate.<!-- src: Rutgers_Seeding Rate.pdf p.4 (100% Fine fescues 4 to 5 lbs) --></p>',
  },
  {
    id: 'W4',
    label: 'underscore-normalized filename (real file has spaces)',
    html: '<p>Kentucky bluegrass seed count differs by source.<!-- src: USDA_KENTUCKY_BLUEGRASS_Fact_Sheet.pdf p.1 --></p>',
  },
  {
    id: 'W5',
    label: 'quoted excerpt not present on the page (real text-layer PDF, real page, invented quote)',
    html: '<p>Kentucky bluegrass seeds are naturally blue-tinted, giving the species its name.<!-- src: USDA_KENTUCKY BLUEGRASS Fact Sheet.pdf p.1 ("Kentucky bluegrass seeds are naturally blue-tinted") --></p>',
  },
  {
    id: 'W6',
    label: 'CSV number changed by a small amount (3.3x real, claim says 3.4x)',
    html: '<p>For that product, the overseeding coverage is 3.4&times; the new-lawn coverage.<!-- src: data/seed-bag-coverage-2026.csv row 26 --></p>',
  },
  {
    // 5.6 is row 26's own net_weight_lb — a genuine cell value, but net_weight_lb
    // has no same-unit partner column, and no same-unit pair's multirow min/max
    // ratio rounds to 5.6 across these 16 rows either (confirmed by direct
    // computation before locking this in). Stated as a ratio across the 16 rows,
    // with no column hint, it must not be derivable.
    id: 'W7',
    label: 'multi-row claim number that is only a coincidental cell value (5.6, row 26 bag weight), no column hint',
    html: '<p>Across the rows we checked, the overseeding figure runs 5.6 times the new-lawn figure.<!-- src: data/seed-bag-coverage-2026.csv rows 7, 10, 12, 13, 15, 17, 19, 23, 24, 26, 27, 28, 33, 37, 39, 40 --></p>',
  },
  {
    // v1.2 fix 2: the ellipsis-distance bound must still catch this splice
    // even under plain-mode text — the two halves are genuinely paragraphs
    // apart on the real page (confirmed by direct trace this session).
    id: 'W8',
    label: 'KBG ellipsis splice — two non-adjacent sentences joined by "..." (must FAIL even in plain mode)',
    html: '<p>Kentucky bluegrass mowing: "Lawns are mowed to a minimum height of 1-1/2 inches...then lower to about 2-2 1/2 inches"<!-- src: USDA_KENTUCKY BLUEGRASS Fact Sheet.pdf p.2 ("Lawns are mowed to a minimum height of 1-1/2 inches...then lower to about 2-2 1/2 inches") --></p>',
  },
  {
    id: 'W9',
    label: 'multi-row "N lb" claim whose N is in no *_lb cell of the cited rows',
    html: '<p>One of the cited bags weighs 55 lb.<!-- src: data/seed-bag-coverage-2026.csv rows 10, 12, 13, 19 --></p>',
  },
  {
    // v1.3 fix 3 regression guard: a number immediately after a recognized
    // date must still be extracted and checked, not swallowed by the date
    // match. 3 cited rows can't support "43".
    id: 'W11',
    label: 'number right after a recognized date ("September 7, 43 products") still checked, and fails',
    html: '<p>On September 7, 43 products were checked.<!-- src: data/seed-bag-coverage-2026.csv rows 11, 12, 13 --></p>',
  },
  {
    // Confirmed by direct command: USDA_tall fescue Fact Sheet.pdf has 2
    // pages. Citing p.9 must FAIL "page out of range", never UNVERIFIABLE
    // "scanned-pdf" (pdftotext returns empty output for both cases alike).
    id: 'W15',
    label: 'page number beyond a text-layer PDF\'s actual page count',
    html: '<p>Tall fescue seed count: "There are 227,000 seeds per pound"<!-- src: USDA_tall fescue Fact Sheet.pdf p.9 ("There are 227,000 seeds per pound") --></p>',
  },
  {
    // Confirmed by direct command: Penn State_Lawn Establishment.pdf has 17
    // pages (and is scanned). Citing p.20 must still FAIL "page out of
    // range" specifically, not be absorbed into the scanned-pdf spot-check.
    id: 'W16',
    label: 'page number beyond a scanned PDF\'s actual page count',
    html: '<p>Seed at 6 lb per 1,000 sq ft.<!-- src: Penn State_Lawn Establishment.pdf p.20 (seed at 6 lb per 1,000 sq ft) --></p>',
  },
  {
    // v1.3 fix 1 regression guard: same in-row shape as R22, but the row's
    // own number is wrong for the row it attaches to.
    id: 'W12',
    label: 'src comment inside <tr> (outside any cell) — row number wrong for that row',
    html: '<table><tbody><tr><!-- src: USDA_PERENNIAL RYEGRASS Fact Sheet.pdf p.1 ("There are approximately 230,000 seeds per pound.") --><th scope="row">Perennial ryegrass</th><td>230,001</td></tr></tbody></table>',
  },
  {
    // v1.3 fix 4 regression guard: "12,345 vs. 2,800 sq ft" — 2,800 inherits
    // the unit and is a real cell (rows 39/40), but 12,345 is not, in either
    // column, for either row. Inheritance must lend the unit only, never
    // manufacture a match.
    id: 'W13',
    label: 'unit inheritance ("N vs. M sq ft") — N not in any *_sqft cell of the cited rows',
    html: '<p>One listing shows 12,345 vs. 2,800 sq ft.<!-- src: data/seed-bag-coverage-2026.csv rows 39, 40 --></p>',
  },
  {
    // v1.3 fix 2 regression guard: CSV member alone would PASS every number
    // in the claim, but the adjacent PDF member's own quote isn't on its own
    // page. Structural validity is per-member and not rescued by a
    // different member supporting the same numbers.
    id: 'W14',
    label: 'adjacent pair — CSV supports every number, but the PDF member\'s quote is not on its page',
    html: '<p>Pennington Kentucky 31 Tall Fescue is a 20 lb bag.<!-- src: data/seed-bag-coverage-2026.csv row 12 --><!-- src: USDA_KENTUCKY BLUEGRASS Fact Sheet.pdf p.1 ("Kentucky bluegrass seeds are naturally blue-tinted") --></p>',
  },
];

function main() {
  const lines = [];
  let mismatches = 0;

  lines.push('CITATION CHECKER — ACCEPTANCE TEST');
  lines.push('');
  lines.push(`== REAL CITATIONS (expect PASS; at most 1 of ${realFixtures.length} may fail) ==`);
  let realFails = 0;
  for (const f of realFixtures) {
    const result = runFixture(f.html);
    const { status, detail } = classify(result);
    if (status !== 'PASS') realFails++;
    const detailStr = status === 'PASS'
      ? `${detail.mode} | ${detail.route}`
      : JSON.stringify(detail);
    lines.push(`  [${status === 'PASS' ? 'PASS' : 'FAIL'}] ${f.id} ${f.label} -> ${status} (${detailStr})`);
  }
  lines.push(`  real: ${realFixtures.length - realFails}/${realFixtures.length} passed (limit: at most 1 may fail)`);
  if (realFails > 1) mismatches++;
  lines.push('');

  lines.push(`== DELIBERATELY WRONG CITATIONS (all ${wrongFixtures.length} must FAIL) ==`);
  let wrongCaughtAsFail = 0;
  for (const f of wrongFixtures) {
    const result = runFixture(f.html);
    const { status, detail } = classify(result);
    const caught = status === 'FAIL';
    if (caught) wrongCaughtAsFail++;
    else mismatches++;
    const detailStr = status === 'FAIL' ? `${detail.reason}: ${detail.detail || ''}` : JSON.stringify(detail);
    lines.push(`  [${caught ? 'OK' : 'MISMATCH'}] ${f.id} ${f.label} -> ${status} (${detailStr})`);
  }
  lines.push(`  wrong: ${wrongCaughtAsFail}/${wrongFixtures.length} correctly failed (required: ${wrongFixtures.length}/${wrongFixtures.length})`);
  lines.push('');

  const harnessResult = mismatches === 0 && realFails <= 1 && wrongCaughtAsFail === wrongFixtures.length ? 'PASS' : 'FAIL';
  lines.push(`HARNESS RESULT: ${harnessResult}`);

  const text = lines.join('\n');
  console.log(text);
  process.exitCode = harnessResult === 'PASS' ? 0 : 1;
}

main();
