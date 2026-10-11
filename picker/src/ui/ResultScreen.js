// Result screen — the three outputs: retail blends, DIY recipe, seeding window.
// Plus a "how we chose" breakdown so the recommendation is hand-verifiable
// against the database.

import { html, useState } from '../vendor.js';
import { FTC_DISCLOSURE } from '../data/retailers.js';
import { track } from '../track.js';

const fmt1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
const ROLE_LABEL = { base: 'Base', repair: 'Self-repair', clover: 'Clover' };

function WindowBanner({ w }) {
  const cls = w.state === 'open' ? 'win-open' : 'win-early';
  return html`
    <div class=${`window-banner ${cls}`}>
      <span class="win-icon">${w.state === 'open' ? '✓' : '◷'}</span>
      <div>
        <strong>${w.state === 'open' ? "It's seeding season" : "You're a little early"}</strong>
        <div>${w.message}</div>
      </div>
    </div>`;
}

function DiyRecipe({ blend }) {
  const [area, setArea] = useState(5000);
  const per1000 = blend.totalRatePer1000;
  const totalLbs = (per1000 * (area || 0)) / 1000;
  return html`
    <section class="output">
      <h2>Your custom blend</h2>
      <p class="muted">
        Mixed by weight. Total seeding rate${' '}
        <strong>${fmt1(per1000)} lb per 1,000 sq ft</strong>
        ${blend.projectFactor < 1 ? ' (overseeding rate — about half a new lawn)' : ' (new-lawn rate)'}.
      </p>
      <table class="recipe">
        <thead><tr><th>Seed</th><th>Role</th><th>Share</th><th>lb / 1,000 ft²</th></tr></thead>
        <tbody>
          ${blend.components.map(
            (c) => html`
              <tr key=${c.id}>
                <td>
                  <strong>${c.name}</strong>
                  ${c.vendor && html`<span class="tag tag-warn">vendor rate</span>`}
                </td>
                <td>${ROLE_LABEL[c.role] || c.role}</td>
                <td>${c.share}%</td>
                <td>${fmt1(c.lbPer1000)}</td>
              </tr>`
          )}
        </tbody>
      </table>

      <div class="area-row">
        <label>Your lawn size: <input type="number" min="0" step="500" value=${area}
          onInput=${(e) => setArea(parseFloat(e.target.value) || 0)} /> sq ft</label>
        <span class="area-total">→ buy about <strong>${fmt1(totalLbs)} lb</strong> total</span>
      </div>

      ${blend.rtf &&
      html`<p class="rtf-callout">
        <strong>Worth a look for kids and pets:</strong> ${blend.rtf.name} — a tall fescue that
        spreads to repair its own worn spots <span class="muted">(manufacturer claim, not extension-verified)</span>.
      </p>`}

      ${blend.components.some((c) => c.vendor) &&
      html`<p class="honesty muted">
        Clover lawn rates are manufacturer-sourced (no university extension rate exists for clover in
        lawns) — that one row isn't extension-verified. Everything else is.
      </p>`}
    </section>`;
}

function RetailBlends({ retail }) {
  return html`
    <section class="output" id="buy">
      <h2>Buy this blend</h2>
      <p class="disclosure-inline">${FTC_DISCLOSURE}</p>
      <div class="retail-grid">
        ${retail.map(
          (p, i) => html`
            <div class="retail-card" key=${p.id}>
              <div class="retail-name">${p.name}</div>
              <div class="retail-brand muted">${p.brand !== 'generic' ? p.brand : ''}</div>
              <p class="retail-why">${p.why}</p>
              ${p.retailerInfo.url === '#'
                ? html`<span class="btn ghost" style="opacity:.5;cursor:default">Coming soon</span>`
                : html`<a class="btn" href=${p.retailerInfo.url} target="_blank" rel="noopener sponsored"
                    onClick=${() => track('picker_retail_click', { product_id: p.id, retailer: p.retailer, card_position: i + 1 })}>
                    Shop at ${p.retailerInfo.name} ${'›'}
                  </a>`}
              <div class="retail-status muted">${p.retailerInfo.name}${p.vendorClaim ? ' · vendor claims' : ''}</div>
            </div>`
        )}
      </div>
    </section>`;
}

// Picker -> guide links (plan section 6 row 5, 10/11/26).
// Up to three guides matched to the visitor's answers. Link text is the guide's
// own title only: no claims are made here, so nothing needs a source.
// Fires picker_guide_click { guide, link_position } to measure the plan's
// ">= 5% of picker sessions click through" check.
const GUIDES = {
  clover_overseed: { href: '/overseeding-with-clover', title: 'Overseeding Clover Into an Existing Lawn' },
  clover_lawn: { href: '/clover-lawn', title: 'Clover Lawns' },
  dogs: { href: '/dog-urine-spots-lawn', title: 'Dog Urine Spots on the Lawn' },
  shade: { href: '/shade-grass-seed', title: 'Best Grass Seed for Shade' },
  overseed: { href: '/overseeding-fall-vs-spring', title: 'Overseeding: Fall vs. Spring' },
  restart: { href: '/restart-lawn-from-scratch', title: 'How to Restart Your Lawn From Scratch' },
  patch: { href: '/how-to-reseed-a-lawn', title: 'How to Reseed a Lawn' },
  watering: { href: '/watering-new-grass-seed', title: 'How to Water New Grass Seed' },
  when: { href: '/when-to-plant-grass-seed', title: 'When to Plant Grass Seed' },
  drought: { href: '/drought-tolerant-grass', title: 'Drought-Tolerant Grass' },
  howmuch: { href: '/how-much-grass-seed-do-i-need', title: 'How Much Grass Seed Do I Need?' },
};

export function pickGuides(input, win) {
  const keys = [];
  const existingLawn = input.project === 'overseed' || input.project === 'patch';
  if (input.alternatives && input.alternatives !== 'grass') keys.push(existingLawn ? 'clover_overseed' : 'clover_lawn');
  if (input.traffic === 'dogs') keys.push('dogs');
  if (input.sun === 'shade') keys.push('shade');
  if (input.project === 'overseed') keys.push('overseed');
  else if (input.project === 'restart') keys.push('restart');
  else if (input.project === 'patch') keys.push('patch');
  else keys.push('watering');
  if (win && win.state === 'early') keys.push('when');
  if (input.water === 'low') keys.push('drought');
  keys.push('watering', 'howmuch');
  return [...new Set(keys)].slice(0, 3).map((k) => GUIDES[k]);
}

function GuideLinks({ input, w }) {
  const guides = pickGuides(input, w);
  if (!guides.length) return null;
  return html`
    <section class="output" id="guides">
      <h2>Guides for your plan</h2>
      <ul style=${{ fontFamily: 'system-ui,sans-serif', fontSize: '.98rem', lineHeight: 1.9, paddingLeft: '1.2em', margin: '.4em 0' }}>
        ${guides.map(
          (g, i) => html`
            <li key=${g.href}>
              <a href=${g.href} target="_blank" rel="noopener" style=${{ color: 'var(--moss)', fontWeight: 600 }}
                onClick=${() => track('picker_guide_click', { guide: g.href, link_position: i + 1 })}>
                ${g.title}
              </a>
            </li>`
        )}
      </ul>
    </section>`;
}

function HowWeChose({ ranked, input }) {
  const [open, setOpen] = useState(false);
  return html`
    <section class="output">
      <button class="link-btn" onClick=${() => setOpen(!open)}>
        ${open ? '▾' : '▸'} How we chose (the numbers behind it)
      </button>
      ${open &&
      html`
        <div>
          <p class="muted">
            Region <strong>${input.region}</strong>. Each grass scored 1–5 per factor from its
            database tolerance anchors; the existing-grass bonus reflects your overseed.
            ${input.region === 'transition' &&
            html`<span> In the transition zone, tall fescue gets a +0.75 preference — it's the
            standard homeowner pick here, even where a warm-season grass edges it on raw durability.</span>`}
          </p>
          <table class="score-table">
            <thead><tr><th>Grass</th><th>Sun</th><th>Traffic</th><th>Effort</th><th>Overseed</th><th>Total</th></tr></thead>
            <tbody>
              ${ranked.map(
                (r) => html`
                  <tr key=${r.id}>
                    <td>${r.name}${r.fineFescue ? html` <span class="tag tag-fescue">fine fescue</span>` : ''}</td>
                    <td title=${r.breakdown.sun.basis}>${fmt1(r.breakdown.sun.value)}</td>
                    <td title=${r.breakdown.traffic.basis}>${fmt1(r.breakdown.traffic.value)}</td>
                    <td title=${r.breakdown.effort.basis}>${fmt1(r.breakdown.effort.value)}</td>
                    <td title=${r.breakdown.overseed.basis}>${r.breakdown.overseed.applies ? '+' + fmt1(r.breakdown.overseed.value) : '—'}</td>
                    <td><strong>${fmt1(r.total)}</strong></td>
                  </tr>`
              )}
            </tbody>
          </table>
          <p class="muted" style=${{ fontSize: '.82rem' }}>Hover any score to see the rating it came from.</p>
        </div>`}
    </section>`;
}

export function ResultScreen({ result, onBack }) {
  const { input, blend, window, retail, ranked } = result;
  const regionWord = input.region === 'transition' ? 'transition-zone' : `${input.region}-season`;
  const sunWord = input.sun === 'full' ? 'full sun' : input.sun === 'partial' ? 'partial sun' : 'shade';
  const trafWord =
    input.traffic === 'kids_pets' ? 'kids and pets' : input.traffic === 'dogs' ? 'dogs' : input.traffic === 'normal' ? 'normal use' : 'light use';
  const effWord = input.water === 'low' ? 'low effort' : input.water === 'high' ? 'high effort' : 'moderate effort';
  const lede = `${input.area} · ${regionWord} country (USDA ${input.zone}). A plan built for ${sunWord}, ${trafWord}, and ${effWord}.`;
  return html`
    <div class="result">
      <button class="link-btn" onClick=${onBack}>← Change my answers</button>
      <h1>Here's what to plant</h1>
      <p class="lede">${lede}</p>
      <p class="muted">Backed by USDA and university extension research.</p>
      <p style=${{ margin: '.35rem 0 0' }}><a href="#buy" style=${{ color: 'var(--moss)', fontWeight: 600 }}>${'↓'} Skip to where to buy this blend</a></p>

      <${WindowBanner} w=${window} />
      <${DiyRecipe} blend=${blend} />
      <${RetailBlends} retail=${retail} />
      <${GuideLinks} input=${input} w=${window} />
      <${HowWeChose} ranked=${ranked} input=${input} />
    </div>`;
}
