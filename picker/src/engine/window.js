// Seeding-window logic. Given the region, the blend's season (cool/warm), and
// today's date, return whether it's time to seed — and if not, when the next
// (and best) window opens. Drives the brief's off-season state:
// "You're early — your fall window opens [date]."

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// [startMonth, startDay, endMonth, endDay] (1-based months).
const WINDOWS = {
  cool: {
    cool: { spring: [4, 1, 5, 1], fall: [8, 15, 9, 30], best: 'fall' },
    transition: { spring: [3, 15, 4, 15], fall: [9, 1, 10, 15], best: 'fall' },
    warm: { spring: [4, 1, 5, 1], fall: [8, 15, 9, 30], best: 'fall' },
  },
  warm: {
    warm: { summer: [5, 1, 7, 15], best: 'summer' },
    transition: { summer: [5, 15, 6, 30], best: 'summer' },
    cool: { summer: [5, 1, 7, 15], best: 'summer' }, // warm-season grass seeded in a cool zip is unusual; keep simple
  },
};

function dateOf(year, m, d) {
  return new Date(year, m - 1, d);
}
function label(m, d) {
  return `${MONTHS[m - 1]} ${d}`;
}

/**
 * @param region 'cool'|'transition'|'warm'
 * @param season 'cool'|'warm' (the blend's grass type)
 * @param now Date (defaults to today)
 */
export function seedingWindow(region, season, now = new Date()) {
  const table = (WINDOWS[season] && WINDOWS[season][region]) || WINDOWS.cool.cool;
  const year = now.getFullYear();

  // Build this year's concrete windows, in calendar order.
  const wins = [];
  for (const key of ['spring', 'summer', 'fall']) {
    if (table[key]) {
      const [sm, sd, em, ed] = table[key];
      wins.push({ key, start: dateOf(year, sm, sd), end: dateOf(year, em, ed), startLabel: label(sm, sd), endLabel: label(em, ed) });
    }
  }
  const best = table.best;

  // Are we inside a window right now?
  const open = wins.find((w) => now >= w.start && now <= w.end);
  if (open) {
    return {
      state: 'open',
      windowKey: open.key,
      isBest: open.key === best,
      rangeLabel: `${open.startLabel}–${open.endLabel}`,
      message: `It's seeding season — your ${open.key} window is open now (through ${open.endLabel}).`,
    };
  }

  // Next window: the next one this year, else the first one next year.
  let next = wins.find((w) => now < w.start);
  let nextYear = year;
  if (!next) {
    const [sm, sd, em, ed] = table[wins[0].key === 'spring' ? 'spring' : Object.keys(table).find((k) => k !== 'best')];
    next = { key: wins[0].key, start: dateOf(year + 1, sm, sd), startLabel: label(sm, sd), endLabel: label(em, ed) };
    nextYear = year + 1;
  }

  const isBestNext = next.key === best;
  const earlyMsg =
    next.key === 'fall'
      ? `You're early. The prime fall seeding window for your area opens around ${next.startLabel}${nextYear !== year ? ' ' + nextYear : ''}. Here's what to plan for.`
      : `Hold off for now — your next window opens around ${next.startLabel}${nextYear !== year ? ' ' + nextYear : ''}.`;

  return {
    state: 'early',
    windowKey: next.key,
    isBest: isBestNext,
    opensLabel: `${next.startLabel}${nextYear !== year ? ' ' + nextYear : ''}`,
    rangeLabel: next.endLabel ? `${next.startLabel}–${next.endLabel}` : next.startLabel,
    message: earlyMsg,
  };
}
