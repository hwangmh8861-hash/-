import { callAPI } from '../api.js';
import { escapeHTML } from '../utils.js';
import { toast } from '../components/toast.js';
import {
  시스템필드,
  readImportFile,
  parseCSV,
  autoMapColumns,
  validateRows,
  renderMappingOptions,
  recordsToCSV
} from '../utils/csvParser.js';

const 프리셋키 = 'crm_import_mapping_presets';
let rootEl = null;
const state = {
  step: 1,
  fileName: '',
  headerRowIndex: 0,
  headers: [],
  rows: [],
  mapping: {},
  validation: [],
  existingSchools: [],
  options: {
    duplicateMode: 'merge',
    defaultStage: '리드',
    usePriorityColumn: true,
    createDeptOpportunity: true
  }
};

export async function render(target) {
  rootEl = target;
  state.step = 1;
  target.innerHTML = `
    <section class="page-head import-head">
      <div>
        <h1 class="page-title">임포트</h1>
        <p class="page-desc">학교·부서·담당자·영업기회를 CSV 또는 XLSX에서 가져오고, 중복과 필수값을 미리 검증합니다.</p>
      </div>
      <a class="ghost-button" href="#/list">리스트로 돌아가기</a>
    </section>
    <section id="import-root"></section>
  `;
  try {
    state.existingSchools = await callAPI('school.list', {});
  } catch (error) {
    state.existingSchools = [];
  }
  renderStep();
}

function renderStep() {
  const root = rootEl.querySelector('#import-root');
  root.innerHTML = `
    <div class="import-stepper">
      ${stepPill(1, '파일 업로드')}
      ${stepPill(2, '컬럼 매핑')}
      ${stepPill(3, '미리보기 + 검증')}
    </div>
    ${state.step === 1 ? renderUploadStep() : ''}
    ${state.step === 2 ? renderMappingStep() : ''}
    ${state.step === 3 ? renderPreviewStep() : ''}
  `;
  bindStep(root);
}

function renderUploadStep() {
  return `
    <section class="import-card">
      <div id="drop-zone" class="drop-zone">
        <strong>CSV/XLSX 파일을 끌어오거나 클릭해서 선택</strong>
        <span>UTF-8과 CP949 인코딩을 자동 감지합니다. XLSX는 브라우저에서 SheetJS를 사용할 수 있으면 바로 읽습니다.</span>
        <input id="import-file" type="file" accept=".csv,.xlsx,.xls,text/csv" hidden />
      </div>
      <div class="import-two-col">
        <label class="form-row">
          <span>헤더 행 번호</span>
          <input id="header-row-index" class="input" type="number" min="1" value="${state.headerRowIndex + 1}" />
        </label>
        <button id="sample-csv" class="ghost-button" type="button">100행 샘플 CSV 불러오기</button>
      </div>
      <label class="form-row">
        <span>또는 CSV 내용 직접 붙여넣기</span>
        <textarea id="csv-paste" class="textarea import-textarea" placeholder="학교명,지역_시,지역_구,부서명,담당자명,휴대폰,이메일,관심프로그램,우선순위,메모"></textarea>
      </label>
      <div class="wizard-actions">
        <button id="parse-paste" class="primary-button" type="button">붙여넣은 CSV 분석</button>
      </div>
    </section>
  `;
}

function renderMappingStep() {
  const presets = getPresets();
  return `
    <section class="import-card">
      <div class="import-summary-line">
        <strong>${escapeHTML(state.fileName || '붙여넣은 CSV')}</strong>
        <span>${state.headers.length}개 컬럼 · ${state.rows.length}행</span>
      </div>
      <div class="mapping-tools">
        <select id="mapping-preset">
          <option value="">매핑 프리셋 불러오기</option>
          ${presets.map((item, index) => `<option value="${index}">${escapeHTML(item.name)}</option>`).join('')}
        </select>
        <button id="save-mapping-preset" class="ghost-button" type="button">현재 매핑 프리셋 저장</button>
        <button id="auto-map" class="ghost-button" type="button">자동 매핑 다시 실행</button>
      </div>
      <div class="mapping-grid">
        <div class="mapping-source">
          <h2>CSV 컬럼 자동 인식 결과</h2>
          ${state.headers.map((header) => `<div class="source-column"><strong>${escapeHTML(header)}</strong><span>${escapeHTML(sampleValues(header))}</span></div>`).join('')}
        </div>
        <div class="mapping-target">
          <h2>시스템 필드 매핑</h2>
          ${시스템필드.map((field) => `
            <label class="mapping-row">
              <span>${escapeHTML(field)}</span>
              <select data-map-field="${escapeHTML(field)}">${renderMappingOptions(state.headers, state.mapping[field] || '')}</select>
            </label>
          `).join('')}
        </div>
      </div>
      <div class="wizard-actions">
        <button class="ghost-button" type="button" data-step-prev>이전</button>
        <button id="go-preview" class="primary-button" type="button">미리보기와 검증으로 이동</button>
      </div>
    </section>
  `;
}

function renderPreviewStep() {
  const okCount = state.validation.filter((item) => !item.errors.length).length;
  const errorCount = state.validation.filter((item) => item.errors.length).length;
  const duplicateCount = state.validation.filter((item) => item.duplicate).length;
  return `
    <section class="import-card">
      <div class="validation-summary">
        <div><strong>${state.validation.length}</strong><span>전체 행</span></div>
        <div><strong>${okCount}</strong><span>가져오기 가능</span></div>
        <div><strong>${duplicateCount}</strong><span>중복 가능</span></div>
        <div class="danger"><strong>${errorCount}</strong><span>필수 오류</span></div>
      </div>

      <div class="import-options">
        <label><span>중복 처리</span><select id="duplicate-mode"><option value="merge">병합</option><option value="skip">건너뛰기</option><option value="create">새로 생성</option></select></label>
        <label><span>신규 기본 단계</span><select id="default-stage"><option value="리드">리드</option><option value="TM시도">TM시도</option><option value="자료발송">자료발송</option></select></label>
        <label><input id="use-priority" type="checkbox" ${state.options.usePriorityColumn ? 'checked' : ''} /> 우선순위 컬럼이 있으면 사용</label>
        <label><input id="create-dept" type="checkbox" ${state.options.createDeptOpportunity ? 'checked' : ''} /> 부서 컬럼 기준으로 기회 생성</label>
      </div>

      <div class="preview-table-wrap">
        <table class="preview-table">
          <thead><tr><th>행</th><th>학교명</th><th>지역</th><th>부서</th><th>담당자</th><th>프로그램</th><th>검증</th></tr></thead>
          <tbody>
            ${state.validation.slice(0, 20).map((item) => `
              <tr class="${item.errors.length ? 'has-error' : item.duplicate ? 'has-warning' : ''}">
                <td>${item.row.__rowIndex}</td>
                <td>${escapeHTML(item.mapped.학교명 || '-')}</td>
                <td>${escapeHTML(`${item.mapped.지역_시 || ''} ${item.mapped.지역_구 || ''}`.trim() || '-')}</td>
                <td>${escapeHTML(item.mapped.부서명 || '-')}</td>
                <td>${escapeHTML(item.mapped.담당자명 || '-')}</td>
                <td>${escapeHTML(item.mapped.관심프로그램 || '-')}</td>
                <td>${renderValidationMessages(item)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div id="import-progress" class="import-progress" hidden><i style="width:0%"></i><span>임포트 준비 중</span></div>
      <div id="import-result" class="import-result"></div>
      <div class="wizard-actions">
        <button class="ghost-button" type="button" data-step-prev>이전</button>
        <button id="run-import" class="primary-button" type="button" ${errorCount ? 'disabled' : ''}>임포트 실행</button>
      </div>
    </section>
  `;
}

function bindStep(root) {
  if (state.step === 1) bindUpload(root);
  if (state.step === 2) bindMapping(root);
  if (state.step === 3) bindPreview(root);
  root.querySelector('[data-step-prev]')?.addEventListener('click', () => {
    state.step = Math.max(1, state.step - 1);
    renderStep();
  });
}

function bindUpload(root) {
  const input = root.querySelector('#import-file');
  const dropZone = root.querySelector('#drop-zone');
  const headerInput = root.querySelector('#header-row-index');
  const updateHeader = () => { state.headerRowIndex = Math.max(0, Number(headerInput.value || 1) - 1); };
  headerInput?.addEventListener('input', updateHeader);

  dropZone?.addEventListener('click', () => input?.click());
  dropZone?.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone?.addEventListener('drop', async (event) => {
    event.preventDefault();
    dropZone.classList.remove('dragover');
    updateHeader();
    await handleFile(event.dataTransfer.files[0]);
  });
  input?.addEventListener('change', async () => {
    updateHeader();
    await handleFile(input.files[0]);
  });

  root.querySelector('#parse-paste')?.addEventListener('click', () => {
    updateHeader();
    const text = root.querySelector('#csv-paste')?.value || '';
    if (!text.trim()) return toast('분석할 CSV 내용을 입력해주세요.', 'error');
    const parsed = parseCSV(text, { headerRowIndex: state.headerRowIndex });
    setParsedData(parsed, '붙여넣은 CSV');
  });

  root.querySelector('#sample-csv')?.addEventListener('click', () => {
    const csv = makeSampleCSV(100);
    root.querySelector('#csv-paste').value = csv;
    const parsed = parseCSV(csv, { headerRowIndex: 0 });
    setParsedData(parsed, '100행 샘플 CSV');
  });
}

async function handleFile(file) {
  if (!file) return;
  try {
    const parsed = await readImportFile(file, { headerRowIndex: state.headerRowIndex });
    setParsedData(parsed, file.name);
  } catch (error) {
    toast(error.message, 'error');
  }
}

function setParsedData(parsed, fileName) {
  state.fileName = fileName;
  state.headers = parsed.headers;
  state.rows = parsed.rows;
  state.mapping = autoMapColumns(parsed.headers);
  state.step = 2;
  toast(`${parsed.rows.length}행을 분석했습니다.`, 'success');
  renderStep();
}

function bindMapping(root) {
  root.querySelectorAll('[data-map-field]').forEach((select) => {
    select.addEventListener('change', () => {
      state.mapping[select.dataset.mapField] = select.value;
    });
  });

  root.querySelector('#auto-map')?.addEventListener('click', () => {
    state.mapping = autoMapColumns(state.headers);
    renderStep();
  });

  root.querySelector('#save-mapping-preset')?.addEventListener('click', () => {
    const name = window.prompt('저장할 매핑 프리셋 이름을 입력해주세요.', '학교 DB 기본 양식');
    if (!name) return;
    const presets = getPresets();
    presets.push({ name, mapping: state.mapping });
    localStorage.setItem(프리셋키, JSON.stringify(presets));
    toast('매핑 프리셋을 저장했습니다.', 'success');
    renderStep();
  });

  root.querySelector('#mapping-preset')?.addEventListener('change', (event) => {
    const preset = getPresets()[Number(event.target.value)];
    if (!preset) return;
    state.mapping = { ...preset.mapping };
    renderStep();
  });

  root.querySelector('#go-preview')?.addEventListener('click', () => {
    state.validation = validateRows(state.rows, state.mapping, state.existingSchools);
    state.step = 3;
    renderStep();
  });
}

function bindPreview(root) {
  const duplicateSelect = root.querySelector('#duplicate-mode');
  const defaultStage = root.querySelector('#default-stage');
  duplicateSelect.value = state.options.duplicateMode;
  defaultStage.value = state.options.defaultStage;
  duplicateSelect.addEventListener('change', () => { state.options.duplicateMode = duplicateSelect.value; });
  defaultStage.addEventListener('change', () => { state.options.defaultStage = defaultStage.value; });
  root.querySelector('#use-priority')?.addEventListener('change', (event) => { state.options.usePriorityColumn = event.target.checked; });
  root.querySelector('#create-dept')?.addEventListener('change', (event) => { state.options.createDeptOpportunity = event.target.checked; });
  root.querySelector('#run-import')?.addEventListener('click', () => runImport(root));
}

async function runImport(root) {
  const progress = root.querySelector('#import-progress');
  const result = root.querySelector('#import-result');
  progress.hidden = false;
  progress.querySelector('i').style.width = '35%';
  progress.querySelector('span').textContent = '검증된 데이터를 전송하는 중입니다.';
  try {
    const valid = state.validation.filter((item) => !item.errors.length);
    const csvText = recordsToCSV(valid.map((item) => item.mapped));
    progress.querySelector('i').style.width = '70%';
    const response = await callAPI('import.csv', {
      csvText,
      mapping: Object.fromEntries(Object.keys(valid[0]?.mapped || {}).map((key) => [key, key])),
      options: state.options
    });
    progress.querySelector('i').style.width = '100%';
    progress.querySelector('span').textContent = '임포트 완료';
    result.innerHTML = `<div class="result-box success"><strong>임포트 완료</strong><span>성공 ${response.success || 0}건 · 실패 ${response.failed || 0}건</span></div>`;
    toast('임포트를 완료했습니다.', 'success');
  } catch (error) {
    progress.querySelector('span').textContent = '임포트 실패';
    result.innerHTML = `<div class="result-box error"><strong>임포트 실패</strong><span>${escapeHTML(error.message)}</span></div>`;
  }
}

function stepPill(step, label) {
  const active = state.step === step ? 'active' : state.step > step ? 'done' : '';
  return `<div class="step-pill ${active}"><strong>${step}</strong><span>${escapeHTML(label)}</span></div>`;
}

function sampleValues(header) {
  return state.rows.slice(0, 3).map((row) => row[header]).filter(Boolean).join(' / ') || '샘플 없음';
}

function renderValidationMessages(item) {
  const list = [...item.errors, ...item.warnings];
  if (!list.length) return '<span class="valid-ok">정상</span>';
  return list.map((message) => `<span class="validation-chip">${escapeHTML(message)}</span>`).join('');
}

function getPresets() {
  try {
    return JSON.parse(localStorage.getItem(프리셋키) || '[]');
  } catch (error) {
    return [];
  }
}

function makeSampleCSV(count) {
  const schools = ['분당아람고', '성남미래중', '고양하늘고', '부천상업고', '안산디지털고', '수원창의중', '용인지혜고', '광명진로중', '김포AI고', '파주미래고'];
  const districts = ['분당구', '수정구', '일산동구', '원미구', '단원구', '영통구', '수지구', '광명시', '김포시', '파주시'];
  const depts = ['진로부', '창체부', '연구부', '정보부', '학생부'];
  const programs = ['흑백창업가', '필터버블 탈출', 'Re_Brain / 팝콘브레인', 'MDC + 진로빅데이터', '캡스톤 디자인'];
  const rows = ['학교명,지역_시,지역_구,학교유형,부서명,담당자명,휴대폰,이메일,관심프로그램,우선순위,예상금액,메모'];
  for (let i = 0; i < count; i += 1) {
    const index = i % schools.length;
    const duplicateName = i < 5 ? schools[0] : `${schools[index]}${i}`;
    rows.push([
      duplicateName,
      index % 2 === 0 ? '경기도' : '인천광역시',
      districts[index],
      index % 3 === 0 ? '특성화고' : index % 3 === 1 ? '고등학교' : '중학교',
      depts[i % depts.length],
      `김담당${i + 1}`,
      `010-12${String(i).padStart(2, '0')}-34${String(i).padStart(2, '0')}`,
      `teacher${i + 1}@school.kr`,
      programs[i % programs.length],
      ['S', 'A', 'B', 'C'][i % 4],
      800000 + (i % 8) * 300000,
      '샘플 임포트 데이터'
    ].join(','));
  }
  return rows.join('\n');
}
