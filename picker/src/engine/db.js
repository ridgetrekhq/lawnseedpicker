// Database access layer.
// The species DB ships as an ES module (../data/database.js) so the app needs
// no server and no build step. This module exposes typed-ish accessors and the
// small set of read helpers the rest of the engine relies on.

import database from '../data/database.js';

export const DB = database;
export const SPECIES = database.species;
export const SOURCES = database.sources;

/** Look up a species record by its `id`. */
export function getSpecies(id) {
  return SPECIES.find((s) => s.id === id) || null;
}

/**
 * Pull the single trusted value the calculator should use for a field.
 * Per the data contract we NEVER re-derive from observations[] — the
 * calculator_recommended_value anchor was set during the founder audit.
 * Returns null when the field has no anchor (e.g. white_clover seeding_rate_new).
 */
export function anchor(field) {
  if (!field || typeof field !== 'object') return null;
  return field.calculator_recommended_value || null;
}

/**
 * Is this anchor extension-verified, or vendor-only?
 * White clover's seeding rate has no anchor at all -> treat as unverified.
 */
export function isVerified(anchorValue) {
  return !!(anchorValue && anchorValue.verified === true);
}

/** The four fine fescues share UMass group-row tolerance ratings. */
export function isFineFescue(species) {
  return species.fine_fescue_group === true;
}
