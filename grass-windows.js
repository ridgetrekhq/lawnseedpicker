// Grass seeding-window logic for /when-to-plant-grass-seed (plan row 35).
//
// Every window below is quoted from a saved extension source (Lawn Data/Sources;
// quotes, files and pages in the Project doc
// claude/Row35_Grass_Seeding_Window_Source_Scout_2026-11-19.md). Rules:
//   - one source per area, never averaged, never borrowed from a neighbour;
//   - timing only: seeding rates come from the picker database, never from here;
//   - where a source gives a sub-state zone (Purdue halves, NC regions, UGA
//     regions) the visitor picks their zone; we draw no boundary.
//   - "mid-August" style wording is read as the 15th of the month; the verdict
//     text says "around" so it never claims more precision than the source.
// Area names are the `area` strings from picker/src/data/zipZones.js (read-only).

const GROUPS = {
  'Massachusetts': 'ma',
  'Connecticut': 'ct',
  'Maine': 'me',
  'Iowa': 'ia',
  'Minnesota': 'mn',
  'Indiana (north & central)': 'in_il',
  'Indiana (south)': 'in_il',
  'Illinois (north)': 'in_il',
  'Illinois (central & south)': 'in_il',
  'Kansas': 'ks',
  'Georgia (Atlanta & north)': 'ga',
  'Georgia (south)': 'ga',
  'Georgia (far south)': 'ga',
  'North Carolina': 'nc',
};

export function groupFor(area) {
  return GROUPS[area] || 'none';
}

// Month/day as a sortable number, e.g. Sept 15 -> 915.
function md(date) {
  return (date.getMonth() + 1) * 100 + date.getDate();
}

// Thanksgiving (US): fourth Thursday of November, as month/day number.
function thanksgiving(year) {
  const first = new Date(year, 10, 1).getDay(); // 0 = Sunday
  const firstThu = 1 + ((4 - first + 7) % 7);
  return 1100 + firstThu + 21;
}

const LINKS = {
  dormant: '<a href="/dormant-seeding">dormant seeding</a>',
  spring: '<a href="/overseeding-in-spring">overseeding in spring</a>',
  clover: '<a href="/when-to-plant-clover">clover planting-window checker</a>',
  overseed: '<a href="/overseeding-with-clover">overseeding with clover</a>',
};

// One window block = one grass type (or one zone) with its own verdict.
function block(label, source, text, verdict, verdictText, next) {
  return { label, source, text, verdict, verdictText, next: next || '' };
}

function ma(x) {
  const text = 'UMass Extension: renovating in late summer, August 15 to September 15, generally gives the best results; spring only if absolutely necessary.';
  if (x >= 815 && x <= 915) return block('Cool-season lawn', 'UMass Extension', text, 'open', 'Open now. You’re inside UMass’s August 15 to September 15 window.', 'Thinking about clover too? ' + LINKS.overseed + '.');
  if (x > 915) return block('Cool-season lawn', 'UMass Extension', text, 'past', 'Past the best window for this year.', 'Next window opens August 15. Over winter, read about ' + LINKS.dormant + ' (UMass doesn’t cover it).');
  return block('Cool-season lawn', 'UMass Extension', text, 'not_yet', 'Not yet. The best window opens August 15; UMass advises spring seeding only if absolutely necessary.', 'If you must seed in spring: ' + LINKS.spring + '.');
}

function ct(x) {
  const text = 'UConn Extension: August 15 through mid-September is the best time to establish or renovate a lawn in Connecticut, and the latest date for seeding has always been before October 4.';
  if (x >= 815 && x <= 915) return block('Cool-season lawn', 'UConn Extension', text, 'open', 'Open now. You’re inside UConn’s best window, August 15 to around mid-September.', 'Thinking about clover too? ' + LINKS.overseed + '.');
  if (x > 915 && x < 1004) return block('Cool-season lawn', 'UConn Extension', text, 'late_ok', 'Late, but still possible: UConn’s latest seeding date has always been before October 4.', 'Seed soon, and see ' + LINKS.overseed + ' if you want clover in the mix.');
  if (x >= 1004) return block('Cool-season lawn', 'UConn Extension', text, 'too_late', 'Too late for this fall. UConn’s latest date is before October 4.', 'Next window opens August 15. Over winter, read about ' + LINKS.dormant + ' (UConn doesn’t cover it).');
  return block('Cool-season lawn', 'UConn Extension', text, 'not_yet', 'Not yet. UConn’s best window opens August 15.', 'Spring is not UConn’s recommended time; if you must, see ' + LINKS.spring + '.');
}

function me(x) {
  const text = 'University of Maine Cooperative Extension: the best time to seed a lawn in Maine is August 15 to September 15; renovation can also work in spring (May).';
  if (x >= 815 && x <= 915) return block('Cool-season lawn', 'UMaine Extension', text, 'open', 'Open now. You’re inside UMaine’s August 15 to September 15 window.', 'Thinking about clover too? ' + LINKS.overseed + '.');
  if (x >= 501 && x <= 531) return block('Cool-season lawn', 'UMaine Extension', text, 'open', 'Spring option open. UMaine says renovating an existing lawn can work in May; late summer is still best.', 'How spring seeding differs: ' + LINKS.spring + '.');
  if (x > 915) return block('Cool-season lawn', 'UMaine Extension', text, 'past', 'Past the best window for this year.', 'Next: renovating in May, or the August 15 to September 15 window.');
  return block('Cool-season lawn', 'UMaine Extension', text, 'not_yet', 'Not yet. For renovating an existing lawn, UMaine’s spring option is May; the best window opens August 15.', 'Plan ahead: ' + LINKS.spring + '.');
}

function ia(x) {
  const text = 'Iowa State University Extension: best from mid-August to mid-September; dormant seeding late November through early December (as late as early February); spring seeding early April to mid-May is possible with irrigation; late May to mid-August is extremely difficult and usually unsuccessful.';
  const b = (v, t, n) => block('Cool-season lawn', 'Iowa State Extension', text, v, t, n);
  if (x >= 815 && x <= 915) return b('open', 'Open now. You’re in Iowa State’s best window, around mid-August to mid-September.', 'Thinking about clover too? ' + LINKS.overseed + '.');
  if (x >= 1121 || x <= 210) return b('dormant_open', 'Dormant seeding time. Iowa State gives late November through early December, and as late as early February.', 'How it works: ' + LINKS.dormant + '.');
  if (x >= 401 && x <= 515) return b('open', 'Spring option open, if you can water. Iowa State says early April to mid-May is possible when irrigation is available.', 'How spring seeding differs: ' + LINKS.spring + '.');
  if (x >= 516 && x < 815) return b('not_yet', 'Not now. Iowa State calls seeding from late May to mid-August extremely difficult and usually unsuccessful.', 'The best window opens around mid-August.');
  if (x > 915 && x < 1121) return b('past', 'Past the best window. Iowa State’s dormant seeding window opens in late November.', 'Read ahead: ' + LINKS.dormant + '.');
  return b('not_yet', 'Not yet. Iowa State’s spring option opens in early April (with irrigation).', 'Plan ahead: ' + LINKS.spring + '.');
}

function mn(x) {
  const text = 'University of Minnesota Extension: the best time to seed in Minnesota is late summer, mid-August to mid-September. A separate UMN Extension page gives dormant seeding from early November to the middle of March, while soil is below 40°F.';
  const b = (v, t, n) => block('Cool-season lawn', 'UMN Extension', text, v, t, n);
  if (x >= 815 && x <= 915) return b('open', 'Open now. You’re in UMN’s best window, around mid-August to mid-September.', 'Thinking about clover too? ' + LINKS.overseed + '.');
  if (x >= 1101 || x <= 315) return b('dormant_open', 'Dormant seeding time. UMN Extension gives early November to the middle of March, while soil is below 40°F.', 'How it works: ' + LINKS.dormant + '.');
  if (x > 915) return b('past', 'Past the best window. UMN’s dormant seeding window opens in early November.', 'Read ahead: ' + LINKS.dormant + '.');
  return b('not_yet', 'Not yet. UMN’s best window opens around mid-August.', 'Spring seeding isn’t UMN’s recommended time; see ' + LINKS.spring + ' if you must.');
}

function inIl(x, year) {
  const tg = thanksgiving(year);
  const text = 'Purdue Extension: August 15 to September 15 is the optimum seeding time in the northern half of Indiana and Illinois, and September 1 to September 30 in the southern half; dormant seeding from as early as Thanksgiving to as late as March; spring seeding is difficult and often unsuccessful.';
  function zone(label, start, end) {
    const b = (v, t, n) => block(label, 'Purdue Extension', text, v, t, n);
    if (x >= start && x <= end) return b('open', 'Open now for the ' + label.toLowerCase() + '.', 'Thinking about clover too? ' + LINKS.overseed + '.');
    if (x >= tg || x <= 331) return b('dormant_open', 'Dormant seeding time: Purdue says as early as Thanksgiving and as late as March.', 'How it works: ' + LINKS.dormant + '.');
    if (x > end) return b('past', 'Past the optimum window. Purdue’s dormant seeding window opens at Thanksgiving.', 'Read ahead: ' + LINKS.dormant + '.');
    return b('not_yet', 'Not yet. Purdue calls spring seeding difficult and often unsuccessful; the optimum window opens ' + (start === 815 ? 'August 15' : 'September 1') + '.', '');
  }
  return [zone('Northern half', 815, 915), zone('Southern half', 901, 930)];
}

function ks(x) {
  const cool = 'Kansas State University: cool-season grasses are best seeded in early September; spring seeding often can be successful during March and early April.';
  const warm = 'Kansas State University: mid-May through July is the ideal time for planting warm-season buffalograss, bermudagrass and zoysiagrass; later plantings may not completely establish.';
  const src = 'K-State Research and Extension (January 2002)';
  let c;
  if (x >= 901 && x <= 915) c = block('Cool-season grass (tall fescue, bluegrass)', src, cool, 'open', 'Open now. You’re in K-State’s early-September window.');
  else if (x >= 301 && x <= 410) c = block('Cool-season grass (tall fescue, bluegrass)', src, cool, 'open', 'Spring option open. K-State says March and early April often can be successful; early September is best.', 'How spring seeding differs: ' + LINKS.spring + '.');
  else if (x > 915) c = block('Cool-season grass (tall fescue, bluegrass)', src, cool, 'past', 'Past the best window. K-State’s spring option opens in March.');
  else c = block('Cool-season grass (tall fescue, bluegrass)', src, cool, 'not_yet', x < 301 ? 'Not yet. K-State’s spring option opens in March.' : 'Not yet. K-State’s best window is early September.');
  let w;
  if (x >= 515 && x <= 731) w = block('Warm-season grass (buffalograss, bermudagrass, zoysiagrass)', src, warm, 'open', 'Open now for warm-season grass.');
  else if (x > 731) w = block('Warm-season grass (buffalograss, bermudagrass, zoysiagrass)', src, warm, 'past', 'Past the ideal window. K-State says later plantings may not completely establish.');
  else w = block('Warm-season grass (buffalograss, bermudagrass, zoysiagrass)', src, warm, 'not_yet', 'Not yet. K-State’s window opens in mid-May.');
  return [c, w];
}

function ga(x) {
  const src = 'UGA Cooperative Extension (B1533, 2021)';
  const tf = 'UGA: tall fescue in September to October, or late February through March (Mountain and Piedmont regions).';
  const warm = 'UGA: bermudagrass and zoysiagrass May to June statewide; bahiagrass and centipedegrass May to June from the Piedmont to the coast; warm-season seeding no later than first- to mid-August.';
  let c;
  if (x >= 901 && x <= 1031) c = block('Tall fescue (Mountain and Piedmont)', src, tf, 'open', 'Open now: September to October.');
  else if (x >= 220 && x <= 331) c = block('Tall fescue (Mountain and Piedmont)', src, tf, 'open', 'Spring option open: late February through March.');
  else if (x > 1031 || x < 220) c = block('Tall fescue (Mountain and Piedmont)', src, tf, 'past', 'Past the fall window. UGA’s spring option opens in late February.');
  else c = block('Tall fescue (Mountain and Piedmont)', src, tf, 'not_yet', 'Not yet. UGA’s fall window opens in September.');
  let w;
  if (x >= 501 && x <= 630) w = block('Warm-season grass', src, warm, 'open', 'Open now: May to June.');
  else if (x >= 701 && x <= 815) w = block('Warm-season grass', src, warm, 'late_ok', 'Late, but still possible: UGA says seed no later than first- to mid-August.');
  else if (x > 815) w = block('Warm-season grass', src, warm, 'too_late', 'Too late this year for warm-season seed. UGA’s next window is May to June.');
  else w = block('Warm-season grass', src, warm, 'not_yet', 'Not yet. UGA’s warm-season window is May to June.');
  return [c, w];
}

function nc(x) {
  const src = 'NC State Extension, Tall Fescue Lawn Maintenance Calendar (2021)';
  const text = 'NC State Extension: overseed thin, bare areas of tall fescue as the weather cools — August 15 to September 1 in the western region; September 1 to October 1 in the Piedmont and coastal plain.';
  function zone(label, start, end) {
    if (x >= start && x <= end) return block(label, src, text, 'open', 'Open now for the ' + label + '.', 'Thinking about clover too? ' + LINKS.overseed + '.');
    if (x > end) return block(label, src, text, 'past', 'Past the window for this year.', '');
    return block(label, src, text, 'not_yet', 'Not yet. The window opens ' + (start === 815 ? 'August 15' : 'September 1') + '.', '');
  }
  return [zone('Western region', 815, 901), zone('Piedmont and coastal plain', 901, 1001)];
}

const NO_WINDOW =
  'No lawn-specific extension window for your area yet. None of the extension sources we’ve saved publishes grass seeding dates for lawns here, so we won’t guess one.';

// Returns { group, area, verdict, blocks[], zoned } where `verdict` is the first
// block's verdict (used for analytics) and `zoned` means the visitor picks a zone.
export function grassWindow(area, now) {
  const group = groupFor(area);
  const x = md(now);
  const y = now.getFullYear();
  let blocks = [];
  let zoned = false;
  if (group === 'ma') blocks = [ma(x)];
  else if (group === 'ct') blocks = [ct(x)];
  else if (group === 'me') blocks = [me(x)];
  else if (group === 'ia') blocks = [ia(x)];
  else if (group === 'mn') blocks = [mn(x)];
  else if (group === 'in_il') { blocks = inIl(x, y); zoned = true; }
  else if (group === 'ks') blocks = ks(x);
  else if (group === 'ga') blocks = ga(x);
  else if (group === 'nc') { blocks = nc(x); zoned = true; }
  const verdict = blocks.length ? blocks[0].verdict : 'no_window';
  return { group, area, verdict, blocks, zoned, noWindow: blocks.length ? '' : NO_WINDOW };
}

// Result-panel links follow the verdict (same pattern as the clover checker).
// Clover first (Jon, Nov 19): Miniclover, then the tall fescue + bluegrass blend.
// Own tracking ID so the tool's orders read apart from the rest of the site.
export const WINDOW_TAG = 'lspwindow-20';

export const PRODUCTS = {
  miniclover: { asin: 'B00E255LIU', text: 'Outsidepride Miniclover seed on Amazon' },
  tf_blend: { asin: 'B0DD2KNLPD', text: 'Twin City Seed Blue Resilience tall fescue and bluegrass blend on Amazon' },
};

export function amazonUrl(asin) {
  return 'https://www.amazon.com/dp/' + asin + '?tag=' + WINDOW_TAG;
}

const SOW_NOW = ['open', 'late_ok'];

export function panelFor(verdict, isCoolBlock) {
  if (verdict === 'no_window') {
    return { kind: 'picker', lead: 'No sourced window here yet, but the grass seed calculator can still match seed to your ZIP, sun and use.', picker: { href: '/picker/', text: 'Open the grass seed calculator' } };
  }
  if (SOW_NOW.indexOf(verdict) !== -1 && isCoolBlock) {
    return {
      kind: 'buy',
      lead: 'Ready to sow? Consider adding clover while you’re at it:',
      items: [
        { id: 'miniclover', note: 'Overseed with microclover: ' },
        { id: 'tf_blend', note: 'Grass seed: ' },
      ],
    };
  }
  if (SOW_NOW.indexOf(verdict) !== -1) {
    return { kind: 'picker', lead: 'Pick the warm-season grass that fits your yard:', picker: { href: '/picker/', text: 'Open the grass seed calculator' } };
  }
  if (verdict === 'dormant_open') {
    return { kind: 'route', lead: 'Before you dormant seed, read up:', guides: [{ slug: 'dormant-seeding', text: 'Dormant seeding' }, { slug: 'when-to-plant-clover', text: 'When to plant clover' }] };
  }
  return { kind: 'route', lead: 'Not a seeding time here today. Plan ahead:', guides: [{ slug: 'overseeding-in-spring', text: 'Overseeding in spring' }, { slug: 'dormant-seeding', text: 'Dormant seeding' }, { slug: 'when-to-plant-clover', text: 'When to plant clover' }] };
}
