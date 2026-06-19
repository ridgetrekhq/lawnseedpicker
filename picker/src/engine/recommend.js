// Orchestrator: funnel state -> full recommendation.
// Pure function, no UI. Returns everything the result screen needs, including
// the per-species scoring breakdown so the output stays hand-verifiable.

import { resolveZip } from './zip.js';
import { rankGrasses } from './scoring.js';
import { buildBlend } from './blend.js';
import { seedingWindow } from './window.js';
import { pickRetailBlends } from '../data/retailers.js';

export function recommend(state) {
  const zip = resolveZip(state.zip);
  if (!zip.ok) return { ok: false, reason: 'zip', zip };

  const input = {
    region: zip.region,
    zone: zip.zone,
    area: zip.area,
    sun: state.sun,
    traffic: state.traffic,
    water: state.water,
    project: state.projectType,
    existing: state.projectType === 'overseed' ? state.existingGrass : null,
    alternatives: state.alternatives,
    soil: state.soil,
  };

  const ranked = rankGrasses(input);
  const blend = buildBlend(input, ranked);
  const window = seedingWindow(zip.region, blend.season);
  const retail = pickRetailBlends({
    season: blend.season,
    baseId: blend.components[0]?.id,
    traffic: input.traffic,
    alternatives: input.alternatives,
  });

  return { ok: true, zip, input, ranked, blend, window, retail };
}
