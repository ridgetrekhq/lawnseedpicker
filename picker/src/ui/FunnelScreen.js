// Checkpoint 3 — the 7-field input funnel. UI + state only, no scoring yet.
// Tappable cards, minimal typing (zip is the only typed field). Copy uses the
// brand voice ("throw down", "for your area", "starting over from scratch").

import { html, useState } from '../vendor.js';
import { Field, OptionCards } from './components.js';
import { resolveZip, prefixLabel } from '../engine/zip.js';
import { recommend } from '../engine/recommend.js';
import { ResultScreen } from './ResultScreen.js';

// --- option sets ---------------------------------------------------------

const PROJECT_TYPES = [
  { value: 'new', label: 'Starting a new lawn', hint: 'Bare soil, nothing growing yet' },
  { value: 'overseed', label: 'Overseeding what I have', hint: 'Thickening up an existing lawn' },
  { value: 'restart', label: 'Starting over from scratch', hint: 'Killing it off and replanting' },
  { value: 'patch', label: 'Fixing bare patches', hint: 'Spot repair, not the whole yard' },
];

const EXISTING_GRASS = [
  { value: 'unknown', label: 'No idea', hint: "That's fine — most people don't know" },
  { value: 'tall_fescue', label: 'Tall fescue' },
  { value: 'kentucky_bluegrass', label: 'Kentucky bluegrass' },
  { value: 'perennial_ryegrass', label: 'Perennial rye' },
  { value: 'bermudagrass', label: 'Bermuda' },
  { value: 'zoysiagrass', label: 'Zoysia' },
  { value: 'mixed_cool', label: 'Mixed cool-season' },
];

const SUN = [
  { value: 'full', label: 'Full sun', hint: '6+ hours of direct sun' },
  { value: 'partial', label: 'Partial sun', hint: '3–6 hours' },
  { value: 'shade', label: 'Mostly shade', hint: 'Under 3 hours' },
];

const TRAFFIC = [
  { value: 'kids_pets', label: 'Kids & pets play here', hint: 'Lots of running around' },
  { value: 'dogs', label: 'Dogs — urine spots', hint: 'Pee burns to deal with' },
  { value: 'normal', label: 'Normal foot traffic', hint: 'Comes and goes' },
  { value: 'light', label: 'Mostly for looks', hint: 'Light use, easy on it' },
];

const WATER = [
  { value: 'low', label: 'As little as possible', hint: 'Minimal water and mowing' },
  { value: 'medium', label: 'A reasonable amount', hint: "I'll keep up with it" },
  { value: 'high', label: 'Whatever it takes', hint: 'I want it to look great' },
];

const ALTERNATIVES = [
  { value: 'grass', label: 'Grass only', hint: 'No clover, thanks' },
  { value: 'mix', label: 'Grass + a little clover', hint: 'Best of both — the popular pick' },
  { value: 'clover', label: 'Clover-forward / eco-lawn', hint: 'Low input, pollinator-friendly' },
];

const SOIL = [
  { value: 'unknown', label: 'Not sure', hint: 'Skip it' },
  { value: 'sandy', label: 'Sandy', hint: 'Drains fast, dries out' },
  { value: 'clay', label: 'Clay', hint: 'Heavy, holds water' },
  { value: 'loam', label: 'Loam / normal', hint: 'The good stuff' },
];

const INITIAL = {
  zip: '',
  projectType: null,
  existingGrass: 'unknown',
  sun: null,
  traffic: null,
  water: null,
  alternatives: 'mix', // default per brief
  soil: 'unknown', // default per brief
};

// --- screen --------------------------------------------------------------

export function FunnelScreen() {
  const [a, setA] = useState(INITIAL);
  const [showSoil, setShowSoil] = useState(false);
  const [result, setResult] = useState(null);
  const set = (k) => (v) => setA((prev) => ({ ...prev, [k]: v }));

  const zipRes = resolveZip(a.zip);
  const zipOk = zipRes.ok;

  // Required to produce a recommendation (soil + alternatives have defaults).
  const ready = zipOk && a.projectType && a.sun && a.traffic && a.water;

  if (result) {
    return html`<${ResultScreen} result=${result} onBack=${() => { setResult(null); window.scrollTo(0, 0); }} />`;
  }

  return html`
    <div class="funnel">
      <h1>What should I plant?</h1>
      <p class="lede">Tell us about your yard. Takes about half a minute — most of it is just tapping.</p>

      <${Field} num="1" question="Where's your lawn?" helper="Your zip sets your region and seeding window. It stays on your device — we never send it anywhere.">
        <div class="zip-row">
          <input
            class="zip-input"
            inputmode="numeric"
            maxlength="5"
            value=${a.zip}
            placeholder="e.g. 02052"
            onInput=${(e) => set('zip')(e.target.value)} />
          ${a.zip.length >= 3 &&
          (zipOk
            ? html`<span class="zip-result"><strong>${a.zip}</strong> → ${zipRes.area}, looks like
                <span class=${`region-chip ${zipRes.region}`}>${zipRes.region === 'transition' ? 'transition' : zipRes.region + '-season'}</span> country</span>`
            : html`<span class="zip-result muted">${zipRes.reason === 'incomplete' ? 'Keep going…' : "Hmm — double-check that zip?"}</span>`)}
        </div>
      </${Field}>

      <${Field} num="2" question="What are you doing?" helper="This sets how much seed you throw down — and what'll actually take.">
        <${OptionCards} options=${PROJECT_TYPES} value=${a.projectType} onChange=${set('projectType')} cols="2" />
        ${a.projectType === 'overseed' &&
        html`
          <div class="subfield">
            <p class="field-help">What've you got growing now?</p>
            <${OptionCards} options=${EXISTING_GRASS} value=${a.existingGrass} onChange=${set('existingGrass')} cols="3" />
          </div>`}
      </${Field}>

      <${Field} num="3" question="How much sun does it get?" helper="Pick the shadiest part you care about.">
        <${OptionCards} options=${SUN} value=${a.sun} onChange=${set('sun')} cols="3" />
      </${Field}>

      <${Field} num="4" question="Who uses the yard?">
        <${OptionCards} options=${TRAFFIC} value=${a.traffic} onChange=${set('traffic')} cols="2" />
      </${Field}>

      <${Field} num="5" question="How much work do you want to put in?">
        <${OptionCards} options=${WATER} value=${a.water} onChange=${set('water')} cols="3" />
      </${Field}>

      <${Field} num="6" question="Open to clover?" helper="Clover and microclover are first-class picks here, not afterthoughts.">
        <${OptionCards} options=${ALTERNATIVES} value=${a.alternatives} onChange=${set('alternatives')} cols="3" />
      </${Field}>

      <${Field} num="7" question="Know your soil?" optional=${true} helper="Totally fine to skip — we default to 'not sure.'">
        ${showSoil
          ? html`<${OptionCards} options=${SOIL} value=${a.soil} onChange=${set('soil')} cols="2" />`
          : html`<button type="button" class="link-btn" onClick=${() => setShowSoil(true)}>Add soil type →</button>`}
      </${Field}>

      <div class="funnel-foot">
        <button type="button" class="btn" disabled=${!ready}
          onClick=${() => { const r = recommend(a); if (r.ok) { setResult(r); window.scrollTo(0, 0); } }}>See my recommendation</button>
        ${!ready && html`<span class="muted"> Fill in zip, project, sun, traffic, and effort to continue.</span>`}
      </div>
    </div>`;
}
