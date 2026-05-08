import { escapeHTML, stageColorVar, priorityColorVar, tagColorVar } from '../utils.js';

export function stageBadge(stage) {
  return `<span class="badge" style="background: var(${stageColorVar(stage)});">${escapeHTML(stage || '미지정')}</span>`;
}

export function priorityBadge(priority) {
  return `<span class="badge" style="background: var(${priorityColorVar(priority)});">${escapeHTML(priority || 'C')}</span>`;
}

export function tagBadge(tag) {
  return `<span class="badge badge-soft" style="--badge-color: var(${tagColorVar(tag)});">${escapeHTML(tag)}</span>`;
}

export function tagBadges(tags = []) {
  return `<span class="badge-row">${tags.map(tagBadge).join('')}</span>`;
}
