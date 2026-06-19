// Region surfacing — Checkpoint 1 deliverable.
//
// Given a region, return the eligible species with the few fields we want to
// eyeball for verification: category, seeding-rate anchor, verified flag,
// fine-fescue group membership, and any specialist geo-caveat.

import { SPECIES, anchor, isVerified, isFineFescue } from './db.js';
import { categoriesForRegion, specialistGate } from './regions.js';

export function surfaceSpecies(regionId) {
  const cats = categoriesForRegion(regionId);
  return SPECIES
    .filter((s) => cats.includes(s.category))
    .map((s) => {
      const rate = anchor(s.establishment && s.establishment.seeding_rate_new);
      const gate = specialistGate(s.id);
      return {
        id: s.id,
        name: s.common_name,
        category: s.category,
        growthHabit: s.growth_habit,
        fineFescue: isFineFescue(s),
        rate, // {min,max,unit,verified,basis} or null (e.g. white clover)
        rateVerified: rate ? isVerified(rate) : false,
        recordVerified: s.extension_verified === true,
        specialist: gate, // {where,note} or null
      };
    });
}

export function rateLabel(rate) {
  // No anchor, or an anchor with no usable number (white clover: value:null,
  // min/max absent) -> there is no extension lawn rate; the real engine falls
  // back to the microclover vendor figure (~5% of a mix), labeled vendor-sourced.
  const hasRange = rate && rate.min != null && rate.max != null;
  const hasValue = rate && rate.value != null;
  if (!hasRange && !hasValue) return 'no extension rate (vendor fallback)';
  const unit = rate.unit || 'lb/1000ft2';
  if (hasRange) {
    return rate.min === rate.max ? `${rate.min} ${unit}` : `${rate.min}–${rate.max} ${unit}`;
  }
  return `${rate.value} ${unit}`;
}
