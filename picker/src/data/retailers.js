// Retail blend catalog + retailer link map.
//
// SINGLE SOURCE OF TRUTH for affiliate links: every link points at a retailer
// entry here. Real tracked URLs get swapped in one place as programs approve
// (DoMyOwn / Andersons pending). Until then every link is a labeled placeholder.

export const RETAILERS = {
  placeholder: { name: 'retailer (link pending)', url: '#', affiliate: false },
  domyown: { name: 'DoMyOwn', url: '#', affiliate: true, status: 'pending' },
  andersons: { name: "The Andersons", url: '#', affiliate: true, status: 'pending' },
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
    retailer: 'placeholder',
    vendorClaim: true,
    why: 'Rhizomatous tall fescue that self-repairs worn spots — built for kids-and-pets traffic.',
  },
  {
    id: 'ttf_sun_shade',
    name: 'Turf-Type Tall Fescue · Sun & Shade Blend',
    brand: 'generic',
    seasons: ['cool', 'transition'],
    traits: ['tall_fescue', 'drought', 'sun_shade'],
    retailer: 'placeholder',
    why: 'Deep-rooted, drought- and heat-tough tall fescue — the low-water workhorse for the Northeast.',
  },
  {
    id: 'tf_kbg_mix',
    name: 'Tall Fescue + Kentucky Bluegrass Mix',
    brand: 'generic',
    seasons: ['cool', 'transition'],
    traits: ['tall_fescue', 'kentucky_bluegrass', 'self_repair', 'traffic'],
    retailer: 'placeholder',
    why: 'Tall fescue toughness plus a little bluegrass to knit in and heal traffic damage.',
  },
  {
    id: 'dense_shade_fine_fescue',
    name: 'Dense Shade · Fine Fescue Mix',
    brand: 'generic',
    seasons: ['cool', 'transition'],
    traits: ['hard_fescue', 'chewings_fescue', 'strong_creeping_red_fescue', 'sheep_fescue', 'shade', 'low_input'],
    retailer: 'placeholder',
    why: 'A blend of fine fescues — the go-to for shade and low-input lawns where bluegrass and rye give up.',
  },
  {
    id: 'eco_microclover_mix',
    name: 'Lawn + Microclover Eco Mix',
    brand: 'generic',
    seasons: ['cool', 'transition'],
    traits: ['clover', 'low_input'],
    retailer: 'placeholder',
    vendorClaim: true,
    why: 'Adds nitrogen-fixing microclover for a lower-input, greener-longer lawn.',
  },
  {
    id: 'bermuda_sun',
    name: 'Common Bermudagrass · Full-Sun Lawn',
    brand: 'generic',
    seasons: ['warm', 'transition'],
    traits: ['bermudagrass', 'traffic', 'drought', 'sun_shade'],
    retailer: 'placeholder',
    why: 'The full-sun, heat-and-traffic workhorse for the South — recovers fast from wear.',
  },
  {
    id: 'zoysia_lawn',
    name: 'Zoysiagrass Lawn Seed (Compadre/Zenith type)',
    brand: 'generic',
    seasons: ['warm', 'transition'],
    traits: ['zoysiagrass', 'drought', 'sun_shade'],
    retailer: 'placeholder',
    why: 'Dense, drought-tough turf that takes a little shade — slower to fill in, but low-fuss once established.',
  },
  {
    id: 'bahia_pensacola',
    name: 'Pensacola Bahiagrass · Low-Input',
    brand: 'generic',
    seasons: ['warm'],
    traits: ['bahiagrass', 'low_input', 'drought'],
    retailer: 'placeholder',
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

  return CATALOG.filter((p) => p.seasons.includes(season))
    .map((p) => ({ ...p, score: p.traits.filter((t) => want.has(t)).length, retailerInfo: RETAILERS[p.retailer] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
