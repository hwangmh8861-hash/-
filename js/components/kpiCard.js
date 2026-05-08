import { escapeHTML } from '../utils.js';

export function kpiCard({ id = '', label = '', value = 0, delta = 0, suffix = '', hint = '', tone = 'default' } = {}) {
  const deltaNumber = Number(delta || 0);
  const deltaClass = deltaNumber > 0 ? 'up' : deltaNumber < 0 ? 'down' : 'same';
  const deltaSymbol = deltaNumber > 0 ? '↑' : deltaNumber < 0 ? '↓' : '→';
  const dataAttr = id ? `data-kpi-id="${escapeHTML(id)}"` : '';
  return `
    <button class="kpi-card ${escapeHTML(tone)}" type="button" ${dataAttr}>
      <span class="kpi-label">${escapeHTML(label)}</span>
      <strong class="kpi-value">${escapeHTML(value)}${escapeHTML(suffix)}</strong>
      <span class="kpi-delta ${deltaClass}">${deltaSymbol}${Math.abs(deltaNumber)}</span>
      ${hint ? `<span class="kpi-hint">${escapeHTML(hint)}</span>` : ''}
    </button>
  `;
}
