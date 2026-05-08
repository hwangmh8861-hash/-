import { escapeHTML, formatWon, groupBy } from '../utils.js';
import { schoolCard, schoolMiniCard } from './schoolCard.js';
import { getDefaultWipLimit, getWipLimitText, getStageColorVar, calculateStagnation } from '../utils/tagHelper.js';

export function stageColumn({ stage, cards = [], allCards = [], grouped = false, collapsed = false, isolated = false } = {}) {
  const totalAmount = cards.reduce((sum, opp) => sum + Number(opp.예상금액 || 0), 0);
  const wipLimit = getDefaultWipLimit(stage);
  const isOverLimit = Number.isFinite(wipLimit) && cards.length > wipLimit;
  const hasAlert = cards.some((opp) => calculateStagnation(opp).정체여부 || isNextActionSoon(opp));
  const sameSchoolCounts = countBySchool(allCards);

  return `
    <section
      class="stage-column ${collapsed ? 'is-collapsed' : ''} ${isOverLimit ? 'is-over-limit' : ''} ${hasAlert ? 'has-alert' : ''} ${isolated ? 'is-isolated' : ''}"
      data-stage-column="${escapeHTML(stage)}"
      style="--stage-color: var(${getStageColorVar(stage)});"
    >
      <header class="stage-column-head">
        <button class="stage-title-button" type="button" data-toggle-column="${escapeHTML(stage)}" aria-label="${escapeHTML(stage)} 접기 또는 펼치기">
          <span class="stage-color-dot" aria-hidden="true"></span>
          <span class="stage-title-text">${escapeHTML(stage)}</span>
        </button>
        <div class="stage-head-meta">
          <span>${cards.length}건</span>
          <span>${formatWon(totalAmount)}</span>
          ${isOverLimit ? `<span class="wip-warning" title="동시처리 한도 ${getWipLimitText(stage)} 초과">⚠️</span>` : ''}
        </div>
        <div class="stage-menu-wrap">
          <button class="stage-menu-button" type="button" data-column-menu="${escapeHTML(stage)}" aria-label="컬럼 메뉴">⋯</button>
        </div>
      </header>
      <div class="stage-limit-line">WIP ${getWipLimitText(stage)}</div>
      <div class="stage-card-list" data-stage-dropzone="${escapeHTML(stage)}" ${collapsed ? 'hidden' : ''}>
        ${cards.length ? renderCards(stage, cards, sameSchoolCounts, grouped) : '<div class="column-empty">표시할 카드가 없습니다.</div>'}
        <button class="column-add-button" type="button" data-new-opp-stage="${escapeHTML(stage)}">+ 이 단계에 새 기회</button>
      </div>
    </section>
  `;
}

export function abnormalTray({ stage, cards = [], allCards = [] } = {}) {
  const sameSchoolCounts = countBySchool(allCards);
  return `
    <section class="abnormal-tray-column" data-abnormal-stage="${escapeHTML(stage)}">
      <header class="abnormal-tray-head">
        <strong>${escapeHTML(stage)}</strong>
        <span>${cards.length}건</span>
      </header>
      <div class="stage-card-list compact" data-stage-dropzone="${escapeHTML(stage)}">
        ${cards.length ? cards.map((opp) => schoolCard(opp, { sameSchoolCount: sameSchoolCounts[opp.school_id] || 1 })).join('') : '<div class="column-empty">해당 카드가 없습니다.</div>'}
      </div>
    </section>
  `;
}

export function groupedSchoolBlock(schoolName, cards = []) {
  return `
    <article class="school-group-block" data-school-id="${escapeHTML(cards[0]?.school_id || '')}">
      <div class="school-group-head">
        <span>🏫 ${escapeHTML(schoolName || '학교 미지정')}</span>
        <strong>${cards.length}</strong>
      </div>
      <div class="school-group-mini-list">
        ${cards.map(schoolMiniCard).join('')}
      </div>
    </article>
  `;
}

function renderCards(stage, cards, sameSchoolCounts, grouped) {
  if (!grouped) {
    return cards.map((opp) => schoolCard(opp, { sameSchoolCount: sameSchoolCounts[opp.school_id] || 1 })).join('');
  }
  const groupedBySchool = groupBy(cards, (opp) => opp.school_id || '학교미지정');
  return Object.values(groupedBySchool).map((schoolCards) => {
    const schoolName = schoolCards[0]?.학교?.학교명 || schoolCards[0]?.학교명 || '학교 미지정';
    return groupedSchoolBlock(schoolName, schoolCards);
  }).join('');
}

function countBySchool(cards = []) {
  return cards.reduce((acc, opp) => {
    if (!opp.school_id) return acc;
    acc[opp.school_id] = (acc[opp.school_id] || 0) + 1;
    return acc;
  }, {});
}

function isNextActionSoon(opp = {}) {
  if (!opp.다음액션일) return false;
  const date = new Date(opp.다음액션일);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((date - today) / (24 * 60 * 60 * 1000));
  return diff <= 2;
}
