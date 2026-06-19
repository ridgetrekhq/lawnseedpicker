// Scoring engine. Turns funnel inputs into a ranked list of grass species, with
// per-dimension breakdowns kept on each result so a human can hand-verify every
// number against the database. All ratings come from each species'
// calculator_recommended_value anchors — never re-derived from observations[].

import { SPECIES } from './db.js';
import { categoriesForRegion, specialistEligible } from './regions.js';

const SCALE = { very_poor: 1, poor: 2, fair: 3, good: 4, excellent: 5 };
export function ratingNum(r) {
  return r == null ? null : SCALE[r] ?? null;
}

/**
 * Resolve a tolerance anchor to a 1–5 number for a given region.
 * Regional conflicts (regional_range:true) keep BOTH endpoints; we pick the
 * region-appropriate one: cool -> favorable (Northeast) high end, warm -> low
 * (Southern) end, transition -> midpoint. This matches the brief's worked
 * example (tall fescue drought = "excellent" in the NE, "fair" in the South).
 * Non-regional ranges use the midpoint.
 */
export function tolScore(tolField, region) {
  // Accept either a tolerance FIELD (with .calculator_recommended_value) or an
  // already-unwrapped anchor. The rating always lives on the anchor.
  const tol = tolField && tolField.calculator_recommended_value ? tolField.calculator_recommended_value : tolField;
  if (!tol) return null;
  const lo = ratingNum(tol.rating_low);
  const hi = ratingNum(tol.rating_high);
  if (lo == null && hi == null) return null;
  if (lo == null) return hi;
  if (hi == null) return lo;
  if (lo === hi) return lo;
  if (tol.regional_range) {
    if (region === 'cool') return hi;
    if (region === 'warm') return lo;
    return (lo + hi) / 2;
  }
  return (lo + hi) / 2;
}

// Maintenance fields are stored as verbatim words, not ratings. Pull a level.
function levelWord(verbatimList) {
  const s = (verbatimList || []).join(' ').toLowerCase();
  if (!s) return null;
  if (s.includes('high')) return 'high'; // "medium-high" -> treat as high requirement
  if (s.includes('medium') || s.includes('moderate')) return 'medium';
  if (s.includes('low')) return 'low';
  return null;
}
const LEVEL_GOOD_WHEN_LOW = { low: 5, medium: 3, high: 2 }; // low input = better for low-effort

function maintWords(species, field) {
  const obs = species.maintenance?.[field]?.observations || [];
  return obs.map((o) => o.value).filter(Boolean);
}

const SELF_REPAIRS = /rhizom|stolon/i; // spreads laterally -> heals wear/play damage

// Which species pair well as companions when overseeding a given existing grass.
const COMPANION_MAP = {
  tall_fescue: ['kentucky_bluegrass', 'perennial_ryegrass'],
  kentucky_bluegrass: ['perennial_ryegrass', 'tall_fescue'],
  perennial_ryegrass: ['kentucky_bluegrass', 'tall_fescue'],
  mixed_cool: ['tall_fescue', 'kentucky_bluegrass', 'perennial_ryegrass'],
};

function sunFit(species, region, sun) {
  const shade = tolScore(species.tolerances?.shade, region);
  if (sun === 'full') return { value: 5, basis: 'full sun — every cool-season grass handles it' };
  if (sun === 'partial') return { value: shade ?? 3, basis: `shade tolerance ${shade ?? '—'}/5` };
  return { value: shade ?? 2, basis: `shade tolerance ${shade ?? '—'}/5 (needs good shade)` };
}

function trafficFit(species, region, traffic) {
  const wear = tolScore(species.tolerances?.wear_traffic, region);
  if (wear == null) return { value: 3, basis: 'no wear rating' };
  const repairs = SELF_REPAIRS.test(species.growth_habit || '');
  let value = wear;
  let basis = `wear ${wear}/5`;
  if ((traffic === 'kids_pets' || traffic === 'dogs') && repairs) {
    value = Math.min(5, wear + 1);
    basis = `wear ${wear}/5 +1 self-repair (${species.growth_habit})`;
  }
  return { value, basis };
}

function effortFit(species, region, water) {
  const drought = tolScore(species.tolerances?.drought, region);
  const fert = levelWord(maintWords(species, 'fertility_requirement'));
  const mow = levelWord(maintWords(species, 'mowing_frequency'));
  const fertScore = LEVEL_GOOD_WHEN_LOW[fert] ?? 3;
  const mowScore = LEVEL_GOOD_WHEN_LOW[mow] ?? 3;
  if (water === 'high') {
    // Willing to do whatever it takes -> low-input isn't a constraint; stay neutral-high.
    return { value: 4, basis: 'high-effort: input needs not limiting' };
  }
  const d = drought ?? 3;
  if (water === 'low') {
    const value = (d + fertScore + mowScore) / 3;
    return { value, basis: `drought ${d}/5, fertility ${fert ?? '?'} (${fertScore}/5), mowing ${mow ?? '?'} (${mowScore}/5)` };
  }
  // medium: weight drought more, maintenance lightly
  const value = (d * 2 + (fertScore + mowScore) / 2) / 3;
  return { value, basis: `drought ${d}/5 + moderate input` };
}

function overseedFit(species, project, existing) {
  if (project !== 'overseed') return { value: 0, applies: false, basis: 'not an overseed' };
  if (existing === species.id) return { value: 1.0, applies: true, basis: 'same as your current grass — ideal to thicken' };
  if ((COMPANION_MAP[existing] || []).includes(species.id))
    return { value: 0.5, applies: true, basis: 'pairs well with your current grass' };
  return { value: 0, applies: true, basis: 'no compatibility boost' };
}

const TRAFFIC_W = { kids_pets: 1.5, dogs: 1.5, normal: 1.0, light: 0.5 };
const EFFORT_W = { low: 1.3, medium: 1.0, high: 0.5 };

// Transition-zone preference: tall fescue is the classic transition homeowner
// pick (what an extension agent would advise), even where bermuda/zoysia score
// higher for pure full-sun durability. A modest additive bonus puts TF on top
// for typical transition lawns while still letting fine fescues win clear shade
// cases and letting an existing-grass overseed bonus keep a bermuda owner on
// bermuda. Positioning = homeowner guidance, not athletic-field optimization.
const TRANSITION_TF_BONUS = 0.75;

/**
 * Rank the grass species eligible for the region against the inputs.
 * Returns [{ id, name, total, breakdown:{sun,traffic,effort,overseed} }] sorted desc.
 * Legumes (clover) are excluded here — they're handled as a mix component.
 */
export function rankGrasses(input) {
  const { region, area, sun, traffic, water, project, existing } = input;
  const cats = categoriesForRegion(region).filter((c) => c !== 'legume');
  const wSun = 1.0;
  const wTraffic = TRAFFIC_W[traffic] ?? 1.0;
  const wEffort = EFFORT_W[water] ?? 1.0;

  return SPECIES.filter((s) => cats.includes(s.category) && specialistEligible(s.id, area))
    .map((s) => {
      const sunB = sunFit(s, region, sun);
      const trafB = trafficFit(s, region, traffic);
      const effB = effortFit(s, region, water);
      const overB = overseedFit(s, project, existing);
      const weighted =
        (sunB.value * wSun + trafB.value * wTraffic + effB.value * wEffort) /
        (wSun + wTraffic + wEffort);
      const regionBonus =
        region === 'transition' && s.id === 'tall_fescue' ? TRANSITION_TF_BONUS : 0;
      const total = weighted + overB.value + regionBonus; // additive bonuses
      return {
        id: s.id,
        name: s.common_name,
        growthHabit: s.growth_habit,
        fineFescue: s.fine_fescue_group === true,
        total,
        weighted,
        regionBonus,
        breakdown: { sun: sunB, traffic: trafB, effort: effB, overseed: overB },
      };
    })
    .sort((a, b) => b.total - a.total);
}
