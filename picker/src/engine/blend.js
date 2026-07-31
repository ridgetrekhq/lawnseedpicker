// DIY blend builder + seeding-rate math.
// Takes the ranked grasses and the inputs, and produces a concrete blend:
// species + percent share + lb/1000ft² per component, plus the project-adjusted
// total rate. Clover is added as a mix component per the alternatives toggle.

import { getSpecies, anchor } from './db.js';

const SELF_REPAIRS = /rhizom|stolon/i;

// New-lawn rate midpoint (lb/1000ft²) from the species anchor. Clover anchors
// carry no usable number (white clover) or are vendor-only (microclover); the
// caller passes a fallback for those.
function newRateMid(speciesId, fallback) {
  const s = getSpecies(speciesId);
  const a = anchor(s?.establishment?.seeding_rate_new);
  if (a && a.min != null && a.max != null) return (a.min + a.max) / 2;
  if (a && a.value != null) return a.value;
  return fallback;
}

// Project type -> fraction of the full new-lawn rate.
const PROJECT_FACTOR = { new: 1.0, restart: 1.0, patch: 1.0, overseed: 0.5 };

// Clover share of the blend by weight, per the alternatives toggle.
const CLOVER_SHARE = { grass: 0, mix: 5, clover: 25 };

/**
 * Build the recommended blend.
 * @returns {{
 *   components: Array<{id,name,role,share,rateMid,lbPer1000,verified,vendor}>,
 *   totalRatePer1000:number, projectFactor:number, rtf:Object|null, season:string
 * }}
 */
export function buildBlend(input, ranked) {
  const { region, project, existing, alternatives, traffic } = input;

  // Base species: when overseeding, lead with what's already there (thicken it),
  // as long as it's one of the eligible/ranked grasses; otherwise the top pick.
  let base = ranked[0];
  if (project === 'overseed' && existing && ranked.some((r) => r.id === existing)) {
    base = ranked.find((r) => r.id === existing);
  }
  const baseSeason = seasonOf(base.id);
  const baseBunch = !SELF_REPAIRS.test(base.growthHabit || '');

  // Repair companion: under real traffic, a bunch-type base can't heal its own
  // wear — add the best-ranked self-repairing (rhizomatous) grass to knit it in.
  // MUST be the same season as the base — never blend warm- and cool-season
  // grasses. Only cool-season bunch bases get one; warm-season lawns (bermuda /
  // zoysia) are typically grown as single-species stands.
  let repair = null;
  if (baseSeason === 'cool' && baseBunch && ['kids_pets', 'dogs', 'normal'].includes(traffic)) {
    repair = ranked.find(
      (r) => r.id !== base.id && seasonOf(r.id) === baseSeason && SELF_REPAIRS.test(r.growthHabit || '')
    );
  }

  const cloverShare = CLOVER_SHARE[alternatives] ?? 0;
  const grassShare = 100 - cloverShare;

  // Distribute grass share: base dominant, repair companion a knit-in minority.
  const grassParts = [];
  if (repair) {
    grassParts.push({ id: base.id, role: 'base', share: Math.round(grassShare * 0.88) });
    grassParts.push({ id: repair.id, role: 'repair', share: grassShare - Math.round(grassShare * 0.88) });
  } else {
    grassParts.push({ id: base.id, role: 'base', share: grassShare });
  }

  const parts = [...grassParts];
  if (cloverShare > 0) {
    // Lawn clover rate is vendor-only; use microclover (the lawn product) at a
    // vendor fallback midpoint (~1.5 lb/1000ft² pure stand). Labeled vendor.
    parts.push({ id: 'microclover', role: 'clover', share: cloverShare });
  }

  // Rates
  const factor = PROJECT_FACTOR[project] ?? 1.0;
  const components = parts.map((p) => {
    const s = getSpecies(p.id);
    const rateMid = newRateMid(p.id, 1.5); // 1.5 = microclover vendor fallback
    return {
      id: p.id,
      name: s.common_name,
      role: p.role,
      share: p.share,
      rateMid,
      verified: anchor(s?.establishment?.seeding_rate_new)?.verified === true,
      vendor: p.id === 'microclover',
    };
  });

  const blendNewRate = components.reduce((sum, c) => sum + (c.share / 100) * c.rateMid, 0);
  const totalRatePer1000 = +(blendNewRate * factor).toFixed(2);
  components.forEach((c) => {
    c.lbPer1000 = +((c.share / 100) * totalRatePer1000).toFixed(2);
  });

  // RTF (self-repairing tall fescue cultivar) call-out when TF is in the blend.
  let rtf = null;
  if (components.some((c) => c.id === 'tall_fescue')) {
    const tf = getSpecies('tall_fescue');
    const c = (tf.cultivars || []).find((x) => /RTF|Water ?Saver/i.test(x.name));
    if (c) rtf = { name: 'Turf Saver RTF (Rhizomatous Tall Fescue, Barenbrug)', source: c.source_ids?.[0] || 'vendor' };
  }

  return { components, totalRatePer1000, projectFactor: factor, rtf, season: seasonOf(base.id) };
}

export function seasonOf(speciesId) {
  const s = getSpecies(speciesId);
  if (!s) return 'cool';
  if (s.category === 'warm_season_grass') return 'warm';
  return 'cool';
}
