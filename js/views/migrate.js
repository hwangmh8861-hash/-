import { callAPI } from '../api.js';
import { $, escapeHTML } from '../utils.js';
import { parseCSV } from '../utils/csvParser.js';
import { toast } from '../components/toast.js';

const SYSTEM_FIELDS = ['학교명','지역_시','지역_구','학교유형','부서명','담당자명','직책','휴대폰','사무실전화','이메일','관계강도','관심프로그램','우선순위','현재단계','예상금액','사업카테고리','메모'];
const MAP_HINTS = [
  { field: '학교명', keys: ['학교', '학교명', '교명'] },
  { field: '휴대폰', keys: ['전화', '연락처', '번호', '휴대폰', '핸드폰'] },
  { field: '담당자명', keys: ['선생', '담당', '교사', '쌤', '이름'] },
  { field: '부서명', keys: ['부서', '부', '팀'] },
  { field: '지역_구', keys: ['지역', '주소', '구'] },
  { field: '우선순위', keys: ['우선순위', '등급', 'priority', 'S/A/B/C'] },
  { field: '관심프로그램', keys: ['프로그램', '교육', '상품', '제안'] },
  { field: '메모', keys: ['메모', '비고', '특이사항'] }
];

let state = {
  step: 1,
  sourceType: 'file',
  spreadsheetId: '',
  sheetNames: [],
  selectedSheetNames: [],
  headers: [],
  rows: [],
  mapping: {},
  dryRun: null,
  execution: null,
  migrationId: ''
};

export async function render(target) {
  target.innerHTML = renderShell();
  bindEvents(target);
}

function renderShell() {
  return `
    <section class="page-head">
      <div>
        <h1 class="page-title">기존 CRM 마이그레이션</h1>
        <p class="page-desc">경기도 5개 지역 통합 CRM 엑셀을 새 학교+부서+기회 구조로 1회성 이관합니다.</p>
      </div>
      <button id="sample-migration" class="ghost-button" type="button">100행 샘플 불러오기</button>
    </section>
    <div class="stepper">
      ${['원본 선택','매핑 확인','드라이런','실행·롤백'].map((label, index) => `
        <div class="step-pill ${state.step === index + 1 ? 'is-active' : ''}">${index + 1}. ${label}</div>
      `).join('')}
    </div>
    <section id="migrate-step" class="ops-card">${renderStep()}</section>
  `;
}

function renderStep() {
  if (state.step === 1) return renderStep1();
  if (state.step === 2) return renderStep2();
  if (state.step === 3) return renderStep3();
  return renderStep4();
}

function renderStep1() {
  return `
    <h2>원본 선택</h2>
    <div class="ops-grid two">
      <div class="drop-zone" id="migrate-drop">
        <div>
          <strong>CSV/XLSX 파일을 여기에 놓기</strong>
          <p>김포·파주·부천·안산·고양 지역 시트가 들어 있는 기존 CRM 파일을 업로드합니다.</p>
          <input id="migrate-file" type="file" accept=".csv,.xlsx,.xls" />
        </div>
      </div>
      <div class="ops-card">
        <h3>구글 스프레드시트로 가져오기</h3>
        <p>GAS에서 접근 가능한 기존 스프레드시트 ID를 입력하면 서버에서 직접 드라이런할 수 있습니다.</p>
        <div class="form-row">
          <label for="source-spreadsheet-id">스프레드시트 ID</label>
          <input id="source-spreadsheet-id" class="input" value="${escapeHTML(state.spreadsheetId)}" placeholder="1AbC..." />
        </div>
        <div class="form-row">
          <label for="source-sheet-names">시트명</label>
          <input id="source-sheet-names" class="input" value="${escapeHTML(state.selectedSheetNames.join(','))}" placeholder="김포,파주,부천,안산,고양" />
        </div>
        <button id="load-from-sheet" class="primary-button" type="button">스프레드시트 미리보기</button>
      </div>
    </div>
    <div class="ops-toolbar" style="margin-top: var(--s-4);">
      <span class="page-desc">업로드 행 수: ${state.rows.length.toLocaleString('ko-KR')}행</span>
      <button id="go-step-2" class="primary-button" type="button" ${state.rows.length ? '' : 'disabled'}>다음: 컬럼 매핑</button>
    </div>
  `;
}

function renderStep2() {
  return `
    <h2>컬럼 매핑</h2>
    <p>기존 CRM의 컬럼을 새 시스템 필드에 연결합니다. 이름이 유사한 컬럼은 자동으로 매핑했습니다.</p>
    <div class="ops-grid two">
      <div>
        <h3>매핑 설정</h3>
        ${state.headers.map((header) => `
          <div class="mapping-grid">
            <strong>${escapeHTML(header)}</strong>
            <select class="select mapping-select" data-header="${escapeHTML(header)}">
              <option value="">사용 안 함</option>
              ${SYSTEM_FIELDS.map((field) => `<option value="${field}" ${state.mapping[field] === header ? 'selected' : ''}>${field}</option>`).join('')}
            </select>
          </div>
        `).join('')}
      </div>
      <div>
        <h3>상위 20행 미리보기</h3>
        <div class="table-wrap"><table class="table">
          <thead><tr>${state.headers.slice(0, 8).map((h) => `<th>${escapeHTML(h)}</th>`).join('')}</tr></thead>
          <tbody>${state.rows.slice(0, 20).map((row) => `<tr>${state.headers.slice(0, 8).map((h) => `<td>${escapeHTML(row[h] || '')}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>
      </div>
    </div>
    <div class="ops-toolbar" style="margin-top: var(--s-4);">
      <button class="ghost-button" type="button" data-step="1">이전</button>
      <button id="save-mapping-preset" class="ghost-button" type="button">매핑 프리셋 저장</button>
      <button id="run-dryrun" class="primary-button" type="button">드라이런 실행</button>
    </div>
  `;
}

function renderStep3() {
  const result = state.dryRun;
  return `
    <h2>드라이런 결과</h2>
    ${result ? `
      <div class="grid cols-4">
        <div class="metric-card card"><div class="metric-label">총 행</div><div class="metric-value">${result.totalRows}</div></div>
        <div class="metric-card card"><div class="metric-label">신규 학교</div><div class="metric-value">${result.newSchools}</div></div>
        <div class="metric-card card"><div class="metric-label">중복 병합</div><div class="metric-value">${result.duplicates}</div></div>
        <div class="metric-card card"><div class="metric-label">경고</div><div class="metric-value">${result.warnings.length}</div></div>
      </div>
      <div class="ops-grid two" style="margin-top: var(--s-4);">
        <div class="ops-card">
          <h3>분해 예상</h3>
          <p>Schools ${result.summary.schools}건 · Departments ${result.summary.departments}건 · Contacts ${result.summary.contacts}건 · Opportunities ${result.summary.opportunities}건</p>
        </div>
        <div class="ops-card">
          <h3>검증 메시지</h3>
          <div class="validation-list">${result.warnings.slice(0, 12).map((item) => `<div class="validation-item"><span>${escapeHTML(item.message)}</span><small>${escapeHTML(item.row || '')}</small></div>`).join('') || '<p>치명적 경고가 없습니다.</p>'}</div>
        </div>
      </div>
    ` : '<p>드라이런 결과가 없습니다.</p>'}
    <div class="ops-toolbar" style="margin-top: var(--s-4);">
      <button class="ghost-button" type="button" data-step="2">이전</button>
      <button id="execute-migration" class="primary-button" type="button" ${result ? '' : 'disabled'}>실제 마이그레이션 실행</button>
    </div>
  `;
}

function renderStep4() {
  const result = state.execution;
  return `
    <h2>실행 결과</h2>
    ${result ? `
      <div class="progress-wrap"><div class="progress-bar" style="--progress:100%"></div></div>
      <div class="grid cols-4" style="margin-top: var(--s-4);">
        <div class="metric-card card"><div class="metric-label">성공</div><div class="metric-value">${result.success}</div></div>
        <div class="metric-card card"><div class="metric-label">실패</div><div class="metric-value">${result.failed}</div></div>
        <div class="metric-card card"><div class="metric-label">생성 학교</div><div class="metric-value">${result.created?.schools || 0}</div></div>
        <div class="metric-card card"><div class="metric-label">생성 기회</div><div class="metric-value">${result.created?.opportunities || 0}</div></div>
      </div>
      <div class="ops-toolbar" style="margin-top: var(--s-4);">
        <span>마이그레이션 ID: ${escapeHTML(result.migrationId || state.migrationId)}</span>
        <button id="rollback-migration" class="ghost-button" type="button">24시간 이내 롤백</button>
      </div>
    ` : '<p>아직 실행 결과가 없습니다.</p>'}
    <div class="ops-toolbar" style="margin-top: var(--s-4);">
      <button class="ghost-button" type="button" data-step="3">이전</button>
      <a class="primary-button" href="#/settings">설정으로 이동</a>
    </div>
  `;
}

function bindEvents(target) {
  target.addEventListener('click', async (event) => {
    const stepButton = event.target.closest('[data-step]');
    if (stepButton) {
      state.step = Number(stepButton.dataset.step);
      return render(target);
    }
    if (event.target.id === 'sample-migration') {
      loadSampleRows();
      toast('100행 샘플 데이터를 불러왔습니다.');
      return render(target);
    }
    if (event.target.id === 'go-step-2') {
      state.step = 2;
      return render(target);
    }
    if (event.target.id === 'load-from-sheet') {
      await previewSpreadsheet(target);
      return;
    }
    if (event.target.id === 'save-mapping-preset') {
      localStorage.setItem('crm_migration_mapping', JSON.stringify(state.mapping));
      toast('매핑 프리셋을 저장했습니다.');
      return;
    }
    if (event.target.id === 'run-dryrun') {
      await runDryRun(target);
      return;
    }
    if (event.target.id === 'execute-migration') {
      await executeMigration(target);
      return;
    }
    if (event.target.id === 'rollback-migration') {
      await rollbackMigration(target);
    }
  });

  target.addEventListener('change', async (event) => {
    if (event.target.id === 'migrate-file') await handleFile(event.target.files?.[0], target);
    if (event.target.classList.contains('mapping-select')) updateMappingFromSelects(target);
  });

  const drop = $('#migrate-drop', target);
  drop?.addEventListener('dragover', (event) => { event.preventDefault(); drop.classList.add('is-dragover'); });
  drop?.addEventListener('dragleave', () => drop.classList.remove('is-dragover'));
  drop?.addEventListener('drop', async (event) => {
    event.preventDefault();
    drop.classList.remove('is-dragover');
    await handleFile(event.dataTransfer.files?.[0], target);
  });
}

async function handleFile(file, target) {
  if (!file) return;
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    const workbook = window.XLSX.read(buffer, { type: 'array' });
    state.sheetNames = workbook.SheetNames;
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    state.rows = window.XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
  } else {
    const text = await file.text();
    const parsed = parseCSV(text);
    state.rows = parsed.rows || [];
    state.headers = parsed.headers || Object.keys(state.rows[0] || {});
  }
  if (!state.headers.length) state.headers = Object.keys(state.rows[0] || {});
  state.mapping = autoMapping(state.headers);
  toast(`${state.rows.length.toLocaleString('ko-KR')}행을 읽었습니다.`);
  render(target);
}

async function previewSpreadsheet(target) {
  state.spreadsheetId = $('#source-spreadsheet-id', target)?.value.trim() || '';
  state.selectedSheetNames = ($('#source-sheet-names', target)?.value || '').split(',').map((item) => item.trim()).filter(Boolean);
  const result = await callAPI('migration.preview', { spreadsheetId: state.spreadsheetId, sheetNames: state.selectedSheetNames });
  state.rows = result.previewRows || [];
  state.headers = Object.keys(state.rows[0] || {});
  state.mapping = autoMapping(state.headers);
  toast('스프레드시트 미리보기를 불러왔습니다.');
  render(target);
}

function updateMappingFromSelects(target) {
  const next = {};
  target.querySelectorAll('.mapping-select').forEach((select) => {
    if (select.value) next[select.value] = select.dataset.header;
  });
  state.mapping = next;
}

async function runDryRun(target) {
  updateMappingFromSelects(target);
  const result = await callAPI('migration.dryRun', { rows: state.rows, mapping: state.mapping, spreadsheetId: state.spreadsheetId, sheetNames: state.selectedSheetNames });
  state.dryRun = result;
  state.step = 3;
  toast('드라이런을 완료했습니다.');
  render(target);
}

async function executeMigration(target) {
  const result = await callAPI('migration.execute', { rows: state.rows, mapping: state.mapping, spreadsheetId: state.spreadsheetId, sheetNames: state.selectedSheetNames });
  state.execution = result;
  state.migrationId = result.migrationId;
  state.step = 4;
  toast('마이그레이션을 완료했습니다.');
  render(target);
}

async function rollbackMigration(target) {
  if (!confirm('최근 마이그레이션 결과를 롤백할까요?')) return;
  const result = await callAPI('migration.rollback', { migrationId: state.migrationId || state.execution?.migrationId });
  toast(`롤백 완료: ${result.deleted || 0}건 제거`);
  render(target);
}

function autoMapping(headers) {
  const saved = JSON.parse(localStorage.getItem('crm_migration_mapping') || '{}');
  const mapping = { ...saved };
  headers.forEach((header) => {
    const normalized = String(header).toLowerCase();
    MAP_HINTS.forEach((hint) => {
      if (mapping[hint.field]) return;
      if (hint.keys.some((key) => normalized.includes(String(key).toLowerCase()))) mapping[hint.field] = header;
    });
  });
  return mapping;
}

function loadSampleRows() {
  const districts = ['김포시', '파주시', '부천시', '안산시', '고양시'];
  const programs = ['흑백창업가', '필터버블 탈출', 'Re_Brain / 팝콘브레인', 'MDC + 진로빅데이터', '캡스톤 디자인'];
  state.rows = Array.from({ length: 100 }, (_, index) => {
    const district = districts[index % districts.length];
    return {
      학교명: `${district.replace('시', '')}샘플${String(index + 1).padStart(3, '0')}고`,
      지역_시: '경기도',
      지역_구: district,
      학교유형: index % 3 === 0 ? '특성화고' : '고등학교',
      부서명: ['진로부', '창체부', '연구부'][index % 3],
      담당자명: `김담당${index + 1}`,
      직책: index % 4 === 0 ? '부장' : '교사',
      휴대폰: `010-${String(1000 + index).padStart(4, '0')}-${String(2000 + index).padStart(4, '0')}`,
      이메일: `sample${index + 1}@school.kr`,
      관심프로그램: programs[index % programs.length],
      우선순위: ['S', 'A', 'B', 'C'][index % 4],
      메모: index < 5 ? '기존 파일 중복 테스트 행' : '샘플 마이그레이션 행'
    };
  });
  state.headers = Object.keys(state.rows[0]);
  state.mapping = autoMapping(state.headers);
  state.step = 2;
}
