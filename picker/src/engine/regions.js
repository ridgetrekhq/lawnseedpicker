// Growing-region model.
//
// A zip resolves (via the static prefix table — built separately) to one of three
// regions. Region maps to which species *categories* are eligible. This is the
// DERIVED region-gate the data contract calls for: there is no stored region flag
// on species, only `category` (cool_season_grass | warm_season_grass | legume).

export const REGIONS = {
  cool: {
    id: 'cool',
    label: 'Cool-season',
    blurb: 'Cold winters, mild summers — fescues, bluegrass, ryegrass country.',
    categories: ['cool_season_grass', 'legume'],
  },
  transition: {
    id: 'transition',
    label: 'Transition zone',
    blurb: 'The hard middle — both cool- and warm-season grasses can work.',
    categories: ['cool_season_grass', 'warm_season_grass', 'legume'],
  },
  warm: {
    id: 'warm',
    label: 'Warm-season',
    blurb: 'Hot summers, mild winters — bermuda, zoysia, bahia, buffalo.',
    categories: ['warm_season_grass', 'legume'],
  },
};

export function categoriesForRegion(regionId) {
  const r = REGIONS[regionId];
  return r ? r.categories : [];
}

// Warm-season "specialists" need geographic gating beyond cool/warm/transition:
// they should not surface as defaults outside their adapted sub-region. There is
// no stored gate field — this is derived from category + climate notes + the
// cold-tolerance anchor. The precise geo predicate plugs in once the zip-prefix
// table (with state/sub-region detail) exists; until then we surface them with a
// plain-language caveat rather than silently hiding or wrongly recommending them.
export const SPECIALIST_GATES = {
  buffalograss: {
    where: 'West & Great Plains, low-rainfall areas',
    note: 'Best in dry, low-rainfall regions of the Plains and West — not for humid lawns.',
  },
  bahiagrass: {
    where: 'Gulf Coast & Florida, sandy/acid soils',
    note: 'A Deep South / Gulf grass for sandy, acidic soils — not cold-hardy.',
  },
  bermudagrass: {
    where: 'Warm & lower transition zone',
    note: 'Common (seeded) bermuda is not reliably cold-hardy; keep it out of cold-winter areas.',
  },
  zoysiagrass: {
    where: 'Warm & transition zone',
    note: 'Seeded types (Compadre/Zenith) suit warm and transition lawns; slow to establish.',
  },
};

export function specialistGate(speciesId) {
  return SPECIALIST_GATES[speciesId] || null;
}

// Geographic gating for the warm-season specialists, derived from the zip's
// `area` string (no stored gate field). Keeps buffalograss out of humid lawns
// and bahiagrass out of anywhere but the Gulf/Deep South.
const DRY_PLAINS_WEST = /Plains|Panhandle|Colorado|Wyoming|Montana|Nebraska|Dakota|Kansas|New Mexico|Utah|Nevada|Idaho/i;
const GULF_DEEP_SOUTH = /Florida|Louisiana|Hilton Head|Beaufort|Charleston|Grand Strand|Alabama \(south|Mississippi \(central|Georgia \(south|Georgia \(far south|Texas \(Houston|Texas \(south|Texas \(east|South Carolina \(Columbia|South Carolina \(Charleston|South Carolina \(Beaufort/i;

/**
 * Is this species appropriate for the given area? Only the warm-season
 * specialists are gated; everything else passes (category + region already
 * handled eligibility). NOTE/limitation: buffalograss is warm-season by
 * physiology but cold-hardy Plains-adapted; because the category gate treats it
 * as warm-season, it won't surface in zips we classify 'cool' (e.g. the Denver
 * Front Range). Acceptable for now — its data is prose-only — flagged to revisit.
 */
export function specialistEligible(speciesId, area) {
  const a = area || '';
  if (speciesId === 'buffalograss') return DRY_PLAINS_WEST.test(a);
  if (speciesId === 'bahiagrass') return GULF_DEEP_SOUTH.test(a);
  return true;
}
