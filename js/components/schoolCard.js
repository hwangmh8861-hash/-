import { escapeHTML, formatDate } from '../utils.js';
import {
  getPriorityColorVar,
  parseTags,
  getDaysUntil,
  calculateStagnation,
  getTagColorVar
} from '../utils/tagHelper.js';

export function schoolCard(opp = {}, options = {}) {
  const school = opp.학교 || {};
  const dept = opp.부서 || {};
  const contact = getPrimaryContact(opp);
  const tags = parseTags(opp.태그_JSON);
  const visibleTags = tags.slice(0, 2);
  const hiddenTagCount = Math.max(0, tags.length - visibleTags.length);
  const sameSchoolCount = options.sameSchoolCount || 1;
  const stagnation = calculateStagnation(opp);
  const isStale = stagnation.정체여부;
  const priority = opp.우선순위 || 'C';
  const stage = opp.현재단계 || '리드';
  const nextActionText = getNextActionText(opp);
  const schoolName = school.학교명 || opp.학교명 || '학교 미지정';
  const deptName = dept.부서명 || opp.부서명 || '부서 미지정';
  const schoolType = school.학교유형 || opp.학교유형 || '학교유형 미지정';
  const region = [school.지역_시, school.지역_구].filter(Boolean).join(' ') || opp.지역 || '지역 미지정';
  const program = formatProgram(opp.관심프로그램 || '관심프로그램 미지정');

  return `
    <article
      class="kanban-card ${isStale ? 'is-stale' : ''}"
      draggable="true"
      tabindex="0"
      data-card="true"
      data-opp-id="${escapeHTML(opp.opp_id || '')}"
      data-school-id="${escapeHTML(opp.school_id || '')}"
      data-stage="${escapeHTML(stage)}"
      style="--card-accent: var(${isStale ? '--tag-negative' : getPriorityColorVar(priority)});"
      aria-label="${escapeHTML(`${schoolName} ${deptName} ${stage}`)}"
    >
      <div class="kanban-card-bar" aria-hidden="true"></div>
      <div class="kanban-card-main">
        <div class="kanban-card-topline">
          <button class="priority-pill" type="button" data-filter-priority="${escapeHTML(priority)}" style="--priority-color: var(${getPriorityColorVar(priority)});">${escapeHTML(priority)}</button>
          <button class="card-title-button" type="button" data-open-detail="${escapeHTML(opp.opp_id || '')}">
            <span class="card-school-name">${escapeHTML(schoolName)}</span>
            ${sameSchoolCount > 1 ? `<span class="same-school-dot" title="같은 학교 ${sameSchoolCount}개 카드 진행 중">●${sameSchoolCount}</span>` : ''}
            <span class="card-dept-name">· ${escapeHTML(deptName)}</span>
          </button>
          <button class="card-tag-add" type="button" data-add-tag="${escapeHTML(opp.opp_id || '')}" aria-label="태그 추가">+태그</button>
        </div>

        <div class="card-meta-line">${escapeHTML(schoolType)} · ${escapeHTML(region)}</div>
        <div class="card-contact-line">${escapeHTML(contact.label)}${contact.isChampion ? '<span class="champion-mark" title="챔피언 담당자">☆</span>' : ''}</div>
        <div class="card-program-line">${escapeHTML(program.main)}${program.extraCount ? `<span class="program-more">+${program.extraCount}</span>` : ''}</div>

        <div class="card-tag-line">
          ${visibleTags.length ? visibleTags.map(renderCardTag).join('') : '<span class="tag-empty">태그 없음</span>'}
          ${hiddenTagCount ? `<span class="tag-more">+${hiddenTagCount}</span>` : ''}
        </div>

        <div class="card-action-line ${getDaysUntil(opp.다음액션일) !== null && getDaysUntil(opp.다음액션일) <= 2 ? 'is-urgent' : ''}">
          <span aria-hidden="true">⏰</span>
          <span>${escapeHTML(nextActionText)}</span>
        </div>

        ${isStale ? `
          <div class="card-stale-line">
            <span aria-hidden="true">⚠️</span>
            <span>정체 ${stagnation.정체일수}일</span>
          </div>
        ` : ''}
      </div>
    </article>
  `;
}

export function schoolMiniCard(opp = {}) {
  const dept = opp.부서 || {};
  return `
    <button class="school-mini-card" type="button" data-open-detail="${escapeHTML(opp.opp_id || '')}" data-opp-id="${escapeHTML(opp.opp_id || '')}" data-school-id="${escapeHTML(opp.school_id || '')}">
      <span>└ ${escapeHTML(dept.부서명 || '부서 미지정')}</span>
      <span class="mini-stage">[${escapeHTML(opp.현재단계 || '리드')}]</span>
      <span class="mini-priority" style="--priority-color: var(${getPriorityColorVar(opp.우선순위 || 'C')});">${escapeHTML(opp.우선순위 || 'C')}</span>
    </button>
  `;
}

function renderCardTag(tag) {
  return `<button class="card-tag tag-${escapeHTML(getTagCategoryClass(tag))}" type="button" data-filter-tag="${escapeHTML(tag)}" style="--tag-color: var(${getTagColorVar(tag)});">${escapeHTML(tag)}</button>`;
}

function getTagCategoryClass(tag) {
  const colorVar = getTagColorVar(tag);
  return colorVar.replace('--tag-', '');
}

function formatProgram(programString) {
  const list = String(programString || '').split(',').map((item) => item.trim()).filter(Boolean);
  return {
    main: list[0] || '관심프로그램 미지정',
    extraCount: Math.max(0, list.length - 1)
  };
}

function getPrimaryContact(opp = {}) {
  const contacts = Array.isArray(opp.담당자들) ? opp.담당자들 : [];
  const champion = contacts.find((item) => item.챔피언여부 === 'Y');
  const selected = champion || contacts[0];
  if (!selected) {
    return {
      label: opp.담당자명 ? `${opp.담당자명}${opp.담당자직책 ? `(${opp.담당자직책})` : ''}` : '담당자 미지정',
      isChampion: false
    };
  }
  return {
    label: `${selected.이름 || '이름 미지정'}${selected.직책 ? `(${selected.직책})` : ''}`,
    isChampion: selected.챔피언여부 === 'Y'
  };
}

function getNextActionText(opp = {}) {
  if (!opp.다음액션 && !opp.다음액션일) return '다음액션 미정';
  const days = getDaysUntil(opp.다음액션일);
  const dateText = opp.다음액션일 ? formatDate(opp.다음액션일).replace(/\.$/, '') : '';
  const dDay = days === null ? '' : days === 0 ? '오늘' : days > 0 ? `D-${days}` : `D+${Math.abs(days)}`;
  return [dateText, opp.다음액션 || '액션 미정', dDay ? `(${dDay})` : ''].filter(Boolean).join(' ');
}
