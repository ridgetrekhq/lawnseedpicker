# Seed bag coverage dataset, 2026

**43 retail grass seed products.** Manufacturer coverage claims collected from public
retail listings, compared against university extension seeding rates.

Collected 2026-09-07 from Home Depot, Lowe's, Walmart and Tractor Supply public product
pages. Licensed CC BY 4.0 — reuse freely with attribution to lawnseedpicker.com.

One row per product. Where the same product was found at more than one retailer, the
rows are merged and every retailer is listed in `retailers_seen`.

## The two coverage figures

Manufacturers publish two: **new lawn** (establishment) and **overseeding**. The
overseeding figure is roughly 3x larger. Many retail listings show only one number,
unlabeled.

**Four products in this set were found both ways** — with a single unlabeled figure at
one retailer and with both figures at another. In all four, the unlabeled figure equals
the overseeding figure exactly:

| Product | Unlabeled | Overseed | New lawn |
|---|---|---|---|
| Pennington Kentucky 31 Tall Fescue, 40 lb | 8,000 | 8,000 | 3,330 |
| Pennington Smart Seed Kentucky Bluegrass, 3 lb | 2,000 | 2,000 | 1,000 |
| Scotts Turf Builder Sun & Shade Mix, 7 lb | 2,800 | 2,800 | 930 |
| Scotts Turf Builder Sun & Shade Mix, 20 lb | 8,000 | 8,000 | 2,660 |

The `unlabeled_equals_overseed` column records this test. It is blank where only one of
the two figures was available.

## Columns

| Column | Meaning |
|---|---|
| `species` | Species as named by the product. Products named as a mix carry a `… mix` value, or plain `mix` |
| `coated` | `yes` or `no` only where a collected listing or the product name states it. **Blank means not stated, not uncoated** |
| `retailers_seen` | Every retailer this product was found at, semicolon separated |
| `coverage_new_lawn_sqft` | Manufacturer's stated establishment coverage |
| `coverage_overseed_sqft` | Manufacturer's stated overseeding coverage |
| `coverage_unlabeled_sqft` | A single figure shown with no use case stated |
| `unlabeled_equals_overseed` | `yes`/`no` where both were available; blank otherwise |
| `alt_new_lawn_sqft_other_retailer` | A differing figure for the same product at another retailer |
| `rate_*_lb_per_1000` | Net weight divided by that coverage. Our arithmetic, 2 dp |
| `extension_rate_min` / `_max` | Published extension establishment rate for the species. Blank for every product named as a mix |
| `coated_source` | Where the `coated` value comes from |

**An unlabeled figure must not be compared against an extension establishment rate.** It
is reported for transparency only. 16 of 43 rows publish both figures; 21 carry only an
unlabeled figure; 6 carry no coverage figure at all.

## Extension rate sources

Tall fescue 6-8 lb/1,000 sq ft (Penn State x2, Cornell, NC State, UMass).
Kentucky bluegrass 2-3. Perennial ryegrass 4-6. Bermudagrass 1-2.
Rutgers FS584 (2004) excluded from tall fescue as a low outlier.

Mixes carry no extension rate: a "tall fescue mix" is not 100% tall fescue, and the
blended rate is not the single-species rate. Those cells are blank by design. This applies
to every product named as a mix, including those named for a dominant species.

**Extension rates are pounds of seed.** Coating is inert weight, not seed, so a coated
product's pounds per 1,000 sq ft are not directly comparable to an extension rate. The
`coated` column records what the listings state; it is incomplete.

## Known limitations

- **Only 21 of 43 rows carry a price.** All cost columns are blank for the rest. Do not
  read the priced subset as representative of the whole.
- Home Depot prices returned from a **default store (Austin, TX)**. Lowe's gates price
  behind store selection; where a Lowe's product is priced here, the figure comes from a
  matching Walmart listing. Regional variation is real and not captured.
- Pennington Kentucky 31, 20 lb: new-lawn coverage is listed as **1,660 sq ft at one
  retailer and 1,600 at another**. Same product, same manufacturer figure, restated
  differently. Recorded in `alt_new_lawn_sqft_other_retailer`, not resolved.
- **No seed analysis tag data.** Purity, germination, weed seed, other crop, inert
  matter and test date are lot-specific, legally required on the physical bag, and not
  published online. Cost per pound of **pure live seed** cannot be computed from this
  dataset.
- Coverage figures are **published claims**, attributed to the manufacturer or retailer.
  They are not measurements and are not extension-verified.
- Forage, pasture and food-plot products were collected but are **excluded**. Their
  rates are legitimately far lower per 1,000 sq ft because they do not aim to produce
  dense turf, and comparing them against lawn establishment rates would be invalid.
  They will be published if a forage rate authority is sourced.

- **Coating status is incomplete.** 6 of 43 rows have a stated coating status. The other
  37 are blank because no collected listing or product name stated it.

## Method

Net weight and coverage as published by the retailer. Rates are net weight divided by
stated coverage, rounded to two decimals. Cost columns multiply price per pound by the
relevant rate. No figure here is measured: every one is either published by a third
party or arithmetic on published figures.

## Revisions

- **2026-09-20.** Extension rates removed from 12 products named as mixes, which had
  carried them against the rule above. `coated` set to `yes` for rows 13 and 39 from
  retailer listings; `coated_source` column added. Row counts in this README corrected
  (21 unlabeled-only, not 25). No coverage, weight or price figure changed.
