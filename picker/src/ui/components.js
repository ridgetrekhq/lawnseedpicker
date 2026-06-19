// Small reusable funnel building blocks (no-build React via htm).

import { html } from '../vendor.js';

/** A numbered funnel field: step number + question + optional helper + body. */
export function Field({ num, question, helper, children, optional }) {
  return html`
    <section class="field">
      <div class="field-head">
        <span class="field-num">${num}</span>
        <div>
          <h3 class="field-q">${question}${optional && html`<span class="field-opt"> · optional</span>`}</h3>
          ${helper && html`<p class="field-help">${helper}</p>`}
        </div>
      </div>
      ${children}
    </section>`;
}

/**
 * Single-select tappable option cards.
 * options: [{ value, label, hint }]. Controlled via value/onChange.
 */
export function OptionCards({ options, value, onChange, cols }) {
  return html`
    <div class=${`opt-grid cols-${cols || 2}`} role="radiogroup">
      ${options.map(
        (o) => html`
          <button
            key=${o.value}
            type="button"
            role="radio"
            aria-checked=${value === o.value}
            class=${`opt-card ${value === o.value ? 'is-active' : ''}`}
            onClick=${() => onChange(o.value)}>
            <span class="opt-label">${o.label}</span>
            ${o.hint && html`<span class="opt-hint">${o.hint}</span>`}
          </button>`
      )}
    </div>`;
}
