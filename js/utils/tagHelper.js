export const 단계목록 = ['리드', 'TM시도', '자료발송', 'EVD예정', 'EVD완료', '제안서발송', '계약검토', '계약완료'];
export const 비정상단계목록 = ['보류', '드랍'];

export const 단계색상변수 = {
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

export const 우선순위색상변수 = {
  S: '--priority-s',
  A: '--priority-a',
  B: '--priority-b',
  C: '--priority-c'
};

export const 태그카테고리 = {
  부정: ['통화거절', '관심없음', '잘못된번호', '드랍사유'],
  경고: ['부재중-재콜필요', '자료검토중-회신대기'],
  중립: ['보류-시점미정', '결정자아님-상위연결필요', '기타'],
  정보: ['이메일요청', '회의중-재콜약속', '담당자부재-시간약속'],
  긍정: ['관심있음-EVD예정']
};

export const 태그색상변수 = {
  부정: '--tag-negative',
  경고: '--tag-warning',
  중립: '--tag-neutral',
  정보: '--tag-info',
  긍정: '--tag-positive'
};

export const 기본태그 = [
  '부재중-재콜필요',
  '담당자부재-시간약속',
  '통화거절',
  '이메일요청',
  '자료검토중-회신대기',
  '회의중-재콜약속',
  '관심있음-EVD예정',
  '관심없음',
  '잘못된번호',
  '보류-시점미정',
  '결정자아님-상위연결필요',
  '기타'
];

export function getTagCategory(tag = '') {
  const normalized = String(tag).trim();
  for (const [category, tags] of Object.entries(태그카테고리)) {
    if (tags.some((item) => normalized.includes(item))) return category;
  }
  return '중립';
}

export function getTagColorVar(tag = '') {
  return 태그색상변수[getTagCategory(tag)] || '--tag-neutral';
}

export function getStageColorVar(stage = '') {
  return 단계색상변수[stage] || '--tag-neutral';
}

export function getPriorityColorVar(priority = '') {
  return 우선순위색상변수[priority] || '--priority-c';
}

export function normalizeArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

export function parseTags(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return normalizeArray(value);
  }
}

export function uniqueTagsFromOpps(opps = []) {
  const set = new Set(기본태그);
  opps.forEach((opp) => parseTags(opp.태그_JSON).forEach((tag) => set.add(tag)));
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
}

export function suggestedTagsForStageMove(fromStage, toStage) {
  const key = `${fromStage}->${toStage}`;
  const map = {
    'TM시도->자료발송': ['이메일요청', '자료검토중-회신대기'],
    'TM시도->EVD예정': ['관심있음-EVD예정'],
    '자료발송->EVD예정': ['관심있음-EVD예정'],
    '자료발송->보류': ['자료검토중-회신대기', '보류-시점미정'],
    '리드->TM시도': ['부재중-재콜필요'],
    'EVD완료->제안서발송': ['자료검토중-회신대기'],
    '제안서발송->계약검토': ['관심있음-EVD예정'],
    '계약검토->계약완료': ['관심있음-EVD예정'],
    'TM시도->드랍': ['관심없음'],
    '자료발송->드랍': ['관심없음'],
    'EVD예정->드랍': ['관심없음']
  };
  return map[key] || [];
}

export function isNextActionRequired(fromStage, toStage) {
  return fromStage === 'TM시도' && toStage === 'EVD예정';
}

export function getStageThreshold(stage) {
  const thresholds = {
    '리드': 7,
    'TM시도': 3,
    '자료발송': 7,
    'EVD예정': 5,
    'EVD완료': 3,
    '제안서발송': 14,
    '계약검토': 21,
    '계약완료': 0,
    '보류': 30,
    '드랍': 0
  };
  return thresholds[stage] ?? 0;
}

export function calculateStagnation(opp = {}) {
  const rawEnteredAt = opp.단계진입일 || opp.생성일;
  const enteredAt = rawEnteredAt ? new Date(rawEnteredAt) : new Date();
  const today = new Date();
  const days = Number.isNaN(enteredAt.getTime()) ? 0 : Math.max(0, Math.floor((today - enteredAt) / (24 * 60 * 60 * 1000)));
  const threshold = getStageThreshold(opp.현재단계);
  return {
    정체일수: Number(opp.정체일수 ?? opp.정체일수_캐시 ?? days),
    정체임계치: Number(opp.정체임계치 ?? threshold),
    정체여부: Boolean(opp.정체여부) || (threshold > 0 && days >= threshold)
  };
}

export function getDefaultWipLimit(stage) {
  const limits = {
    '리드': 50,
    'TM시도': 20,
    '자료발송': 15,
    'EVD예정': 8,
    'EVD완료': 5,
    '제안서발송': 10,
    '계약검토': 8,
    '계약완료': Infinity
  };
  return limits[stage] ?? Infinity;
}

export function getWipLimitText(stage) {
  const limit = getDefaultWipLimit(stage);
  return Number.isFinite(limit) ? `${limit}건` : '제한없음';
}

export function isWithinWeek(dateValue) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  return date >= today && date <= weekEnd;
}

export function getDaysUntil(dateValue) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date - today) / (24 * 60 * 60 * 1000));
}
