import { escapeHTML } from '../utils.js';
import { 기본태그, uniqueTagsFromOpps, normalizeArray } from '../utils/tagHelper.js';

const 필터저장키 = 'crm_saved_filters';

export const 기본필터상태 = {
  검색어: '',
  지역: [],
  학교유형: [],
  우선순위: [],
  관심프로그램: [],
  태그: [],
  태그조건: 'OR',
  사업카테고리: [],
  기간: ''
};

export function renderFilterBar({ filters = 기본필터상태, opps = [] } = {}) {
  const options = buildOptions(opps);
  const savedFilters = getSavedFilters();
  return `
    <section class="kanban-filter-wrap" aria-label="칸반 필터">
      <div class="filter-main-row">
        <div class="filter-search-wrap">
          <input id="kanban-search" class="filter-search" type="search" placeholder="학교명·부서명·기회제목·메모 검색" value="${escapeHTML(filters.검색어 || '')}" />
        </div>
        ${multiSelect('지역', '지역', options.지역, filters.지역)}
        ${multiSelect('학교유형', '학교유형', options.학교유형, filters.학교유형)}
        ${multiSelect('우선순위', '우선순위', ['S', 'A', 'B', 'C'], filters.우선순위)}
        ${multiSelect('관심프로그램', '관심프로그램', options.관심프로그램, filters.관심프로그램)}
        ${multiSelect('태그', '태그', options.태그, filters.태그)}
        ${multiSelect('사업카테고리', '사업카테고리', options.사업카테고리, filters.사업카테고리)}
        <label class="filter-select-label">
          <span>기간</span>
          <select class="filter-select" data-filter-period>
            ${periodOption('', '전체', filters.기간)}
            ${periodOption('이번주액션', '이번주 액션', filters.기간)}
            ${periodOption('지난액션', '액션일 지남', filters.기간)}
            ${periodOption('예상계약30일', '예상계약 30일', filters.기간)}
          </select>
        </label>
        <button class="ghost-button filter-reset-button" type="button" data-filter-reset>필터초기화</button>
      </div>

      <div class="filter-sub-row">
        <div class="quick-filter-group" aria-label="빠른 필터">
          <button class="quick-filter" type="button" data-quick-filter="정체">🔴 정체 알림만</button>
          <button class="quick-filter" type="button" data-quick-filter="재콜">📞 부재중-재콜필요</button>
          <button class="quick-filter" type="button" data-quick-filter="이메일">📧 이메일요청</button>
          <button class="quick-filter" type="button" data-quick-filter="이번주">🎯 이번주 액션</button>
          <button class="quick-filter" type="button" data-quick-filter="상위등급">⭐ S·A 등급만</button>
        </div>
        <div class="filter-tools">
          <label class="tag-mode-toggle">
            <span>태그 조건</span>
            <select data-tag-mode>
              <option value="OR" ${filters.태그조건 !== 'AND' ? 'selected' : ''}>OR</option>
              <option value="AND" ${filters.태그조건 === 'AND' ? 'selected' : ''}>AND</option>
            </select>
          </label>
          <select class="saved-filter-select" data-saved-filter>
            <option value="">내 필터 불러오기</option>
            ${savedFilters.map((item, index) => `<option value="${index}">${escapeHTML(item.name)}</option>`).join('')}
          </select>
          <button class="ghost-button" type="button" data-save-filter>내 필터 저장</button>
        </div>
      </div>

      <div id="filter-chip-row" class="filter-chip-row">
        ${renderAppliedChips(filters)}
      </div>
    </section>
  `;
}

export function bindFilterBar(root, { filters, onChange, opps = [] } = {}) {
  if (!root) return;
  const next = () => ({ ...기본필터상태, ...filters });
  root.querySelector('#kanban-search')?.addEventListener('input', (event) => {
    onChange({ ...next(), 검색어: event.target.value });
  });

  root.querySelectorAll('[data-filter-name]').forEach((select) => {
    select.addEventListener('change', () => {
      const filterName = select.dataset.filterName;
      onChange({ ...next(), [filterName]: selectedValues(select) });
    });
  });

  root.querySelector('[data-filter-period]')?.addEventListener('change', (event) => {
    onChange({ ...next(), 기간: event.target.value });
  });

  root.querySelector('[data-tag-mode]')?.addEventListener('change', (event) => {
    onChange({ ...next(), 태그조건: event.target.value });
  });

  root.querySelector('[data-filter-reset]')?.addEventListener('click', () => {
    onChange({ ...기본필터상태 });
  });

  root.querySelectorAll('[data-quick-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      const type = button.dataset.quickFilter;
      const preset = getQuickFilter(type);
      onChange({ ...next(), ...preset });
    });
  });

  root.querySelector('[data-save-filter]')?.addEventListener('click', () => {
    const name = window.prompt('저장할 필터 이름을 입력해주세요. 예: 오늘 재콜할 곳');
    if (!name) return;
    const saved = getSavedFilters();
    saved.push({ name, filters: next() });
    localStorage.setItem(필터저장키, JSON.stringify(saved));
    onChange(next());
  });

  root.querySelector('[data-saved-filter]')?.addEventListener('change', (event) => {
    const index = Number(event.target.value);
    const saved = getSavedFilters()[index];
    if (!saved) return;
    onChange({ ...기본필터상태, ...saved.filters });
  });

  root.querySelectorAll('[data-chip-remove]').forEach((button) => {
    button.addEventListener('click', () => {
      const filterName = button.dataset.chipRemove;
      const value = button.dataset.chipValue;
      const current = next();
      if (Array.isArray(current[filterName])) {
        current[filterName] = current[filterName].filter((item) => item !== value);
      } else {
        current[filterName] = filterName === '태그조건' ? 'OR' : '';
      }
      onChange(current);
    });
  });

  root.querySelectorAll('[data-chip-clear]').forEach((button) => {
    button.addEventListener('click', () => onChange({ ...기본필터상태 }));
  });
}

export function applyOpportunityFilters(opps = [], filters = 기본필터상태) {
  const normalized = { ...기본필터상태, ...filters };
  const keyword = String(normalized.검색어 || '').trim().toLowerCase();
  const tags = normalizeArray(normalized.태그);
  return opps.filter((opp) => {
    const school = opp.학교 || {};
    const dept = opp.부서 || {};
    const oppTags = normalizeArray(parseTagsSafe(opp.태그_JSON));

    if (keyword) {
      const haystack = [school.학교명, dept.부서명, opp.기회제목, opp.기회메모, opp.다음액션]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }

    if (normalized.지역.length && !normalized.지역.some((region) => [school.지역_시, school.지역_구].join(' ').includes(region))) return false;
    if (normalized.학교유형.length && !normalized.학교유형.includes(school.학교유형)) return false;
    if (normalized.우선순위.length && !normalized.우선순위.includes(opp.우선순위)) return false;
    if (normalized.관심프로그램.length && !normalized.관심프로그램.includes(opp.관심프로그램)) return false;
    if (normalized.사업카테고리.length && !normalized.사업카테고리.some((category) => String(school.사업카테고리 || '').includes(category))) return false;

    if (tags.length) {
      const matched = normalized.태그조건 === 'AND'
        ? tags.every((tag) => oppTags.includes(tag))
        : tags.some((tag) => oppTags.includes(tag));
      if (!matched) return false;
    }

    if (normalized.기간 === '이번주액션' && !isDateWithinDays(opp.다음액션일, 7, false)) return false;
    if (normalized.기간 === '지난액션' && !isPastDate(opp.다음액션일)) return false;
    if (normalized.기간 === '예상계약30일' && !isDateWithinDays(opp.예상계약일, 30, false)) return false;

    if (normalized.정체여부 === true && !opp.정체여부) return false;

    return true;
  });
}

function multiSelect(name, label, options, selected = []) {
  const values = new Set(normalizeArray(selected));
  return `
    <label class="filter-select-label">
      <span>${escapeHTML(label)}</span>
      <select class="filter-select" data-filter-name="${escapeHTML(name)}" multiple size="1">
        ${options.map((option) => `<option value="${escapeHTML(option)}" ${values.has(option) ? 'selected' : ''}>${escapeHTML(option)}</option>`).join('')}
      </select>
    </label>
  `;
}

function periodOption(value, label, selected) {
  return `<option value="${escapeHTML(value)}" ${selected === value ? 'selected' : ''}>${escapeHTML(label)}</option>`;
}

function selectedValues(select) {
  return Array.from(select.selectedOptions).map((option) => option.value).filter(Boolean);
}

function buildOptions(opps = []) {
  const sets = {
    지역: new Set(),
    학교유형: new Set(),
    관심프로그램: new Set(),
    사업카테고리: new Set(),
    태그: new Set(uniqueTagsFromOpps(opps).concat(기본태그))
  };
  opps.forEach((opp) => {
    const school = opp.학교 || {};
    if (school.지역_구) sets.지역.add(school.지역_구);
    if (school.학교유형) sets.학교유형.add(school.학교유형);
    if (opp.관심프로그램) sets.관심프로그램.add(opp.관심프로그램);
    String(school.사업카테고리 || '').split(',').map((item) => item.trim()).filter(Boolean).forEach((item) => sets.사업카테고리.add(item));
  });
  return Object.fromEntries(Object.entries(sets).map(([key, set]) => [key, Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'))]));
}

function renderAppliedChips(filters = 기본필터상태) {
  const chips = [];
  Object.entries(filters).forEach(([key, value]) => {
    if (key === '태그조건' && value === 'AND') chips.push(chip(key, '태그 AND'));
    else if (Array.isArray(value)) value.forEach((item) => chips.push(chip(key, item)));
    else if (value && key !== '검색어') chips.push(chip(key, value));
  });
  if (filters.검색어) chips.unshift(chip('검색어', filters.검색어));
  if (!chips.length) return '<span class="filter-empty-chip">적용된 필터 없음</span>';
  return `${chips.join('')}<button class="chip clear" type="button" data-chip-clear="true">전체 해제</button>`;
}

function chip(key, value) {
  return `<button class="chip" type="button" data-chip-remove="${escapeHTML(key)}" data-chip-value="${escapeHTML(value)}"><span>${escapeHTML(key)}: ${escapeHTML(value)}</span><strong>×</strong></button>`;
}

function getQuickFilter(type) {
  const map = {
    정체: { 정체여부: true },
    재콜: { 태그: ['부재중-재콜필요'], 태그조건: 'OR' },
    이메일: { 태그: ['이메일요청'], 태그조건: 'OR' },
    이번주: { 기간: '이번주액션' },
    상위등급: { 우선순위: ['S', 'A'] }
  };
  return map[type] || {};
}

function getSavedFilters() {
  try {
    return JSON.parse(localStorage.getItem(필터저장키) || '[]');
  } catch (error) {
    return [];
  }
}

function parseTagsSafe(value) {
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value || '[]');
  } catch (error) {
    return [];
  }
}

function isDateWithinDays(value, days, allowPast = true) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diff = Math.ceil((date - today) / (24 * 60 * 60 * 1000));
  return allowPast ? diff <= days : diff >= 0 && diff <= days;
}

function isPastDate(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
}
