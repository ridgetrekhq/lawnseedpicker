// Retail blend catalog + retailer link map.
//
// SINGLE SOURCE OF TRUTH for affiliate links: every link points at a retailer
// entry here. DoMyOwn approved (Awin); microclover via Amazon Associates
// (8 of 8 products linked as of July 2026).

export const RETAILERS = {
  placeholder: { name: 'retailer (link pending)', url: '#', affiliate: false },
  domyown: { name: 'DoMyOwn', url: 'https://www.awin1.com/cread.php?awinmid=88419&awinaffid=2939417&ued=https%3A%2F%2Fwww.domyown.com%2Fgrass-seed-c-59_787_544.html', affiliate: true, status: 'approved' },
  andersons: { name: "The Andersons", url: '#', affiliate: true, status: 'pending' },
  amazon: { name: 'Amazon', url: '#', affiliate: true, status: 'approved' },
};

// Must appear ADJACENT to the links (FTC), not just in the footer.
export const FTC_DISCLOSURE =
  'Some links below are affiliate links: if you buy through them we may earn a small commission, at no extra cost to you. It never changes which seed we recommend.';

// Placeholder product catalog. `traits` is used to match products to a case.
const CATALOG = [
  {
    id: 'barenbrug_watersaver_rtf',
    name: 'Water Saver® with RTF',
    brand: 'Barenbrug',
    seasons: ['cool', 'transition'],
    traits: ['tall_fescue', 'traffic', 'self_repair', 'drought'],
    retailer: 'domyown',
    url: 'https://www.awin1.com/cread.php?awinmid=88419&awinaffid=2939417&ued=https%3A%2F%2Fwww.domyown.com%2Fstar-fescue-grass-seed-blend-p-3913.html',
    vendorClaim: true,
    why: 'Rhizomatous tall fescue that self-repairs worn spots — built for kids-and-pets traffic.',
  },
  {
    id: 'ttf_sun_shade',
    name: 'Turf-Type Tall Fescue · Sun & Shade Blend',
    brand: 'generic',
    seasons: ['cool', 'transition'],
    traits: ['tall_fescue', 'drought', 'sun_shade'],
    retailer: 'domyown',
    url: 'https://www.awin1.com/cread.php?awinmid=88419&awinaffid=2939417&ued=https%3A%2F%2Fwww.domyown.com%2Ffescue-grass-seed-c-59_787_544_1289.html',
    why: 'Deep-rooted, drought- and heat-tough tall fescue — the low-water workhorse for the Northeast.',
  },
  {
    id: 'tf_kbg_mix',
    name: 'Tall Fescue + Kentucky Bluegrass Mix',
    brand: 'generic',
    seasons: ['cool', 'transition'],
    traits: ['tall_fescue', 'kentucky_bluegrass', 'self_repair', 'traffic'],
    retailer: 'domyown',
    url: 'https://www.awin1.com/cread.php?awinmid=88419&awinaffid=2939417&ued=https%3A%2F%2Fwww.domyown.com%2Fgrass-seed-c-59_787_544.html',
    why: 'Tall fescue toughness plus a little bluegrass to knit in and heal traffic damage.',
  },
  {
    id: 'dense_shade_fine_fescue',
    name: 'Dense Shade · Fine Fescue Mix',
    brand: 'generic',
    seasons: ['cool', 'transition'],
    traits: ['hard_fescue', 'chewings_fescue', 'strong_creeping_red_fescue', 'sheep_fescue', 'shade', 'low_input'],
    retailer: 'domyown',
    url: 'https://www.awin1.com/cread.php?awinmid=88419&awinaffid=2939417&ued=https%3A%2F%2Fwww.domyown.com%2Ffescue-grass-seed-c-59_787_544_1289.html',
    why: 'A blend of fine fescues — the go-to for shade and low-input lawns where bluegrass and rye give up.',
  },
  {
    id: 'eco_microclover_mix',
    name: 'Miniclover® Seed (blend into your lawn)',
    brand: 'Outsidepride',
    seasons: ['cool', 'transition'],
    traits: ['clover', 'low_input'],
    retailer: 'amazon',
    url: 'https://www.amazon.com/dp/B00E255LIU?tag=lawnseedpicke-20&linkCode=ll2&linkId=2ab95bf75897c31a1fd10783cb393b89&language=en_US',
    vendorClaim: true,
    why: 'Adds nitrogen-fixing microclover for a lower-input, greener-longer lawn.',
  },
  {
    id: 'bermuda_sun',
    name: 'Common Bermudagrass · Full-Sun Lawn',
    brand: 'generic',
    seasons: ['warm', 'transition'],
    traits: ['bermudagrass', 'traffic', 'drought', 'sun_shade'],
    retailer: 'domyown',
    url: 'https://www.awin1.com/cread.php?awinmid=88419&awinaffid=2939417&ued=https%3A%2F%2Fwww.domyown.com%2Fbermuda-grass-seed-c-59_787_544_1287.html',
    why: 'The full-sun, heat-and-traffic workhorse for the South — recovers fast from wear.',
  },
  {
    id: 'zoysia_lawn',
    name: 'Zoysiagrass Lawn Seed (Compadre/Zenith type)',
    brand: 'generic',
    seasons: ['warm', 'transition'],
    traits: ['zoysiagrass', 'drought', 'sun_shade'],
    retailer: 'domyown',
    url: 'https://www.awin1.com/cread.php?awinmid=88419&awinaffid=2939417&ued=https%3A%2F%2Fwww.domyown.com%2Fzenith-zoysia-grass-seed-p-3908.html',
    why: 'Dense, drought-tough turf that takes a little shade — slower to fill in, but low-fuss once established.',
  },
  {
    id: 'bahia_pensacola',
    name: 'Pensacola Bahiagrass · Low-Input',
    brand: 'generic',
    seasons: ['warm'],
    traits: ['bahiagrass', 'low_input', 'drought'],
    retailer: 'domyown',
    url: 'https://www.awin1.com/cread.php?awinmid=88419&awinaffid=2939417&ued=https%3A%2F%2Fwww.domyown.com%2Fpennington-bahiagrass-pensacola-grass-seed-p-11457.html',
    why: 'A tough, low-maintenance choice for sandy Gulf and Florida lawns.',
  },
];

/**
 * Pick up to 3 retail blends matching the case. Ranked by trait overlap.
 */
export function pickRetailBlends({ season, baseId, traffic, alternatives }) {
  const want = new Set();
  if (baseId) want.add(baseId);
  if (traffic === 'kids_pets' || traffic === 'dogs') {
    want.add('traffic');
    want.add('self_repair');
  }
  if (alternatives === 'mix' || alternatives === 'clover') want.add('clover');

  const ranked = CATALOG.filter((p) => p.seasons.includes(season))
    .map((p) => ({ ...p, score: p.traits.filter((t) => want.has(t)).length, retailerInfo: { ...RETAILERS[p.retailer], ...(p.url && { url: p.url }) } }))
    .sort((a, b) => b.score - a.score);

  const picks = ranked.slice(0, 3);

  // If the blend includes clover, the clover seed is a recipe component —
  // guarantee it a card rather than letting grass products outscore it.
  if (want.has('clover') && !picks.some((p) => p.traits.includes('clover'))) {
    const cloverPick = ranked.find((p) => p.traits.includes('clover'));
    if (cloverPick) picks[picks.length - 1] = cloverPick;
  }

  return picks;
}
