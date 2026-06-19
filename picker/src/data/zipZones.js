// Static ZIP-prefix -> growing-region + USDA hardiness-zone lookup.
//
// WHY THIS EXISTS: the species database has everything EXCEPT the geography that
// turns a homeowner's zip into a growing region. This is that one missing piece.
//
// DESIGN: range-based on the first 3 ZIP digits ("prefix"). The USPS allocates
// 3-digit prefixes to contiguous geographic areas (Sectional Center Facilities),
// so a handful of ranges covers all ~900 live prefixes compactly and auditably —
// far smaller than a 42,000-row per-zip table, and good enough for seed picks
// (the brief notes full per-zip precision isn't needed).
//
// PRIVACY: this table is baked into the app. The zip is resolved entirely in the
// browser and never leaves it. No API, no network call, no geolocation.
//
// region: 'cool' | 'transition' | 'warm'. `zone` is a representative USDA
// hardiness band for the area (not the headline — used for seeding-window copy).
// Split-climate states are subdivided by prefix. Coarse by design; `note` flags
// the spots where intra-area climate varies a lot (CA coast vs valley, etc.).

export const ZIP_PREFIX_RANGES = [
  { lo: 5, hi: 5, area: 'New York (Long Island)', region: 'cool', zone: '7a' },
  { lo: 6, hi: 9, area: 'Puerto Rico / U.S. Virgin Islands', region: 'warm', zone: '11a–13b' },
  { lo: 10, hi: 27, area: 'Massachusetts', region: 'cool', zone: '5b–7a' },
  { lo: 28, hi: 29, area: 'Rhode Island', region: 'cool', zone: '6a–7a' },
  { lo: 30, hi: 38, area: 'New Hampshire', region: 'cool', zone: '4a–6a' },
  { lo: 39, hi: 49, area: 'Maine', region: 'cool', zone: '3b–6a' },
  { lo: 50, hi: 59, area: 'Vermont', region: 'cool', zone: '3b–5b' },
  { lo: 60, hi: 69, area: 'Connecticut', region: 'cool', zone: '5b–7a' },
  { lo: 70, hi: 89, area: 'New Jersey', region: 'cool', zone: '6a–7b' },
  { lo: 90, hi: 98, area: 'Military (overseas APO/FPO)', region: 'unknown', zone: '—' },
  { lo: 100, hi: 149, area: 'New York', region: 'cool', zone: '4a–7b' },
  { lo: 150, hi: 196, area: 'Pennsylvania', region: 'cool', zone: '5a–7a' },
  { lo: 197, hi: 199, area: 'Delaware', region: 'transition', zone: '7a' },
  { lo: 200, hi: 205, area: 'Washington, D.C.', region: 'transition', zone: '7a–7b' },
  { lo: 206, hi: 219, area: 'Maryland', region: 'transition', zone: '6b–7b' },
  { lo: 220, hi: 246, area: 'Virginia', region: 'transition', zone: '6b–7b' },
  { lo: 247, hi: 268, area: 'West Virginia', region: 'transition', zone: '5b–7a', note: 'Mountain counties run cooler (cool-season).' },
  { lo: 270, hi: 289, area: 'North Carolina', region: 'transition', zone: '6b–8a', note: 'Classic transition zone; mountains cooler, coastal plain warmer.' },
  { lo: 290, hi: 292, area: 'South Carolina (Columbia & midlands)', region: 'warm', zone: '8a–8b' },
  { lo: 293, hi: 293, area: 'South Carolina (Spartanburg, Upstate)', region: 'transition', zone: '7b–8a' },
  { lo: 294, hi: 295, area: 'South Carolina (Charleston/Florence/Grand Strand)', region: 'warm', zone: '8a–9a' },
  { lo: 296, hi: 298, area: 'South Carolina (Greenville/Anderson/Aiken, Upstate)', region: 'transition', zone: '7a–8a', note: 'Upstate SC — tall-fescue country.' },
  { lo: 299, hi: 299, area: 'South Carolina (Beaufort/Hilton Head coast)', region: 'warm', zone: '8b–9a' },
  { lo: 300, hi: 310, area: 'Georgia (Atlanta & north)', region: 'transition', zone: '7a–8a' },
  { lo: 311, hi: 319, area: 'Georgia (south)', region: 'warm', zone: '8a–9a' },
  { lo: 320, hi: 349, area: 'Florida', region: 'warm', zone: '8b–11a' },
  { lo: 350, hi: 359, area: 'Alabama (north & central)', region: 'transition', zone: '7b–8a' },
  { lo: 360, hi: 369, area: 'Alabama (south)', region: 'warm', zone: '8b–9a' },
  { lo: 370, hi: 385, area: 'Tennessee', region: 'transition', zone: '6b–8a' },
  { lo: 386, hi: 388, area: 'Mississippi (north)', region: 'transition', zone: '7b–8a' },
  { lo: 389, hi: 397, area: 'Mississippi (central & south)', region: 'warm', zone: '8a–9a' },
  { lo: 398, hi: 399, area: 'Georgia (far south)', region: 'warm', zone: '8b–9a' },
  { lo: 400, hi: 427, area: 'Kentucky', region: 'transition', zone: '6a–7a' },
  { lo: 430, hi: 459, area: 'Ohio', region: 'cool', zone: '5b–6b', note: 'Far southern Ohio edges into transition.' },
  { lo: 460, hi: 469, area: 'Indiana (north & central)', region: 'cool', zone: '5b–6a' },
  { lo: 470, hi: 479, area: 'Indiana (south)', region: 'transition', zone: '6a–6b' },
  { lo: 480, hi: 499, area: 'Michigan', region: 'cool', zone: '4b–6b' },
  { lo: 500, hi: 528, area: 'Iowa', region: 'cool', zone: '4b–5b' },
  { lo: 530, hi: 549, area: 'Wisconsin', region: 'cool', zone: '3b–5b' },
  { lo: 550, hi: 567, area: 'Minnesota', region: 'cool', zone: '3a–5a' },
  { lo: 570, hi: 577, area: 'South Dakota', region: 'cool', zone: '4a–5a' },
  { lo: 580, hi: 588, area: 'North Dakota', region: 'cool', zone: '3a–4b' },
  { lo: 590, hi: 599, area: 'Montana', region: 'cool', zone: '3b–5a' },
  { lo: 600, hi: 617, area: 'Illinois (north)', region: 'cool', zone: '5a–6a' },
  { lo: 618, hi: 629, area: 'Illinois (central & south)', region: 'transition', zone: '6a–7a' },
  { lo: 630, hi: 658, area: 'Missouri', region: 'transition', zone: '5b–7a' },
  { lo: 660, hi: 679, area: 'Kansas', region: 'transition', zone: '5b–7a', note: 'Drier western KS is buffalograss country.' },
  { lo: 680, hi: 689, area: 'Nebraska (east & south)', region: 'transition', zone: '4b–5b' },
  { lo: 690, hi: 693, area: 'Nebraska (west panhandle)', region: 'cool', zone: '4a–5a' },
  { lo: 700, hi: 714, area: 'Louisiana', region: 'warm', zone: '8b–9b' },
  { lo: 716, hi: 719, area: 'Arkansas (south)', region: 'warm', zone: '7b–8b' },
  { lo: 720, hi: 729, area: 'Arkansas (central & north)', region: 'transition', zone: '6b–7b' },
  { lo: 730, hi: 749, area: 'Oklahoma', region: 'transition', zone: '6b–8a', note: 'Southern OK leans warm; panhandle is dry plains.' },
  { lo: 750, hi: 754, area: 'Texas (DFW & northeast)', region: 'transition', zone: '7b–8a' },
  { lo: 755, hi: 769, area: 'Texas (east & central)', region: 'warm', zone: '8a–9a' },
  { lo: 770, hi: 779, area: 'Texas (Houston & Gulf)', region: 'warm', zone: '9a–9b' },
  { lo: 780, hi: 789, area: 'Texas (south & south-central)', region: 'warm', zone: '8b–10a' },
  { lo: 790, hi: 794, area: 'Texas (Panhandle & South Plains)', region: 'transition', zone: '6b–7b', note: 'Amarillo/Lubbock — dry plains, buffalograss country.' },
  { lo: 795, hi: 799, area: 'Texas (west & far west)', region: 'warm', zone: '7b–8b' },
  { lo: 800, hi: 816, area: 'Colorado', region: 'cool', zone: '3b–6a', note: 'Eastern plains are buffalograss country.' },
  { lo: 820, hi: 831, area: 'Wyoming', region: 'cool', zone: '3b–5b' },
  { lo: 832, hi: 838, area: 'Idaho', region: 'cool', zone: '4a–6b' },
  { lo: 840, hi: 846, area: 'Utah (north & central)', region: 'cool', zone: '5a–7a' },
  { lo: 847, hi: 847, area: 'Utah (St. George / south)', region: 'warm', zone: '8a–8b' },
  { lo: 850, hi: 859, area: 'Arizona (Phoenix–Tucson & south)', region: 'warm', zone: '9a–10a' },
  { lo: 860, hi: 865, area: 'Arizona (northern high country)', region: 'cool', zone: '5b–7a', note: 'Flagstaff/high elevation — cold winters.' },
  { lo: 870, hi: 872, area: 'New Mexico (Albuquerque & central)', region: 'transition', zone: '7a–7b' },
  { lo: 873, hi: 877, area: 'New Mexico (north, Santa Fe)', region: 'cool', zone: '5b–6b', note: 'High elevation — cold.' },
  { lo: 878, hi: 884, area: 'New Mexico (south)', region: 'warm', zone: '7b–8b' },
  { lo: 889, hi: 893, area: 'Nevada (Las Vegas & south)', region: 'warm', zone: '9a–10a' },
  { lo: 894, hi: 898, area: 'Nevada (Reno & north)', region: 'cool', zone: '5b–7a' },
  { lo: 900, hi: 928, area: 'California (Southern California)', region: 'warm', zone: '8b–10b', note: 'Hot inland & deserts; immediate coast is milder.' },
  { lo: 930, hi: 939, area: 'California (south-central coast & San Joaquin Valley)', region: 'warm', zone: '8b–9b' },
  { lo: 940, hi: 951, area: 'California (Bay Area & Central Coast)', region: 'cool', zone: '9a–10a', note: 'Mild marine climate — cool-season grasses thrive year-round despite the warm zone number.' },
  { lo: 952, hi: 961, area: 'California (Sacramento Valley & far north)', region: 'transition', zone: '8b–9b', note: 'Hot inland summers; far-north mountains are cooler.' },
  { lo: 962, hi: 966, area: 'Military (Pacific APO/FPO)', region: 'unknown', zone: '—' },
  { lo: 967, hi: 968, area: 'Hawaii', region: 'warm', zone: '11a–13a' },
  { lo: 969, hi: 969, area: 'Guam & Pacific territories', region: 'warm', zone: '12a–13b' },
  { lo: 970, hi: 979, area: 'Oregon', region: 'cool', zone: '5a–9a', note: 'Mild west of the Cascades; high-desert east is colder.' },
  { lo: 980, hi: 994, area: 'Washington', region: 'cool', zone: '4b–9a' },
  { lo: 995, hi: 999, area: 'Alaska', region: 'cool', zone: '1a–4b' },
];

export const ZIP_TABLE_META = {
  basis: 'USPS 3-digit ZIP prefix (Sectional Center Facility) geographic allocation, classified to turfgrass growing regions (cool/transition/warm) with representative USDA hardiness bands.',
  granularity: '3-digit prefix ranges',
  precision_note: 'Coarse by design. Split-climate states are subdivided by prefix; some prefixes still span sub-climates (esp. CA, AZ, NM, TX, GA, AL). Region drives species eligibility; the exact hardiness band is only used for seeding-window copy.',
};
