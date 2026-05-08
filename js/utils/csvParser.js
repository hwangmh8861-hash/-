import { escapeHTML } from '../utils.js';

export const 시스템필드 = [
  '학교명', '지역_시', '지역_구', '학교유형', '대표전화', '대표주소', '사업카테고리',
  '부서명', '담당자명', '직책', '휴대폰', '사무실전화', '이메일', '관계강도', '챔피언여부',
  '관심프로그램', '우선순위', '예상금액', '다음액션', '다음액션일', '메모'
];

export async function readImportFile(file, { headerRowIndex = 0 } = {}) {
  const buffer = await file.arrayBuffer();
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    if (!window.XLSX) throw new Error('XLSX 파서를 불러오지 못했습니다. CSV로 변환해 다시 시도해주세요.');
    const workbook = window.XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = window.XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
    return rowsToImportData(rows, headerRowIndex);
  }
  const text = decodeText(buffer);
  return parseCSV(text, { headerRowIndex });
}

export function decodeText(buffer) {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  const badChars = (utf8.match(/�/g) || []).length;
  if (badChars <= 2) return utf8;
  try {
    return new TextDecoder('euc-kr', { fatal: false }).decode(buffer);
  } catch (error) {
    try {
      return new TextDecoder('cp949', { fatal: false }).decode(buffer);
    } catch (innerError) {
      return utf8;
    }
  }
}

export function parseCSV(text = '', { headerRowIndex = 0 } = {}) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const normalized = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if (char === '\n' && !quoted) {
      row.push(cell.trim());
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some((value) => value !== '')) rows.push(row);
  return rowsToImportData(rows, headerRowIndex);
}

export function rowsToImportData(rows = [], headerRowIndex = 0) {
  const headerIndex = Math.max(0, Number(headerRowIndex || 0));
  const headers = (rows[headerIndex] || []).map((item, index) => String(item || `컬럼${index + 1}`).trim());
  const dataRows = rows.slice(headerIndex + 1).filter((row) => row.some((value) => String(value || '').trim() !== ''));
  const records = dataRows.map((row, rowIndex) => {
    const record = { __rowIndex: rowIndex + headerIndex + 2 };
    headers.forEach((header, index) => {
      record[header] = row[index] ?? '';
    });
    return record;
  });
  return { headers, rows: records, rawRows: rows };
}

export function autoMapColumns(headers = []) {
  const mapping = {};
  headers.forEach((header) => {
    const normalized = normalizeHeader(header);
    const target = guessField(normalized);
    if (target && !mapping[target]) mapping[target] = header;
  });
  return mapping;
}

export function validateRows(rows = [], mapping = {}, existingSchools = []) {
  const existingSet = new Set(existingSchools.map((school) => schoolKey(school.학교명, school.지역_시, school.지역_구)));
  return rows.map((row) => {
    const mapped = mapRow(row, mapping);
    if (!mapped.지역_시 || !mapped.지역_구) {
      const parsed = parseRegion(mapped.대표주소 || row[mapping['지역_시']] || row[mapping['지역_구']] || '');
      mapped.지역_시 = mapped.지역_시 || parsed.지역_시;
      mapped.지역_구 = mapped.지역_구 || parsed.지역_구;
    }
    const errors = [];
    const warnings = [];
    if (!mapped.학교명) errors.push('학교명 누락');
    if (!mapped.지역_시 && !mapped.지역_구) errors.push('지역 누락');
    if (mapped.휴대폰 && !isPhoneLike(mapped.휴대폰)) warnings.push('휴대폰 형식 확인 필요');
    if (mapped.이메일 && !String(mapped.이메일).includes('@')) warnings.push('이메일 형식 확인 필요');
    const duplicate = existingSet.has(schoolKey(mapped.학교명, mapped.지역_시, mapped.지역_구));
    if (duplicate) warnings.push('기존 학교와 중복 가능');
    return { row, mapped, errors, warnings, duplicate };
  });
}

export function mapRow(row = {}, mapping = {}) {
  const output = {};
  Object.entries(mapping).forEach(([field, source]) => {
    if (!source) return;
    output[field] = String(row[source] ?? '').trim();
  });
  return output;
}

export function recordsToCSV(records = [], headers = null) {
  const cols = headers || Array.from(records.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set()));
  const lines = [cols.join(',')];
  records.forEach((row) => {
    lines.push(cols.map((key) => csvEscape(row[key])).join(','));
  });
  return lines.join('\n');
}

export function downloadCSV(filename, records = [], headers = null) {
  const csv = recordsToCSV(records, headers);
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function renderMappingOptions(headers = [], selected = '') {
  return `<option value="">매핑 안 함</option>${headers.map((header) => `<option value="${escapeHTML(header)}" ${header === selected ? 'selected' : ''}>${escapeHTML(header)}</option>`).join('')}`;
}

export function parseRegion(value = '') {
  const text = String(value || '');
  const city = (text.match(/(서울|인천|경기|경기도|성남시|고양시|부천시|안산시|수원시|용인시|화성시|안양시|평택시|시흥시|광명시|군포시|의왕시|하남시|구리시|남양주시|김포시|파주시)/) || [])[0] || '';
  const district = (text.match(/([가-힣]+구|[가-힣]+군|[가-힣]+시)/g) || []).find((part) => part !== city) || '';
  return { 지역_시: city === '경기' ? '경기도' : city, 지역_구: district };
}

function normalizeHeader(header = '') {
  return String(header).toLowerCase().replace(/[\s_\-()]/g, '');
}

function guessField(header) {
  const rules = [
    ['학교명', ['학교명', '학교', '교명']],
    ['지역_시', ['지역시', '시도', '시']],
    ['지역_구', ['지역구', '구군', '구']],
    ['학교유형', ['학교유형', '유형', '학교급']],
    ['대표전화', ['대표전화', '학교전화', '전화']],
    ['대표주소', ['주소', '소재지']],
    ['사업카테고리', ['사업카테고리', '사업', '대상사업']],
    ['부서명', ['부서명', '부서', '부', '팀']],
    ['담당자명', ['담당자명', '담당', '선생', '교사', '쌤', '이름']],
    ['직책', ['직책', '직위', '역할']],
    ['휴대폰', ['휴대폰', '연락처', '번호', '핸드폰', '폰']],
    ['사무실전화', ['사무실전화', '내선', '교무실']],
    ['이메일', ['이메일', '메일', 'email']],
    ['관계강도', ['관계강도', '관계']],
    ['챔피언여부', ['챔피언', 'champion']],
    ['관심프로그램', ['관심프로그램', '프로그램', '상품', '교육']],
    ['우선순위', ['우선순위', '등급', 'priority']],
    ['예상금액', ['예상금액', '금액', '예산']],
    ['다음액션', ['다음액션', '할일', '후속']],
    ['다음액션일', ['다음액션일', '일정', '재콜일', '후속일']],
    ['메모', ['메모', '비고', '내용']]
  ];
  const found = rules.find(([, aliases]) => aliases.some((alias) => header.includes(alias)));
  return found ? found[0] : '';
}

function isPhoneLike(value) {
  return /^[0-9\-+\s()]{7,}$/.test(String(value || ''));
}

function schoolKey(name, city, district) {
  return [name, city, district].map((item) => String(item || '').trim()).join('|');
}

function csvEscape(value = '') {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
