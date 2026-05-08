import { callAPI } from '../api.js';
import { escapeHTML, formatWon, formatDate, parseJSON } from '../utils.js';
import { toast } from '../components/toast.js';
import { openModal, closeModal } from '../components/modal.js';
import { stageBadge, priorityBadge, tagBadges } from '../components/badge.js';
import { renderFilterBar, bindFilterBar, applyOpportunityFilters, 기본필터상태 } from '../components/filterBar.js';
import { createDataTable } from '../components/dataTable.js';
import { downloadCSV } from '../utils/csvParser.js';

const 기본컬럼 = [
  { key: '학교.학교명', label: '학교명', render: (row) => `<strong>${escapeHTML(row.학교?.학교명 || '-')}</strong>` },
  { key: '부서.부서명', label: '부서', render: (row) => escapeHTML(row.부서?.부서명 || '-') },
  { key: '학교.학교유형', label: '학교유형', render: (row) => escapeHTML(row.학교?.학교유형 || '-') },
  { key: '지역', label: '지역', render: (row) => escapeHTML(`${row.학교?.지역_시 || ''} ${row.학교?.지역_구 || ''}`.trim() || '-') },
  { key: '현재단계', label: '단계', render: (row) => stageBadge(row.현재단계) },
  { key: '우선순위', label: '우선순위', render: (row) => priorityBadge(row.우선순위) },
  { key: '관심프로그램', label: '관심프로그램' },
  { key: '태그', label: '태그', render: (row) => tagBadges(parseJSON(row.태그_JSON, []).slice(0, 3)) },
  { key: '대표담당자', label: '담당자', render: (row) => renderContact(row) },
  { key: '다음액션', label: '다음액션' },
  { key: '다음액션일', label: '다음액션일', render: (row) => formatDate(row.다음액션일) },
  { key: '마지막활동일', label: '마지막활동일', render: (row) => formatDate(row.마지막활동일) },
  { key: '정체일수', label: '정체일수', render: (row) => `${Number(row.정체일수 || 0)}일` },
  { key: '예상금액', label: '예상금액', render: (row) => formatWon(row.예상금액) },
  { key: 'BANT_예산상태', label: 'BANT 예산', defaultVisible: false },
  { key: 'BANT_권한', label: 'BANT 권한', defaultVisible: false },
  { key: 'BANT_니즈키워드', label: 'BANT 니즈', defaultVisible: false },
  { key: 'MEDDIC_메트릭', label: 'MEDDIC 메트릭', defaultVisible: false },
  { key: 'MEDDIC_페인', label: 'MEDDIC 페인', defaultVisible: false },
  { key: 'MEDDIC_경쟁사', label: 'MEDDIC 경쟁사', defaultVisible: false }
];

let rootEl = null;
let table = null;
const state = {
  allOpps: [],
  filteredOpps: [],
  filters: { ...기본필터상태 }
};

export async function render(target) {
  rootEl = target;
  state.filters = { ...기본필터상태, ...readPendingFilter() };
  target.innerHTML = `
    <section class="page-head list-head">
      <div>
        <h1 class="page-title">리스트</h1>
        <p class="page-desc">엑셀처럼 정렬·필터·일괄 작업을 처리하고, 필요한 컬럼만 켜서 볼 수 있습니다.</p>
      </div>
      <div class="list-top-actions">
        <button id="export-all" class="ghost-button" type="button">전체 CSV 익스포트</button>
        <button id="export-filtered" class="ghost-button" type="button">현재 필터 결과 익스포트</button>
        <button id="new-opp-in-list" class="primary-button" type="button">+ 새 기회</button>
      </div>
    </section>
    <div id="list-filter-root"></div>
    <section class="list-toolbar card">
      <div class="bulk-info"><strong id="selected-count">0</strong>건 선택됨</div>
      <div class="bulk-actions">
        <button class="ghost-button small" type="button" data-bulk="stage">일괄 단계 변경</button>
        <button class="ghost-button small" type="button" data-bulk="tag-add">일괄 태그 추가</button>
        <button class="ghost-button small" type="button" data-bulk="tag-remove">일괄 태그 제거</button>
        <button class="ghost-button small" type="button" data-bulk="priority">일괄 우선순위 변경</button>
        <button class="ghost-button small" type="button" data-bulk="hold">일괄 보류</button>
        <button class="ghost-button small danger" type="button" data-bulk="drop">일괄 드랍</button>
        <button class="ghost-button small danger" type="button" data-bulk="delete">일괄 삭제</button>
        <button class="ghost-button small" type="button" data-bulk="selected-export">선택 항목 CSV 익스포트</button>
      </div>
      <button id="column-settings" class="icon-text-button" type="button">⚙️ 컬럼 설정</button>
    </section>
    <section id="list-table-root" class="table-wrap"><div class="placeholder">리스트 데이터를 불러오는 중입니다.</div></section>
  `;
  bindStaticActions();
  await loadList();
}

async function loadList() {
  try {
    const opps = await callAPI('opp.list', {});
    state.allOpps = normalizeOpps(opps);
    applyAndRender();
  } catch (error) {
    rootEl.querySelector('#list-table-root').innerHTML = `<div class="placeholder">리스트를 불러오지 못했습니다.<br>${escapeHTML(error.message)}</div>`;
  }
}

function applyAndRender() {
  state.filteredOpps = applyExtraFilters(applyOpportunityFilters(state.allOpps, state.filters), state.filters);
  renderFilter();
  renderTable();
}

function renderFilter() {
  const filterRoot = rootEl.querySelector('#list-filter-root');
  filterRoot.innerHTML = renderFilterBar({ filters: state.filters, opps: state.allOpps });
  bindFilterBar(filterRoot, {
    filters: state.filters,
    opps: state.allOpps,
    onChange: (next) => {
      state.filters = { ...기본필터상태, ...next };
      applyAndRender();
    }
  });
}

function renderTable() {
  table = createDataTable(rootEl.querySelector('#list-table-root'), {
    rows: state.filteredOpps,
    columns: 기본컬럼,
    rowId: (row) => row.opp_id,
    storageKey: 'crm_list_visible_columns',
    pageSize: 50,
    onSelectionChange: updateSelectedCount,
    onRowDblClick: (row) => { location.hash = `#/opp/${row.opp_id}`; }
  });
  updateSelectedCount(table.getSelectedRows());
}

function bindStaticActions() {
  rootEl.querySelector('#export-all')?.addEventListener('click', async () => {
    try {
      const data = await callAPI('export.all', {});
      const opps = data.opportunities || data.기회목록 || state.allOpps;
      downloadCSV(`학교영업CRM_전체_${dateStamp()}.csv`, flattenRows(opps));
      toast('전체 CSV를 생성했습니다.', 'success');
    } catch (error) {
      downloadCSV(`학교영업CRM_전체_${dateStamp()}.csv`, flattenRows(state.allOpps));
      toast('목업 데이터를 기준으로 전체 CSV를 생성했습니다.', 'info');
    }
  });

  rootEl.querySelector('#export-filtered')?.addEventListener('click', () => {
    downloadCSV(`학교영업CRM_필터결과_${dateStamp()}.csv`, flattenRows(table?.getVisibleRows() || state.filteredOpps));
    toast('현재 필터 결과 CSV를 생성했습니다.', 'success');
  });

  rootEl.querySelector('#new-opp-in-list')?.addEventListener('click', () => {
    location.hash = '#/';
    toast('칸반 화면의 + 새 기회 버튼에서 등록할 수 있습니다.', 'info');
  });

  rootEl.querySelector('#column-settings')?.addEventListener('click', () => openColumnSettings());

  rootEl.querySelectorAll('[data-bulk]').forEach((button) => {
    button.addEventListener('click', () => runBulkAction(button.dataset.bulk));
  });
}

async function runBulkAction(type) {
  const selected = table?.getSelectedRows() || [];
  if (!selected.length) return toast('선택된 행이 없습니다.', 'info');
  const ids = selected.map((row) => row.opp_id);

  if (type === 'stage') {
    const stage = window.prompt('이동할 단계를 입력해주세요. 예: 자료발송, EVD예정, 계약검토');
    if (!stage) return;
    await Promise.all(ids.map((opp_id) => callAPI('opp.changeStage', { opp_id, 새단계: stage, 사유: '리스트 일괄 단계 변경' })));
    toast(`${ids.length}건의 단계를 변경했습니다.`, 'success');
  }

  if (type === 'tag-add') {
    const tag = window.prompt('추가할 태그를 입력해주세요. 여러 개는 콤마로 구분합니다.');
    if (!tag) return;
    const tags = tag.split(',').map((item) => item.trim()).filter(Boolean);
    await Promise.all(ids.map((opp_id) => callAPI('opp.addTags', { opp_id, 태그배열: tags })));
    toast(`${ids.length}건에 태그를 추가했습니다.`, 'success');
  }

  if (type === 'tag-remove') {
    const tag = window.prompt('제거할 태그를 입력해주세요. 여러 개는 콤마로 구분합니다.');
    if (!tag) return;
    const tags = tag.split(',').map((item) => item.trim()).filter(Boolean);
    await Promise.all(ids.map((opp_id) => callAPI('opp.removeTags', { opp_id, 태그배열: tags })));
    toast(`${ids.length}건에서 태그를 제거했습니다.`, 'success');
  }

  if (type === 'priority') {
    const priority = window.prompt('변경할 우선순위를 입력해주세요. S/A/B/C', 'A');
    if (!['S', 'A', 'B', 'C'].includes(priority)) return toast('우선순위는 S/A/B/C 중 하나여야 합니다.', 'error');
    await Promise.all(ids.map((opp_id) => callAPI('opp.update', { opp_id, 우선순위: priority, 우선순위_수동오버라이드: 'Y' })));
    toast(`${ids.length}건의 우선순위를 변경했습니다.`, 'success');
  }

  if (type === 'hold' || type === 'drop') {
    const stage = type === 'hold' ? '보류' : '드랍';
    await Promise.all(ids.map((opp_id) => callAPI('opp.changeStage', { opp_id, 새단계: stage, 사유: '리스트 일괄 처리' })));
    toast(`${ids.length}건을 ${stage} 처리했습니다.`, 'success');
  }

  if (type === 'delete') {
    if (!window.confirm(`${ids.length}건을 삭제하시겠습니까?`)) return;
    await Promise.all(ids.map((opp_id) => callAPI('opp.delete', { opp_id })));
    toast(`${ids.length}건을 삭제했습니다.`, 'success');
  }

  if (type === 'selected-export') {
    downloadCSV(`학교영업CRM_선택항목_${dateStamp()}.csv`, flattenRows(selected));
    return toast('선택 항목 CSV를 생성했습니다.', 'success');
  }

  await loadList();
}

function openColumnSettings() {
  const current = new Set(table?.visibleColumnKeys || 기본컬럼.filter((col) => col.defaultVisible !== false).map((col) => col.key));
  openModal({
    title: '표시 컬럼 설정',
    body: `
      <p class="muted-text">체크한 컬럼만 리스트에 표시됩니다. BANT/MEDDIC 컬럼도 여기서 켤 수 있습니다.</p>
      <div class="column-setting-list">
        ${기본컬럼.map((column, index) => `
          <label>
            <input type="checkbox" value="${escapeHTML(column.key)}" ${current.has(column.key) ? 'checked' : ''} />
            <span>${index + 1}. ${escapeHTML(column.label)}</span>
          </label>
        `).join('')}
      </div>
    `,
    actions: `<button class="ghost-button" type="button" data-modal-close="true">취소</button><button id="save-column-settings" class="primary-button" type="button">저장</button>`
  });
  document.getElementById('save-column-settings')?.addEventListener('click', () => {
    const keys = Array.from(document.querySelectorAll('.column-setting-list input:checked')).map((input) => input.value);
    if (!keys.length) return toast('최소 1개 컬럼은 선택해야 합니다.', 'error');
    table.setVisibleColumns(keys);
    closeModal();
  });
}

function updateSelectedCount(rows = []) {
  const count = Array.isArray(rows) ? rows.length : 0;
  const target = rootEl?.querySelector('#selected-count');
  if (target) target.textContent = String(count);
}

function normalizeOpps(opps = []) {
  return opps.map((opp) => ({
    ...opp,
    학교: opp.학교 || {},
    부서: opp.부서 || {},
    대표담당자: renderContactText(opp),
    태그: parseJSON(opp.태그_JSON, []).join(', '),
    지역: `${opp.학교?.지역_시 || ''} ${opp.학교?.지역_구 || ''}`.trim()
  }));
}

function applyExtraFilters(rows, filters) {
  let next = rows;
  if (filters.단계?.length) next = next.filter((row) => filters.단계.includes(row.현재단계));
  if (filters.제외단계?.length) next = next.filter((row) => !filters.제외단계.includes(row.현재단계));
  if (filters.생성월) next = next.filter((row) => String(row.생성일 || '').startsWith(filters.생성월));
  return next;
}

function readPendingFilter() {
  try {
    const saved = JSON.parse(localStorage.getItem('crm_pending_list_filter') || '{}');
    localStorage.removeItem('crm_pending_list_filter');
    return saved || {};
  } catch (error) {
    return {};
  }
}

function renderContact(row) {
  const contact = (row.담당자들 || [])[0];
  if (!contact) return '-';
  return `${escapeHTML(contact.이름 || '-')} <span class="muted-text">${escapeHTML(contact.직책 || '')}</span>`;
}

function renderContactText(row) {
  const contact = (row.담당자들 || [])[0];
  return contact ? `${contact.이름 || ''} ${contact.직책 || ''}`.trim() : '';
}

function flattenRows(rows = []) {
  return rows.map((row) => ({
    학교명: row.학교?.학교명 || row.학교명 || '',
    부서: row.부서?.부서명 || row.부서명 || '',
    학교유형: row.학교?.학교유형 || '',
    지역: `${row.학교?.지역_시 || ''} ${row.학교?.지역_구 || ''}`.trim(),
    단계: row.현재단계 || '',
    우선순위: row.우선순위 || '',
    관심프로그램: row.관심프로그램 || '',
    태그: parseJSON(row.태그_JSON, []).join('|'),
    담당자: renderContactText(row),
    다음액션: row.다음액션 || '',
    다음액션일: row.다음액션일 || '',
    마지막활동일: row.마지막활동일 || '',
    정체일수: row.정체일수 || 0,
    예상금액: row.예상금액 || 0,
    기회메모: row.기회메모 || ''
  }));
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10).replaceAll('-', '');
}
