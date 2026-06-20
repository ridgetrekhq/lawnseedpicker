// Result screen — the three outputs: retail blends, DIY recipe, seeding window.
// Plus a "how we chose" breakdown so the recommendation is hand-verifiable
// against the database.

import { html, useState } from '../vendor.js';
import { FTC_DISCLOSURE } from '../data/retailers.js';

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
        Mixed by weight. Total seeding rate
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
  // Until affiliate programs approve, retailer links are placeholders ('#').
  // Route those to our own buying guide — functional and honest. As real tracked
  // URLs get filled into RETAILERS (data/retailers.js), they take over here
  // automatically and open externally with rel="sponsored".
  const GUIDE_URL = '/where-to-buy-grass-seed.html';
  return html`
    <section class="output">
      <h2>Buy it ready-made</h2>
      <p class="disclosure-inline">${FTC_DISCLOSURE}</p>
      <div class="retail-grid">
        ${retail.map((p) => {
          const hasLink = p.retailerInfo.url && p.retailerInfo.url !== '#';
          const href = hasLink ? p.retailerInfo.url : GUIDE_URL;
          return html`
            <div class="retail-card" key=${p.id}>
              <div class="retail-name">${p.name}</div>
              <div class="retail-brand muted">${p.brand !== 'generic' ? p.brand : ''}</div>
              <p class="retail-why">${p.why}</p>
              <a
                class="btn ghost"
                href=${href}
                target=${hasLink ? '_blank' : undefined}
                rel=${hasLink ? 'sponsored noopener' : undefined}>
                ${hasLink ? 'Where to buy ›' : 'How to find it ›'}
              </a>
              <div class="retail-status muted">${hasLink ? p.retailerInfo.name : 'see our buying guide'}${p.vendorClaim ? ' · vendor claims' : ''}</div>
            </div>`;
        })}
      </div>
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

      <${WindowBanner} w=${window} />
      <${DiyRecipe} blend=${blend} />
      <${RetailBlends} retail=${retail} />
      <${HowWeChose} ranked=${ranked} input=${input} />
    </div>`;
}
