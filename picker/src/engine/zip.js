// ZIP resolver. Turns a homeowner's zip into a growing region + hardiness band,
// entirely client-side (no network, no geolocation). See ../data/zipZones.js.

import { ZIP_PREFIX_RANGES } from '../data/zipZones.js';

/**
 * Resolve a zip (or partial zip — only the first 3 digits matter) to a region.
 * Returns:
 *   { ok:true, prefix, region, zone, area, note? }
 *   { ok:false, reason, prefix? }   when input is too short or the prefix is
 *                                   unassigned (rare; mostly military/holes).
 */
export function resolveZip(input) {
  const digits = String(input == null ? '' : input).replace(/\D/g, '');
  if (digits.length < 3) {
    return { ok: false, reason: 'incomplete', prefix: null };
  }
  const prefix = parseInt(digits.slice(0, 3), 10);
  const r = ZIP_PREFIX_RANGES.find((x) => prefix >= x.lo && prefix <= x.hi);
  if (!r) {
    return { ok: false, reason: 'unrecognized', prefix };
  }
  if (r.region === 'unknown') {
    return { ok: false, reason: 'unsupported', prefix, area: r.area };
  }
  return {
    ok: true,
    prefix,
    region: r.region,
    zone: r.zone,
    area: r.area,
    note: r.note || null,
  };
}

/** A 3-digit prefix as a zero-padded string, e.g. 20 -> "020". */
export function prefixLabel(prefix) {
  return String(prefix).padStart(3, '0');
}
