export function $(selector, root = document) {
  return root.querySelector(selector);
}

export function $$(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function escapeHTML(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

export function formatWon(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency', currency: 'KRW', maximumFractionDigits: 0
  }).format(number);
}

export function debounce(fn, wait = 300) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function parseJSON(value, fallback = []) {
  if (Array.isArray(value) || typeof value === 'object') return value;
  try {
    return JSON.parse(value || '');
  } catch (error) {
    return fallback;
  }
}

export function groupBy(list, keyGetter) {
  return list.reduce((acc, item) => {
    const key = typeof keyGetter === 'function' ? keyGetter(item) : item[keyGetter];
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

export function stageColorVar(stage) {
  const map = {
    '리드': '--stage-lead',
    'TM시도': '--stage-tm',
    '자료발송': '--stage-material',
    'EVD예정': '--stage-evd-scheduled',
    'EVD완료': '--stage-evd-done',
    '제안서발송': '--stage-proposal',
    '계약검토': '--stage-contract-review',
    '계약완료': '--stage-contract-done',
    '보류': '--stage-hold',
    '드랍': '--stage-drop'
  };
  return map[stage] || '--tag-neutral';
}

export function priorityColorVar(priority) {
  const map = {
    S: '--priority-s',
    A: '--priority-a',
    B: '--priority-b',
    C: '--priority-c'
  };
  return map[priority] || '--priority-c';
}

export function tagColorVar(tag) {
  if (['통화거절', '관심없음', '잘못된번호'].includes(tag)) return '--tag-negative';
  if (['부재중-재콜필요', '담당자부재-시간약속', '회의중-재콜약속', '보류-시점미정'].includes(tag)) return '--tag-warning';
  if (['이메일요청', '자료검토중-회신대기', '결정자아님-상위연결필요'].includes(tag)) return '--tag-info';
  if (['관심있음-EVD예정'].includes(tag)) return '--tag-positive';
  return '--tag-neutral';
}

export function qs(params = {}) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}
