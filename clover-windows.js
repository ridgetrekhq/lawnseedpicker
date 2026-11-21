// Clover planting-window logic for /when-to-plant-clover.
//
// Every window below is quoted from a saved extension or research source
// (Lawn Data/Sources; quotes, files and pages in the Project doc
// claude/Checker_Prep_Windows_Table_Draft_2026-11-08.md). Rules:
//   - one source per area, never averaged;
//   - a yes/no about today only where the source prints dates or says so;
//   - pasture, cover-crop and bee-lawn sources only as labelled secondary notes.
// Area names are the `area` strings from picker/src/data/zipZones.js (read-only).

const GROUPS = {
  'Maryland': 'md_de_dc',
  'Delaware': 'md_de_dc',
  'Washington, D.C.': 'md_de_dc',
  'North Carolina': 'nc',
  'Kentucky': 'ky',
  'Minnesota': 'mn',
  'Iowa': 'ia',
  'Vermont': 'vt',
  'Massachusetts': 'ma',
};

const LINKS = {
  frost: '<a href="/frost-seeding-clover">frost seeding clover</a>',
  dormant: '<a href="/dormant-seeding">dormant seeding</a>',
  overseed: '<a href="/overseeding-with-clover">how to overseed clover</a>',
};

// Result-panel links (plan row 4, v26.3 "checker result panel", built 11/20/26).
// The links follow the verdict:
//   sow now (NC open; MD Jul-Oct; KY Apr and Jul) -> Miniclover + tall fescue blend
//   frost seeding now (NC February)               -> Miniclover + hand spreader
//   window closed or no dates                     -> the frost / dormant seeding guides
//   no sourced window for the area                -> the grass seed calculator
// Every Amazon link uses the checker's own tracking ID, so checker orders can be
// read apart from the rest of the site. ASINs are the ones already live on the
// site: Miniclover (frost page, calculator), Blue Resilience (calculator card),
// EarthWay bag spreader (frost page "what you need" box).
export const CHECKER_TAG = 'lspchecker-20';

export const PRODUCTS = {
  miniclover: { asin: 'B00E255LIU', text: 'Outsidepride Miniclover seed on Amazon' },
  tf_blend: { asin: 'B0DD2KNLPD', text: 'Twin City Seed Blue Resilience tall fescue and bluegrass blend on Amazon' },
  spreader: { asin: 'B000XS3EHA', text: 'EarthWay hand-operated bag spreader on Amazon' },
};

export function amazonUrl(asin) {
  return 'https://www.amazon.com/dp/' + asin + '?tag=' + CHECKER_TAG;
}

const SOW_NOW = ['open', 'in_season'];

export function panelFor(r) {
  if (r.group === 'none' || r.verdict === 'no_window') {
    return {
      kind: 'picker',
      lead: 'No sourced clover window here, but the grass seed calculator can still match seed to your ZIP, sun and use.',
      picker: { href: '/picker/', text: 'Open the grass seed calculator' },
    };
  }
  if (SOW_NOW.indexOf(r.verdict) !== -1) {
    return {
      kind: 'buy',
      lead: 'Ready to sow?',
      items: [
        { id: 'miniclover', note: '' },
        { id: 'tf_blend', note: 'Seeding the grass at the same time? ' },
      ],
    };
  }
  if (r.verdict === 'frost') {
    return {
      kind: 'buy',
      lead: 'Frost seeding this month? You need the seed and a way to spread it.',
      items: [
        { id: 'miniclover', note: '' },
        { id: 'spreader', note: 'A hand-held spreader: ' },
      ],
    };
  }
  return {
    kind: 'route',
    lead: 'Not a sowing time here today. Read up on the two off-season routes before you buy seed:',
    guides: [
      { slug: 'frost-seeding-clover', text: 'Frost seeding clover' },
      { slug: 'dormant-seeding', text: 'Dormant seeding' },
    ],
  };
}

const NO_WINDOW =
  'No lawn-specific extension window for your area. None of the extension sources we’ve found publishes a clover sowing window for lawns here, so we won’t guess one.';

export function groupFor(area) {
  return GROUPS[area] || 'none';
}

// Month/day as a sortable number, e.g. Sept 15 -> 915.
function md(date) {
  return (date.getMonth() + 1) * 100 + date.getDate();
}

export function cloverWindow(area, now) {
  const group = groupFor(area);
  const x = md(now);
  const m = now.getMonth() + 1;
  const r = { group, verdict: 'no_window', title: 'Your clover window', areaLine: 'Your area: ' + area, secondary: [] };

  if (group === 'md_de_dc') {
    r.headline = {
      label: 'Lawn',
      text: 'University of Maryland Extension (Mid-Atlantic): the preferred time to seed a tall fescue and microclover lawn is late summer to early fall.',
    };
    if (m >= 11) {
      r.verdict = 'too_late';
      r.verdictText = 'Probably too late for this fall. Asked in early November, Maryland’s extension horticulturists said it was “probably too late, yes.”';
      r.next = 'Next: late summer to early fall. Over winter, read about ' + LINKS.frost + ' and ' + LINKS.dormant + ' (neither is written for Maryland lawns).';
    } else if (m <= 6) {
      r.verdict = 'not_yet';
      r.verdictText = 'Not the preferred time. UMD’s preferred time is late summer to early fall.';
      r.next = 'Plan for late summer: ' + LINKS.overseed + '.';
    } else {
      r.verdict = 'in_season';
      r.verdictText = 'You’re in or near UMD’s preferred season, late summer to early fall. The source gives no exact dates.';
      r.next = 'Ready to go: ' + LINKS.overseed + '.';
    }
    return r;
  }

  if (group === 'nc') {
    r.headline = {
      label: 'Lawn',
      text: 'NC State Extension: in the Piedmont, white clover is best sown in early fall, September 15 to October 15. It calls spring too late. Written for the Piedmont; the mountains and coast may differ.',
    };
    if (x >= 915 && x <= 1015) {
      r.verdict = 'open';
      r.verdictText = 'Open now. You’re inside NC State’s September 15 to October 15 window.';
      r.next = 'Ready to go: ' + LINKS.overseed + '.';
    } else if (m === 2) {
      r.verdict = 'frost';
      r.verdictText = 'Frost seeding is possible now. NC State: “You can try frost seeding white and red clover during February,” but fall is still best.';
      r.next = 'How it works: ' + LINKS.frost + '. Otherwise, the best window opens September 15.';
    } else if (x > 1015 || m === 1) {
      r.verdict = 'past';
      r.verdictText = 'Past the best window for this year.';
      r.next = 'Next: you can try ' + LINKS.frost + ' in February, or wait for the September 15 to October 15 window.';
    } else {
      r.verdict = 'not_yet';
      r.verdictText = 'Not yet. NC State says spring is too late; the best window opens September 15.';
      r.next = 'Plan ahead: ' + LINKS.overseed + '.';
    }
    r.secondary.push({ label: 'Lawn', text: 'Same source: frost seeding white clover in February is possible, but fall is still best.' });
    return r;
  }

  if (group === 'ky') {
    r.verdict = 'research';
    r.headline = {
      label: 'Turf research',
      text: 'A University of Kentucky study planted white clover into existing tall fescue and Kentucky bluegrass in April, July and October. The July planting gave the most clover; spring and summer both worked; October did worst. These are research planting dates, not a published window.',
    };
    if (m === 7) { r.verdict = 'in_season'; r.verdictText = 'July was the study’s best planting month.'; }
    else if (m === 4) { r.verdict = 'in_season'; r.verdictText = 'April plantings worked in the study, though July did better.'; }
    else if (m === 10) r.verdictText = 'October was the weakest of the study’s three planting dates.';
    else r.verdictText = 'The study didn’t test this month, so it can’t say whether now is too late.';
    r.next = 'How to do it: ' + LINKS.overseed + '.';
    r.secondary.push({
      label: 'Pasture guidance',
      text: 'University of Kentucky Cooperative Extension says frost seeding is best in late winter or very early spring (February and early March). It was written for pastures; see ' + LINKS.frost + '.',
    });
    return r;
  }

  if (group === 'mn') {
    r.verdict = 'no_dates';
    r.headline = {
      label: 'Lawn',
      text: 'University of Minnesota Extension (an Ask Extension answer relaying the UMN Bee Lab’s bee lawn toolkit): the best time to seed is in the fall, with the seed sprouting in spring; overseeding in early spring is second best.',
    };
    r.verdictText = 'The source gives no exact dates.';
    r.next = 'Background: ' + LINKS.dormant + '.';
    r.secondary.push({
      label: 'Bee lawn mix',
      text: 'UMN’s bee lawn guide (fine fescue, white clover and other flowers) recommends dormant seeding from early November to mid-December in Minnesota, or spring seeding from mid-May to early June, and says summer and fall are not good times.',
    });
    return r;
  }

  r.headline = null;
  r.verdictText = NO_WINDOW;

  if (group === 'ia') {
    r.secondary.push({
      label: 'Farm cover crop',
      text: 'The USDA and Iowa State white clover cover crop sheet lists fall seeding from early August to early September and spring seeding from early April to mid-May, with a minimum germination soil temperature of 42°F. It was written for farm cover crops, not lawns.',
    });
  } else if (group === 'vt') {
    r.secondary.push({
      label: 'Pasture guidance',
      text: 'University of Vermont Extension gives no date for frost seeding: it needs soil that freezes and thaws, a thin stand, and not sandy soil. Written for pastures; see ' + LINKS.frost + '.',
    });
  } else if (group === 'ma') {
    r.secondary.push({
      label: 'Context',
      text: 'UMass Extension notes that clover seeds germinate under cool, moist conditions in the spring, early summer or fall. That describes when clover sprouts, not when to sow it.',
    });
  }
  r.next = 'Fallbacks to read about: ' + LINKS.frost + ' (thin lawns, freezing soil) and ' + LINKS.dormant + '.';
  return r;
}
