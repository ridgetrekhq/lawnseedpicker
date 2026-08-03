// Retail blend catalog + retailer link map.
//
// SINGLE SOURCE OF TRUTH for affiliate links: every link points at a retailer
// entry here. DoMyOwn approved (Awin); three products via Amazon Associates
// (8 of 8 products linked as of July 2026).
//
// Awin attribution: each DoMyOwn deep link carries a `clickref=picker-<product>`
// label so per-product performance is visible in Awin reporting. clickref is a
// passthrough label and does NOT change where the shopper lands. As of 7/31/26
// every DoMyOwn card resolves to its own PRODUCT page — no two cards share a
// category URL any more, so clickref is now a convenience rather than the only
// way to tell cards apart. (Amazon links use the Associates tag, not clickref;
// the pre-existing SiteStripe params on the microclover link are left as-is.)
//
// 8/3/26 Amazon attribution split. All three Amazon cards below use tracking ID
// `lsppicker-20`; every non-picker Amazon link on the site keeps
// `lawnseedpicke-20`. Purpose: microclover (B00E255LIU) is linked from BOTH the
// picker and clover-lawn.html, so picker-vs-content origin was unreadable and
// microclover is ~35% of lifetime revenue. Amazon reporting splits by tracking
// ID going forward; it does NOT backfill. Secondary benefit: the two slots
// repointed to Amazon on 7/31 (tf_kbg_mix, dense_shade_fine_fescue) now report
// separately from guide links, so the accuracy-over-commission tradeoff taken
// that day becomes measurable.
//
// 7/31/26 category-page repoint. Three cool-season cards previously landed on
// DoMyOwn CATEGORY pages, where 7 of 14 fescue products showed out of stock and
// the shopper had to guess which one the picker meant. Verified 7/31/26:
//   - DoMyOwn has NO in-stock tall-fescue + Kentucky-bluegrass mix. Both
//     candidates (p-22486 Smart Seed Pro, p-8819 Smart Seed Fescue/Bluegrass)
//     are discontinued and out of stock.
//   - DoMyOwn has NO true fine-fescue product. The nearest, 5 Star Extreme
//     Shade (p-24295), is 60% tall fescue — linking it from a card whose `why`
//     says "a blend of fine fescues" would repeat the Barenbrug mismatch fixed
//     earlier the same day.
// Those two slots therefore moved to Amazon (Outsidepride, same supplier as the
// microclover card). Lower commission rate than Awin's confirmed 6.0%, taken
// deliberately: an accurate in-stock product beats a higher rate on a category
// page that may not contain the recommended seed at all.

export const RETAILERS = {
  placeholder: { name: 'retailer (link pending)', url: '#', affiliate: false },
  domyown: { name: 'DoMyOwn', url: 'https://www.awin1.com/cread.php?awinmid=88419&awinaffid=2939417&clickref=picker-domyown&ued=https%3A%2F%2Fwww.domyown.com%2Fgrass-seed-c-59_787_544.html', affiliate: true, status: 'approved' },
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
    name: 'Turf Saver® RTF®',
    brand: 'Barenbrug',
    seasons: ['cool', 'transition'],
    traits: ['tall_fescue', 'traffic', 'self_repair', 'drought'],
    retailer: 'domyown',
    url: 'https://www.awin1.com/cread.php?awinmid=88419&awinaffid=2939417&clickref=picker-rtf&ued=https%3A%2F%2Fwww.domyown.com%2Fbarenbrug-turf-saver-rtf-rhizomatous-tall-fescue-with-yellow-jacket-p-24179.html',
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
    // The Rebels Tall Fescue Blend, Powder Coated (p-8786). All tall fescue;
    // vendor states "grows well in partial shade to full sun" and withstands
    // heavy traffic and drought — matches this card's traits as written.
    // Sizes on one page: 3 / 7 / 20 / 40 lb ($22.57–$110.07), buy-2 pricing.
    // NOTE: Pennington states the varietal mix changes with availability and is
    // not printed on the bag. Still 100% tall fescue, so no card claim breaks,
    // but do not add cultivar-level claims to this card.
    url: 'https://www.awin1.com/cread.php?awinmid=88419&awinaffid=2939417&clickref=picker-ttf-sunshade&ued=https%3A%2F%2Fwww.domyown.com%2Fthe-rebels-tall-fescue-blend-powder-coated-grass-seed-p-8786.html',
    why: 'Deep-rooted, drought- and heat-tough tall fescue — the low-water workhorse for the Northeast.',
  },
  {
    id: 'tf_kbg_mix',
    name: 'Tall Fescue + Kentucky Bluegrass Mix',
    brand: 'generic',
    seasons: ['cool', 'transition'],
    traits: ['tall_fescue', 'kentucky_bluegrass', 'self_repair', 'traffic'],
    // Outsidepride Combat Extreme Northern Zone, 10 lb (B01C4R4M5K).
    // Vendor states 90% turf-type tall fescue / 10% Kentucky bluegrass by
    // weight, sown at 6-8 lb per 1,000 sq ft — the same rate the picker
    // outputs for tall fescue. "A little bluegrass" in the `why` below is
    // literally accurate at 10%.
    // Other sizes: 5 lb B01C4R4J8A · 25 lb B0B13XHP9Y · 50 lb B0B142ZLHW.
    // CAVEAT: the listing is positioned for USDA Zones 4-5 while this card also
    // serves `transition`. Fine agronomically (TF+KBG is standard cool-season),
    // but do not echo the vendor's zone framing in guide copy. Also note the
    // vendor's own bullet copy miscalls this a "fine fescue mix" — it is not.
    retailer: 'amazon',
    url: 'https://www.amazon.com/dp/B01C4R4M5K?tag=lsppicker-20',
    why: 'Tall fescue toughness plus a little bluegrass to knit in and heal traffic damage.',
  },
  {
    id: 'dense_shade_fine_fescue',
    name: 'Dense Shade · Fine Fescue Mix',
    brand: 'generic',
    seasons: ['cool', 'transition'],
    traits: ['hard_fescue', 'chewings_fescue', 'strong_creeping_red_fescue', 'sheep_fescue', 'shade', 'low_input'],
    // Outsidepride Legacy Fine Fescue Mix, 10 lb (B004MN5NO4).
    // Vendor states 20% hard fescue / 40% chewings / 40% creeping red — three
    // of the four fine-fescue species in `traits` above, and NO tall fescue.
    // This is the only accurate fine-fescue option found across both networks.
    // Other size: 5 lb B004MNATTS.
    retailer: 'amazon',
    url: 'https://www.amazon.com/dp/B004MN5NO4?tag=lsppicker-20',
    why: 'A blend of fine fescues — the go-to for shade and low-input lawns where bluegrass and rye give up.',
  },
  {
    id: 'eco_microclover_mix',
    name: 'Miniclover® Seed (blend into your lawn)',
    brand: 'Outsidepride',
    seasons: ['cool', 'transition'],
    traits: ['clover', 'low_input'],
    retailer: 'amazon',
    url: 'https://www.amazon.com/dp/B00E255LIU?tag=lsppicker-20&linkCode=ll2&linkId=2ab95bf75897c31a1fd10783cb393b89&language=en_US',
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
    url: 'https://www.awin1.com/cread.php?awinmid=88419&awinaffid=2939417&clickref=picker-bermuda&ued=https%3A%2F%2Fwww.domyown.com%2Fbermuda-grass-seed-c-59_787_544_1287.html',
    why: 'The full-sun, heat-and-traffic workhorse for the South — recovers fast from wear.',
  },
  {
    id: 'zoysia_lawn',
    name: 'Zoysiagrass Lawn Seed (Compadre/Zenith type)',
    brand: 'generic',
    seasons: ['warm', 'transition'],
    traits: ['zoysiagrass', 'drought', 'sun_shade'],
    retailer: 'domyown',
    url: 'https://www.awin1.com/cread.php?awinmid=88419&awinaffid=2939417&clickref=picker-zoysia&ued=https%3A%2F%2Fwww.domyown.com%2Fzenith-zoysia-grass-seed-p-3908.html',
    why: 'Dense, drought-tough turf that takes a little shade — slower to fill in, but low-fuss once established.',
  },
  {
    id: 'bahia_pensacola',
    name: 'Pensacola Bahiagrass · Low-Input',
    brand: 'generic',
    seasons: ['warm'],
    traits: ['bahiagrass', 'low_input', 'drought'],
    retailer: 'domyown',
    url: 'https://www.awin1.com/cread.php?awinmid=88419&awinaffid=2939417&clickref=picker-bahia&ued=https%3A%2F%2Fwww.domyown.com%2Fpennington-bahiagrass-pensacola-grass-seed-p-11457.html',
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
