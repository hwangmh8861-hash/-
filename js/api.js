import { getToken, clearToken } from './auth.js';
import { parseJSON } from './utils.js';

export const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbyTGNC4EMOqG9BCs013zOYdZD-scsMepwiyqf7y2o3bIh3QW-AUfRQB1OLC0b1ziJiI-A/exec',
  TOKEN_KEY: 'crm_token',
  TOKEN_TTL_MS: 30 * 60 * 1000
};

const fixtureCache = new Map();
let mockMemory = null;

export async function callAPI(action, payload = {}) {
  if (window.__USE_MOCK === true) {
    return mockCallAPI(action, payload);
  }

  const token = getToken();
  const res = await fetch(CONFIG.GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token, payload })
  });
  const json = await res.json();
  if (!json.ok) {
    if (json.error === 'TOKEN_EXPIRED') {
      clearToken();
      location.hash = '#/login';
    }
    throw new Error(json.error || '요청 처리 중 오류가 발생했습니다.');
  }
  return json.data;
}

async function loadFixture(name) {
  if (fixtureCache.has(name)) return fixtureCache.get(name);
  const res = await fetch(`./fixtures/${name}.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error('목업 데이터를 불러오지 못했습니다.');
  const data = await res.json();
  fixtureCache.set(name, data);
  return data;
}

async function getMockMemory() {
  if (mockMemory) return mockMemory;
  const [schools, departments, contacts, opportunities, activities] = await Promise.all([
    loadFixture('schools'),
    loadFixture('departments'),
    loadFixture('contacts'),
    loadFixture('opportunities'),
    loadFixture('activities')
  ]);
  mockMemory = {
    schools,
    departments,
    contacts,
    opportunities,
    activities,
    settings: buildDefaultSettings(),
    backups: [],
    reports: [buildMockReport('R202604', '2026-04')],
    migrationLogs: []
  };
  return mockMemory;
}

async function mockCallAPI(action, payload = {}) {
  await new Promise((resolve) => setTimeout(resolve, 120));

  if (action === 'auth.login') {
    if (!payload.password) throw new Error('비밀번호를 입력해주세요.');
    return {
      token: 'mock-token-' + Date.now(),
      expiresAt: Date.now() + CONFIG.TOKEN_TTL_MS
    };
  }

  const db = await getMockMemory();

  switch (action) {
    case 'auth.verify':
      return { valid: true };
    case 'school.list':
      return filterSchools(db.schools, payload || {});
    case 'school.get':
      return getSchoolTree(db, payload.school_id || payload);
    case 'school.update':
      return updateMockSchool(db, payload || {});
    case 'dept.list':
      return db.departments.filter((item) => item.school_id === (payload.school_id || payload));
    case 'dept.create':
      return createMockDepartment(db, payload || {});
    case 'dept.update':
      return updateMockDepartment(db, payload || {});
    case 'dept.delete':
      return deleteMockDepartment(db, payload || {});
    case 'contact.list':
      return db.contacts.filter((item) => {
        if (payload.dept_id) return item.dept_id === payload.dept_id;
        if (payload.school_id) return item.school_id === payload.school_id;
        return true;
      });
    case 'contact.create':
      return createMockContact(db, payload || {});
    case 'contact.update':
      return updateMockContact(db, payload || {});
    case 'contact.delete':
      return deleteMockContact(db, payload || {});
    case 'opp.list':
      return filterOpportunities(db, payload || {});
    case 'opp.get':
      return getOpportunityTree(db, payload.opp_id || payload);
    case 'opp.create':
      return createMockOpportunity(db, payload || {});
    case 'opp.changeStage':
      return changeMockStage(db, payload || {});
    case 'opp.update':
      return updateMockOpportunity(db, payload || {});
    case 'opp.delete':
      return deleteMockOpportunity(db, payload || {});
    case 'opp.addTags':
      return addMockTags(db, payload || {});
    case 'opp.removeTags':
      return removeMockTags(db, payload || {});
    case 'activity.create':
      return createMockActivity(db, payload || {});
    case 'activity.update':
      return updateMockActivity(db, payload || {});
    case 'activity.delete':
      return deleteMockActivity(db, payload || {});
    case 'activity.list':
      return db.activities
        .filter((item) => item.opp_id === (payload.opp_id || payload))
        .sort((a, b) => String(b.활동일시).localeCompare(String(a.활동일시)));
    case 'dashboard.summary':
      return buildSummary(db);
    case 'export.all':
      return { schools: db.schools, departments: db.departments, contacts: db.contacts, opportunities: db.opportunities, activities: db.activities };
    case 'import.csv':
      return importMockCSV(db, payload || {});
    case 'search.global':
      return globalSearch(db, payload.검색어 || payload.query || payload.keyword || '');
    case 'tag.list':
      return listTags(db.opportunities);
    case 'tag.suggest':
      return listTags(db.opportunities)
        .filter((item) => item.태그.startsWith(payload.prefix || ''))
        .slice(0, 10);
    case 'migration.preview':
      return previewMockMigration(db, payload || {});
    case 'migration.dryRun':
      return dryRunMockMigration(db, payload || {});
    case 'migration.execute':
      return executeMockMigration(db, payload || {});
    case 'migration.rollback':
      return rollbackMockMigration(db, payload || {});
    case 'settings.get':
      return getMockSettings(db);
    case 'settings.save':
      return saveMockSettings(db, payload || {});
    case 'settings.changePassword':
      return { changed: true };
    case 'settings.resetAll':
      return resetMockAll(db, payload || {});
    case 'backup.create':
      return createMockBackup(db);
    case 'backup.list':
      return db.backups.map((item) => ({ name: item.name, createdAt: item.createdAt }));
    case 'restore.preview':
      return previewMockRestore(payload || {});
    case 'restore.execute':
      return executeMockRestore(db, payload || {});
    case 'notifications.sendDaily':
      return buildMockNotification(db, payload || {});
    case 'reports.list':
      return db.reports.map(({ html, ...meta }) => meta).sort((a, b) => String(b.생성일).localeCompare(String(a.생성일)));
    case 'reports.get':
      return getMockReport(db, payload || {});
    case 'reports.generate':
      return generateMockReport(db, payload || {});
    default:
      return { 목업: true, 안내: `${action} 동작은 Phase 3 이후 실제 화면에서 연결됩니다.` };
  }
}

function filterSchools(schools, filter) {
  const term = String(filter.검색어 || filter.query || '').trim();
  return schools.filter((school) => {
    if (filter.지역 && !String(school.지역_구).includes(filter.지역)) return false;
    if (filter.유형 && school.학교유형 !== filter.유형) return false;
    if (filter.사업카테고리 && !String(school.사업카테고리).includes(filter.사업카테고리)) return false;
    if (term && ![school.학교명, school.지역_시, school.지역_구, school.학교메모].join(' ').includes(term)) return false;
    return true;
  });
}

function filterOpportunities(db, filter) {
  const schoolsById = Object.fromEntries(db.schools.map((item) => [item.school_id, item]));
  const departmentsById = Object.fromEntries(db.departments.map((item) => [item.dept_id, item]));
  const term = String(filter.검색어 || filter.query || '').trim();
  const stages = normalizeArray(filter.단계);
  const priorities = normalizeArray(filter.우선순위);
  const tags = normalizeArray(filter.태그);
  const programs = normalizeArray(filter.관심프로그램);

  const rows = db.opportunities
    .map((opp) => ({
      ...opp,
      학교: schoolsById[opp.school_id] || null,
      부서: departmentsById[opp.dept_id] || null,
      담당자들: db.contacts.filter((contact) => contact.dept_id === opp.dept_id),
      태그목록: parseJSON(opp.태그_JSON, [])
    }))
    .filter((opp) => {
      const school = opp.학교 || {};
      const dept = opp.부서 || {};
      if (stages.length && !stages.includes(opp.현재단계)) return false;
      if (priorities.length && !priorities.includes(opp.우선순위)) return false;
      if (programs.length && !programs.includes(opp.관심프로그램)) return false;
      if (tags.length && !tags.some((tag) => opp.태그목록.includes(tag))) return false;
      if (filter.정체여부 !== undefined && Boolean(opp.정체여부) !== Boolean(filter.정체여부)) return false;
      if (term) {
        const haystack = [school.학교명, dept.부서명, opp.기회제목, opp.기회메모].join(' ');
        if (!haystack.includes(term)) return false;
      }
      return true;
    })
    .map((opp) => enrichStagnation(opp));

  if (filter.그룹핑 === 'school') {
    return Object.values(rows.reduce((acc, opp) => {
      const key = opp.school_id;
      if (!acc[key]) acc[key] = { school_id: key, 학교: opp.학교, 기회목록: [] };
      acc[key].기회목록.push(opp);
      return acc;
    }, {}));
  }

  return rows;
}

function getSchoolTree(db, schoolId) {
  const school = db.schools.find((item) => item.school_id === schoolId);
  if (!school) throw new Error('학교를 찾을 수 없습니다.');
  const departments = db.departments.filter((item) => item.school_id === schoolId);
  const contacts = db.contacts.filter((item) => item.school_id === schoolId);
  return {
    ...school,
    부서들: departments,
    담당자들: contacts,
    기회들: db.opportunities
      .filter((item) => item.school_id === schoolId)
      .map((opp) => enrichStagnation({
        ...opp,
        학교: school,
        부서: departments.find((dept) => dept.dept_id === opp.dept_id) || null,
        담당자들: contacts.filter((contact) => contact.dept_id === opp.dept_id)
      }))
  };
}

function getOpportunityTree(db, oppId) {
  const opp = db.opportunities.find((item) => item.opp_id === oppId);
  if (!opp) throw new Error('영업기회를 찾을 수 없습니다.');
  const enriched = enrichStagnation(opp);
  return {
    ...enriched,
    학교: db.schools.find((item) => item.school_id === opp.school_id) || null,
    부서: db.departments.find((item) => item.dept_id === opp.dept_id) || null,
    담당자들: db.contacts.filter((item) => item.dept_id === opp.dept_id),
    활동로그: db.activities.filter((item) => item.opp_id === opp.opp_id).sort((a, b) => String(b.활동일시).localeCompare(String(a.활동일시)))
  };
}


function updateMockSchool(db, payload = {}) {
  const school = db.schools.find((item) => item.school_id === (payload.school_id || payload.id));
  if (!school) throw new Error('학교를 찾을 수 없습니다.');
  Object.entries(payload).forEach(([key, value]) => {
    if (['school_id', 'id'].includes(key)) return;
    school[key] = value;
  });
  school.수정일 = nowISO();
  return school;
}

function createMockDepartment(db, payload = {}) {
  const schoolId = payload.school_id;
  const school = db.schools.find((item) => item.school_id === schoolId);
  if (!school) throw new Error('학교를 찾을 수 없습니다.');
  const deptName = String(payload.부서명 || '').trim();
  if (!deptName) throw new Error('부서명을 입력해주세요.');
  const duplicated = db.departments.some((item) => item.school_id === schoolId && item.부서명 === deptName);
  if (duplicated) throw new Error('이미 같은 이름의 부서가 있습니다.');
  const dept = {
    dept_id: nextId(db.departments, 'dept_id', 'D', 6),
    school_id: schoolId,
    부서명: deptName,
    부서메모: payload.부서메모 || '',
    생성일: nowISO()
  };
  db.departments.push(dept);
  return dept;
}

function updateMockDepartment(db, payload = {}) {
  const dept = db.departments.find((item) => item.dept_id === (payload.dept_id || payload.id));
  if (!dept) throw new Error('부서를 찾을 수 없습니다.');
  Object.entries(payload).forEach(([key, value]) => {
    if (['dept_id', 'id'].includes(key)) return;
    dept[key] = value;
  });
  return dept;
}

function deleteMockDepartment(db, payload = {}) {
  const deptId = payload.dept_id || payload.id || payload;
  const before = db.departments.length;
  db.departments = db.departments.filter((item) => item.dept_id !== deptId);
  db.contacts = db.contacts.filter((item) => item.dept_id !== deptId);
  const removedOppIds = db.opportunities.filter((item) => item.dept_id === deptId).map((item) => item.opp_id);
  db.opportunities = db.opportunities.filter((item) => item.dept_id !== deptId);
  db.activities = db.activities.filter((item) => !removedOppIds.includes(item.opp_id));
  return { deleted: before - db.departments.length };
}

function createMockContact(db, payload = {}) {
  const school = db.schools.find((item) => item.school_id === payload.school_id);
  const dept = db.departments.find((item) => item.dept_id === payload.dept_id);
  if (!school) throw new Error('학교를 찾을 수 없습니다.');
  if (!dept) throw new Error('부서를 찾을 수 없습니다.');
  if (!payload.이름) throw new Error('담당자명을 입력해주세요.');
  const contact = {
    contact_id: nextId(db.contacts, 'contact_id', 'C', 6),
    school_id: school.school_id,
    dept_id: dept.dept_id,
    이름: payload.이름,
    직책: payload.직책 || '교사',
    휴대폰: payload.휴대폰 || '',
    사무실전화: payload.사무실전화 || school.대표전화 || '',
    이메일: payload.이메일 || '',
    관계강도: payload.관계강도 || '약',
    챔피언여부: payload.챔피언여부 || 'N',
    담당자메모: payload.담당자메모 || '',
    생성일: nowISO(),
    수정일: nowISO()
  };
  db.contacts.push(contact);
  return contact;
}

function updateMockContact(db, payload = {}) {
  const contact = db.contacts.find((item) => item.contact_id === (payload.contact_id || payload.id));
  if (!contact) throw new Error('담당자를 찾을 수 없습니다.');
  Object.entries(payload).forEach(([key, value]) => {
    if (['contact_id', 'id'].includes(key)) return;
    contact[key] = value;
  });
  contact.수정일 = nowISO();
  return contact;
}

function deleteMockContact(db, payload = {}) {
  const contactId = payload.contact_id || payload.id || payload;
  const before = db.contacts.length;
  db.contacts = db.contacts.filter((item) => item.contact_id !== contactId);
  db.opportunities.forEach((opp) => {
    ['MEDDIC_이코노믹바이어_contactid', 'MEDDIC_챔피언_contactid', '다음액션담당자_contactid'].forEach((key) => {
      if (opp[key] === contactId) opp[key] = '';
    });
  });
  return { deleted: before - db.contacts.length };
}

function createMockOpportunity(db, payload = {}) {
  const school = db.schools.find((item) => item.school_id === payload.school_id) || db.schools[0];
  let dept = null;
  if (payload.dept_id) dept = db.departments.find((item) => item.dept_id === payload.dept_id);
  if (!dept) {
    dept = {
      dept_id: nextId(db.departments, 'dept_id', 'D', 6),
      school_id: school.school_id,
      부서명: payload.부서명_신규 || payload.부서명 || '부서 미지정',
      부서메모: '목업에서 생성된 부서입니다.',
      생성일: nowISO()
    };
    db.departments.push(dept);
  }

  if (payload.담당자명_신규) {
    db.contacts.push({
      contact_id: nextId(db.contacts, 'contact_id', 'C', 6),
      school_id: school.school_id,
      dept_id: dept.dept_id,
      이름: payload.담당자명_신규,
      직책: '교사',
      휴대폰: '',
      사무실전화: school.대표전화 || '',
      이메일: '',
      관계강도: '약',
      챔피언여부: 'N',
      담당자메모: '목업에서 생성된 담당자입니다.',
      생성일: nowISO(),
      수정일: nowISO()
    });
  }

  const opp = {
    opp_id: nextId(db.opportunities, 'opp_id', 'O', 6),
    school_id: school.school_id,
    dept_id: dept.dept_id,
    기회제목: payload.기회제목 || `${school.학교명}-${dept.부서명}-${payload.관심프로그램 || '기타 커스텀'}`,
    현재단계: payload.현재단계 || '리드',
    단계진입일: nowISO(),
    이전단계: '',
    단계변경이력_JSON: '[]',
    관심프로그램: payload.관심프로그램 || '기타 커스텀',
    우선순위: payload.우선순위 || 'C',
    우선순위_자동점수: payload.우선순위_자동점수 || 0,
    우선순위_수동오버라이드: payload.우선순위_수동오버라이드 || 'N',
    예상계약일: payload.예상계약일 || '',
    예상금액: Number(payload.예상금액 || 0),
    실계약일: '',
    실계약금액: '',
    태그_JSON: payload.태그_JSON || '[]',
    BANT_예산상태: '모름',
    BANT_예산금액: '',
    BANT_권한: '모름',
    BANT_니즈키워드: '',
    BANT_니즈상세: '',
    BANT_시점: '',
    MEDDIC_메트릭: '',
    MEDDIC_이코노믹바이어_contactid: '',
    MEDDIC_결정프로세스: '',
    MEDDIC_페인: '',
    MEDDIC_챔피언_contactid: '',
    MEDDIC_경쟁사: '',
    사업신청유형: '',
    사업신청상태: '',
    마지막활동일: todayString(),
    다음액션: '',
    다음액션일: '',
    다음액션담당자_contactid: '',
    정체일수_캐시: 0,
    기회메모: payload.기회메모 || '',
    생성일: nowISO(),
    수정일: nowISO()
  };
  db.opportunities.push(opp);
  createMockActivity(db, {
    opp_id: opp.opp_id,
    활동유형: '메모',
    활동내용: '목업에서 새 영업기회를 생성했습니다.',
    결과태그_JSON: opp.태그_JSON
  });
  return { ...opp, 학교: school, 부서: dept, 담당자들: db.contacts.filter((contact) => contact.dept_id === dept.dept_id) };
}

function changeMockStage(db, payload = {}) {
  const oppId = payload.opp_id || payload.id;
  const newStage = payload.새단계 || payload.stage || payload.현재단계;
  const opp = db.opportunities.find((item) => item.opp_id === oppId);
  if (!opp) throw new Error('영업기회를 찾을 수 없습니다.');
  if (!newStage) throw new Error('새 단계를 입력해주세요.');
  const previousStage = opp.현재단계;
  const history = parseJSON(opp.단계변경이력_JSON, []);
  history.push({
    이전단계: previousStage,
    새단계: newStage,
    변경일: nowISO(),
    사유: payload.사유 || ''
  });
  opp.이전단계 = previousStage;
  opp.현재단계 = newStage;
  opp.단계진입일 = nowISO();
  opp.단계변경이력_JSON = JSON.stringify(history);
  opp.마지막활동일 = todayString();
  opp.수정일 = nowISO();
  createMockActivity(db, {
    opp_id: opp.opp_id,
    활동유형: '단계변경',
    활동내용: `${previousStage}에서 ${newStage}로 단계 변경${payload.사유 ? `: ${payload.사유}` : ''}`,
    결과태그_JSON: '[]'
  });
  return opp;
}


function updateMockOpportunity(db, payload = {}) {
  const opp = db.opportunities.find((item) => item.opp_id === (payload.opp_id || payload.id));
  if (!opp) throw new Error('영업기회를 찾을 수 없습니다.');
  Object.entries(payload).forEach(([key, value]) => {
    if (['opp_id', 'id'].includes(key)) return;
    opp[key] = value;
  });
  opp.우선순위_자동점수 = calculatePriorityScore(opp);
  if (opp.우선순위_수동오버라이드 !== 'Y') opp.우선순위 = priorityFromScore(opp.우선순위_자동점수);
  opp.수정일 = nowISO();
  return enrichStagnation(opp);
}

function deleteMockOpportunity(db, payload = {}) {
  const oppId = payload.opp_id || payload.id || payload;
  const before = db.opportunities.length;
  db.opportunities = db.opportunities.filter((item) => item.opp_id !== oppId);
  db.activities = db.activities.filter((item) => item.opp_id !== oppId);
  return { deleted: before - db.opportunities.length };
}

function addMockTags(db, payload = {}) {
  const opp = db.opportunities.find((item) => item.opp_id === (payload.opp_id || payload.id));
  if (!opp) throw new Error('영업기회를 찾을 수 없습니다.');
  const current = new Set(parseJSON(opp.태그_JSON, []));
  normalizeArray(payload.태그배열 || payload.tags || payload.태그).forEach((tag) => current.add(tag));
  opp.태그_JSON = JSON.stringify(Array.from(current));
  opp.수정일 = nowISO();
  return opp;
}

function removeMockTags(db, payload = {}) {
  const opp = db.opportunities.find((item) => item.opp_id === (payload.opp_id || payload.id));
  if (!opp) throw new Error('영업기회를 찾을 수 없습니다.');
  const removeSet = new Set(normalizeArray(payload.태그배열 || payload.tags || payload.태그));
  opp.태그_JSON = JSON.stringify(parseJSON(opp.태그_JSON, []).filter((tag) => !removeSet.has(tag)));
  opp.수정일 = nowISO();
  return opp;
}

function createMockActivity(db, payload = {}) {
  const activity = {
    activity_id: nextId(db.activities, 'activity_id', 'A', 8),
    opp_id: payload.opp_id,
    활동일시: payload.활동일시 || nowISO(),
    활동유형: payload.활동유형 || '메모',
    결과태그_JSON: payload.결과태그_JSON || '[]',
    활동내용: payload.활동내용 || '',
    다음액션: payload.다음액션 || '',
    다음액션일: payload.다음액션일 || '',
    첨부URL: payload.첨부URL || '',
    음성메모URL: payload.음성메모URL || '',
    생성일: nowISO()
  };
  db.activities.push(activity);
  const opp = db.opportunities.find((item) => item.opp_id === payload.opp_id);
  if (opp) {
    opp.마지막활동일 = todayString();
    opp.수정일 = nowISO();
    if (payload.다음액션 || payload.다음액션일) {
      opp.다음액션 = payload.다음액션 || opp.다음액션;
      opp.다음액션일 = payload.다음액션일 || opp.다음액션일;
    }
  }
  return activity;
}


function updateMockActivity(db, payload = {}) {
  const activity = db.activities.find((item) => item.activity_id === (payload.activity_id || payload.id));
  if (!activity) throw new Error('활동 로그를 찾을 수 없습니다.');
  Object.entries(payload).forEach(([key, value]) => {
    if (['activity_id', 'id'].includes(key)) return;
    activity[key] = value;
  });
  const opp = db.opportunities.find((item) => item.opp_id === activity.opp_id);
  if (opp) {
    opp.마지막활동일 = todayString();
    if (activity.다음액션 || activity.다음액션일) {
      opp.다음액션 = activity.다음액션 || opp.다음액션;
      opp.다음액션일 = activity.다음액션일 || opp.다음액션일;
    }
    opp.수정일 = nowISO();
  }
  return activity;
}

function deleteMockActivity(db, payload = {}) {
  const activityId = payload.activity_id || payload.id || payload;
  const before = db.activities.length;
  db.activities = db.activities.filter((item) => item.activity_id !== activityId);
  return { deleted: before - db.activities.length };
}

function calculatePriorityScore(opp) {
  let score = 0;
  score += ({ 확정: 3, 추정: 2, 없음: 0, 모름: 1 }[opp.BANT_예산상태] || 0);
  score += ({ 결정권자: 3, 영향력있음: 2, 단순담당: 1, 모름: 0 }[opp.BANT_권한] || 0);
  score += opp.BANT_니즈키워드 ? Math.min(3, String(opp.BANT_니즈키워드).split(',').map((item) => item.trim()).filter(Boolean).length) : 0;
  score += opp.BANT_시점 ? 3 : 0;
  score += opp.MEDDIC_챔피언_contactid ? 2 : 0;
  return score;
}

function priorityFromScore(score) {
  if (score >= 12) return 'S';
  if (score >= 9) return 'A';
  if (score >= 5) return 'B';
  return 'C';
}

function nextId(list, key, prefix, length) {
  const max = list.reduce((acc, item) => {
    const raw = String(item[key] || '').replace(prefix, '');
    const num = Number(raw);
    return Number.isFinite(num) ? Math.max(acc, num) : acc;
  }, 0);
  return `${prefix}${String(max + 1).padStart(length, '0')}`;
}

function nowISO() {
  return new Date().toISOString();
}

function todayString() {
  return nowISO().slice(0, 10);
}

function buildSummary(db) {
  const schoolsById = Object.fromEntries(db.schools.map((item) => [item.school_id, item]));
  const departmentsById = Object.fromEntries(db.departments.map((item) => [item.dept_id, item]));
  const opps = db.opportunities.map((opp) => enrichStagnation({
    ...opp,
    학교: schoolsById[opp.school_id] || null,
    부서: departmentsById[opp.dept_id] || null,
    담당자들: db.contacts.filter((contact) => contact.dept_id === opp.dept_id)
  }));
  const countBy = (list, key) => list.reduce((acc, item) => {
    const value = item[key] || '미지정';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
  const tagCounts = {};
  opps.forEach((opp) => parseJSON(opp.태그_JSON, []).forEach((tag) => {
    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  }));

  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return {
    단계별카운트: countBy(opps, '현재단계'),
    우선순위별카운트: countBy(opps, '우선순위'),
    태그별카운트: tagCounts,
    이번주_다음액션: opps.filter((opp) => {
      if (!opp.다음액션일) return false;
      const date = new Date(opp.다음액션일);
      return date <= weekEnd;
    }).slice(0, 20),
    정체알림: opps.filter((opp) => opp.정체여부).sort((a, b) => Number(b.정체일수 || 0) - Number(a.정체일수 || 0)).slice(0, 20),
    이번달_신규리드수: opps.filter((opp) => String(opp.생성일).startsWith(monthPrefix)).length,
    이번달_EVD완료수: opps.filter((opp) => opp.현재단계 === 'EVD완료' && String(opp.수정일).startsWith(monthPrefix)).length,
    이번달_계약완료수: opps.filter((opp) => opp.현재단계 === '계약완료' && String(opp.수정일).startsWith(monthPrefix)).length,
    활성파이프라인_총예상금액: opps.filter((opp) => !['계약완료', '드랍'].includes(opp.현재단계)).reduce((sum, opp) => sum + Number(opp.예상금액 || 0), 0),
    전환율_TM_to_EVD: 0.42,
    전환율_EVD_to_제안: 0.56,
    전환율_제안_to_계약: 0.31
  };
}

function importMockCSV(db, payload = {}) {
  const csvText = String(payload.csvText || '');
  const mapping = payload.mapping || {};
  const rows = parseMockCSV(csvText);
  if (!rows.length) return { success: 0, failed: 0, errors: [] };
  const headers = rows[0];
  const records = rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ''])));
  let success = 0;
  const errors = [];
  records.forEach((record, index) => {
    try {
      const get = (field) => record[mapping[field] || field] || '';
      const schoolName = get('학교명');
      if (!schoolName) throw new Error('학교명 누락');
      const city = get('지역_시') || '경기도';
      const district = get('지역_구') || '지역미정';
      let school = db.schools.find((item) => item.학교명 === schoolName && item.지역_시 === city && item.지역_구 === district);
      if (!school) {
        school = {
          school_id: nextId(db.schools, 'school_id', 'S', 6),
          학교명: schoolName,
          지역_시: city,
          지역_구: district,
          학교유형: get('학교유형') || '고등학교',
          사업자번호: '',
          대표주소: get('대표주소') || '',
          대표전화: get('대표전화') || '',
          학교홈페이지: '',
          사업카테고리: get('사업카테고리') || '일반',
          학교메모: get('메모') || '임포트로 생성된 학교입니다.',
          생성일: nowISO(),
          수정일: nowISO()
        };
        db.schools.push(school);
      }
      const deptName = get('부서명') || '부서 미지정';
      let dept = db.departments.find((item) => item.school_id === school.school_id && item.부서명 === deptName);
      if (!dept) {
        dept = { dept_id: nextId(db.departments, 'dept_id', 'D', 6), school_id: school.school_id, 부서명: deptName, 부서메모: '', 생성일: nowISO() };
        db.departments.push(dept);
      }
      const contactName = get('담당자명');
      if (contactName && !db.contacts.some((item) => item.dept_id === dept.dept_id && item.이름 === contactName)) {
        db.contacts.push({
          contact_id: nextId(db.contacts, 'contact_id', 'C', 6),
          school_id: school.school_id,
          dept_id: dept.dept_id,
          이름: contactName,
          직책: get('직책') || '교사',
          휴대폰: get('휴대폰') || '',
          사무실전화: get('사무실전화') || school.대표전화 || '',
          이메일: get('이메일') || '',
          관계강도: get('관계강도') || '약',
          챔피언여부: get('챔피언여부') || 'N',
          담당자메모: get('메모') || '',
          생성일: nowISO(),
          수정일: nowISO()
        });
      }
      const program = get('관심프로그램') || '기타 커스텀';
      db.opportunities.push({
        opp_id: nextId(db.opportunities, 'opp_id', 'O', 6),
        school_id: school.school_id,
        dept_id: dept.dept_id,
        기회제목: `${school.학교명}-${dept.부서명}-${program}`,
        현재단계: payload.options?.defaultStage || '리드',
        단계진입일: nowISO(),
        이전단계: '',
        단계변경이력_JSON: '[]',
        관심프로그램: program,
        우선순위: get('우선순위') || 'C',
        우선순위_자동점수: 0,
        우선순위_수동오버라이드: get('우선순위') ? 'Y' : 'N',
        예상계약일: '',
        예상금액: Number(get('예상금액') || 0),
        실계약일: '',
        실계약금액: '',
        태그_JSON: '[]',
        BANT_예산상태: '모름',
        BANT_예산금액: '',
        BANT_권한: '모름',
        BANT_니즈키워드: '',
        BANT_니즈상세: '',
        BANT_시점: '',
        MEDDIC_메트릭: '',
        MEDDIC_이코노믹바이어_contactid: '',
        MEDDIC_결정프로세스: '',
        MEDDIC_페인: '',
        MEDDIC_챔피언_contactid: '',
        MEDDIC_경쟁사: '',
        사업신청유형: '',
        사업신청상태: '',
        마지막활동일: todayString(),
        다음액션: get('다음액션') || '',
        다음액션일: get('다음액션일') || '',
        다음액션담당자_contactid: '',
        정체일수_캐시: 0,
        기회메모: get('메모') || '임포트로 생성된 기회입니다.',
        생성일: nowISO(),
        수정일: nowISO()
      });
      success += 1;
    } catch (error) {
      errors.push({ row: index + 2, error: error.message });
    }
  });
  return { success, failed: errors.length, errors };
}

function parseMockCSV(text) {
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
  return rows;
}

function globalSearch(db, term) {
  const keyword = String(term || '').trim();
  if (!keyword) return { schools: [], opps: [], contacts: [] };
  const departmentsById = Object.fromEntries(db.departments.map((item) => [item.dept_id, item]));
  const schoolsById = Object.fromEntries(db.schools.map((item) => [item.school_id, item]));
  return {
    schools: db.schools.filter((item) => [item.학교명, item.지역_시, item.지역_구, item.학교메모].join(' ').includes(keyword)).slice(0, 8),
    opps: db.opportunities.filter((item) => [item.기회제목, item.기회메모, schoolsById[item.school_id]?.학교명, departmentsById[item.dept_id]?.부서명].join(' ').includes(keyword)).slice(0, 8),
    contacts: db.contacts.filter((item) => [item.이름, item.직책, item.이메일, item.담당자메모, schoolsById[item.school_id]?.학교명, departmentsById[item.dept_id]?.부서명].join(' ').includes(keyword)).slice(0, 8)
  };
}

function listTags(opps) {
  const counts = {};
  opps.forEach((opp) => parseJSON(opp.태그_JSON, []).forEach((tag) => {
    counts[tag] = (counts[tag] || 0) + 1;
  }));
  return Object.entries(counts).map(([태그, 사용횟수]) => ({ 태그, 사용횟수 })).sort((a, b) => b.사용횟수 - a.사용횟수);
}

function enrichStagnation(opp) {
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
  const entered = new Date(opp.단계진입일 || opp.생성일 || Date.now());
  const today = new Date();
  const diff = Math.max(0, Math.floor((today - entered) / (24 * 60 * 60 * 1000)));
  const limit = thresholds[opp.현재단계] ?? 0;
  return {
    ...opp,
    정체일수: diff,
    정체임계치: limit,
    정체여부: limit > 0 && diff >= limit
  };
}


function buildDefaultSettings() {
  return {
    stageThresholds: {
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
    },
    wipLimits: {
      '리드': 50,
      'TM시도': 20,
      '자료발송': 15,
      'EVD예정': 8,
      'EVD완료': 5,
      '제안서발송': 10,
      '계약검토': 8,
      '계약완료': 0
    },
    customTags: [
      { name: '부재중-재콜필요', category: '경고' },
      { name: '이메일요청', category: '정보' },
      { name: '관심있음-EVD예정', category: '긍정' }
    ],
    priorityWeights: {
      '예산상태': 3,
      '권한': 3,
      '니즈키워드': 3,
      '시점': 3,
      '챔피언': 2
    },
    notifications: {
      email: { enabled: true, to: 'hwangmh8861@gmail.com', time: '08:00' },
      types: ['오늘 다음액션', '정체 알림', '이번주 EVD 예정', '어제 활동 요약']
    }
  };
}

function getMockSettings(db) {
  return {
    ...db.settings,
    backups: db.backups.map((item) => ({ name: item.name, createdAt: item.createdAt })).slice(-10).reverse(),
    migrationLogs: db.migrationLogs.slice(-20).reverse()
  };
}

function saveMockSettings(db, payload = {}) {
  db.settings = {
    ...db.settings,
    ...payload,
    stageThresholds: { ...db.settings.stageThresholds, ...(payload.stageThresholds || {}) },
    wipLimits: { ...db.settings.wipLimits, ...(payload.wipLimits || {}) },
    priorityWeights: { ...db.settings.priorityWeights, ...(payload.priorityWeights || {}) },
    notifications: { ...db.settings.notifications, ...(payload.notifications || {}) }
  };
  return getMockSettings(db);
}

function previewMockMigration(db, payload = {}) {
  const rows = payload.rows && payload.rows.length ? payload.rows : buildLegacyRows(20);
  return { previewRows: rows.slice(0, 20), sheetNames: payload.sheetNames || ['김포', '파주', '부천', '안산', '고양'] };
}

function dryRunMockMigration(db, payload = {}) {
  const rows = payload.rows && payload.rows.length ? payload.rows : buildLegacyRows(100);
  const mapping = payload.mapping || {};
  const schoolKeys = new Set(db.schools.map((school) => `${school.학교명}|${school.지역_시}|${school.지역_구}`));
  const nextSchools = new Set();
  const departments = new Set();
  const contacts = new Set();
  const warnings = [];
  let duplicates = 0;

  rows.forEach((row, index) => {
    const schoolName = valueByMapping(row, mapping, '학교명');
    const city = valueByMapping(row, mapping, '지역_시') || '경기도';
    const district = valueByMapping(row, mapping, '지역_구') || parseDistrict(valueByMapping(row, mapping, '지역') || valueByMapping(row, mapping, '주소')) || '지역미정';
    const deptName = valueByMapping(row, mapping, '부서명') || '부서 미지정';
    const contactName = valueByMapping(row, mapping, '담당자명');
    if (!schoolName) warnings.push({ row: index + 2, message: '학교명 누락' });
    if (schoolName) {
      const key = `${schoolName}|${city}|${district}`;
      if (schoolKeys.has(key) || nextSchools.has(key)) duplicates += 1;
      else nextSchools.add(key);
      departments.add(`${key}|${deptName}`);
      if (contactName) contacts.add(`${key}|${deptName}|${contactName}`);
    }
    const phone = valueByMapping(row, mapping, '휴대폰');
    if (phone && !/^[0-9\-\s]+$/.test(String(phone))) warnings.push({ row: index + 2, message: '전화번호 형식 확인 필요' });
  });

  return {
    totalRows: rows.length,
    newSchools: nextSchools.size,
    duplicates,
    warnings,
    summary: {
      schools: nextSchools.size,
      departments: departments.size,
      contacts: contacts.size,
      opportunities: rows.length - warnings.filter((item) => item.message === '학교명 누락').length
    }
  };
}

function executeMockMigration(db, payload = {}) {
  const rows = payload.rows && payload.rows.length ? payload.rows : buildLegacyRows(100);
  const mapping = payload.mapping || {};
  const migrationId = `M${Date.now()}`;
  const createdIds = { schools: [], departments: [], contacts: [], opportunities: [] };
  let success = 0;
  const errors = [];

  rows.forEach((row, index) => {
    try {
      const schoolName = valueByMapping(row, mapping, '학교명');
      if (!schoolName) throw new Error('학교명 누락');
      const city = valueByMapping(row, mapping, '지역_시') || '경기도';
      const district = valueByMapping(row, mapping, '지역_구') || parseDistrict(valueByMapping(row, mapping, '지역') || valueByMapping(row, mapping, '주소')) || '지역미정';
      let school = db.schools.find((item) => item.학교명 === schoolName && item.지역_시 === city && item.지역_구 === district);
      if (!school) {
        school = {
          school_id: nextId(db.schools, 'school_id', 'S', 6),
          학교명: schoolName,
          지역_시: city,
          지역_구: district,
          학교유형: valueByMapping(row, mapping, '학교유형') || '고등학교',
          사업자번호: '',
          대표주소: valueByMapping(row, mapping, '주소') || '',
          대표전화: valueByMapping(row, mapping, '대표전화') || '',
          학교홈페이지: '',
          사업카테고리: valueByMapping(row, mapping, '사업카테고리') || '일반',
          학교메모: '기존 CRM 마이그레이션으로 생성',
          생성일: nowISO(),
          수정일: nowISO(),
          migrationId
        };
        db.schools.push(school);
        createdIds.schools.push(school.school_id);
      }
      const deptName = valueByMapping(row, mapping, '부서명') || '부서 미지정';
      let dept = db.departments.find((item) => item.school_id === school.school_id && item.부서명 === deptName);
      if (!dept) {
        dept = { dept_id: nextId(db.departments, 'dept_id', 'D', 6), school_id: school.school_id, 부서명: deptName, 부서메모: '기존 CRM 마이그레이션으로 생성', 생성일: nowISO(), migrationId };
        db.departments.push(dept);
        createdIds.departments.push(dept.dept_id);
      }
      const contactName = valueByMapping(row, mapping, '담당자명');
      if (contactName && !db.contacts.some((item) => item.dept_id === dept.dept_id && item.이름 === contactName)) {
        const contact = {
          contact_id: nextId(db.contacts, 'contact_id', 'C', 6),
          school_id: school.school_id,
          dept_id: dept.dept_id,
          이름: contactName,
          직책: valueByMapping(row, mapping, '직책') || '교사',
          휴대폰: valueByMapping(row, mapping, '휴대폰') || '',
          사무실전화: valueByMapping(row, mapping, '사무실전화') || school.대표전화 || '',
          이메일: valueByMapping(row, mapping, '이메일') || '',
          관계강도: valueByMapping(row, mapping, '관계강도') || '약',
          챔피언여부: 'N',
          담당자메모: valueByMapping(row, mapping, '메모') || '',
          생성일: nowISO(),
          수정일: nowISO(),
          migrationId
        };
        db.contacts.push(contact);
        createdIds.contacts.push(contact.contact_id);
      }
      const program = valueByMapping(row, mapping, '관심프로그램') || '기타 커스텀';
      const priority = valueByMapping(row, mapping, '우선순위') || 'C';
      const opp = {
        opp_id: nextId(db.opportunities, 'opp_id', 'O', 6),
        school_id: school.school_id,
        dept_id: dept.dept_id,
        기회제목: `${school.학교명}-${dept.부서명}-${program}`,
        현재단계: valueByMapping(row, mapping, '현재단계') || '리드',
        단계진입일: nowISO(),
        이전단계: '',
        단계변경이력_JSON: '[]',
        관심프로그램: program,
        우선순위: priority,
        우선순위_자동점수: 0,
        우선순위_수동오버라이드: priority ? 'Y' : 'N',
        예상계약일: '',
        예상금액: Number(valueByMapping(row, mapping, '예상금액') || 0),
        실계약일: '',
        실계약금액: '',
        태그_JSON: '[]',
        BANT_예산상태: '모름',
        BANT_예산금액: '',
        BANT_권한: '모름',
        BANT_니즈키워드: '',
        BANT_니즈상세: '',
        BANT_시점: '',
        MEDDIC_메트릭: '',
        MEDDIC_이코노믹바이어_contactid: '',
        MEDDIC_결정프로세스: '',
        MEDDIC_페인: '',
        MEDDIC_챔피언_contactid: '',
        MEDDIC_경쟁사: '',
        사업신청유형: '',
        사업신청상태: '',
        마지막활동일: todayString(),
        다음액션: '',
        다음액션일: '',
        다음액션담당자_contactid: '',
        정체일수_캐시: 0,
        기회메모: valueByMapping(row, mapping, '메모') || '기존 CRM 마이그레이션으로 생성',
        생성일: nowISO(),
        수정일: nowISO(),
        migrationId
      };
      db.opportunities.push(opp);
      createdIds.opportunities.push(opp.opp_id);
      success += 1;
    } catch (error) {
      errors.push({ row: index + 2, error: error.message });
    }
  });

  db.migrationLogs.push({
    migrationId,
    실행일시: nowISO(),
    상태: '완료',
    요약: `성공 ${success}건, 실패 ${errors.length}건`,
    createdIds
  });

  return {
    migrationId,
    success,
    failed: errors.length,
    errors,
    created: {
      schools: createdIds.schools.length,
      departments: createdIds.departments.length,
      contacts: createdIds.contacts.length,
      opportunities: createdIds.opportunities.length
    }
  };
}

function rollbackMockMigration(db, payload = {}) {
  const migrationId = payload.migrationId;
  const log = db.migrationLogs.find((item) => item.migrationId === migrationId);
  if (!log) throw new Error('롤백할 마이그레이션 로그를 찾을 수 없습니다.');
  const ids = log.createdIds || {};
  const before = db.schools.length + db.departments.length + db.contacts.length + db.opportunities.length;
  db.activities = db.activities.filter((item) => !(ids.opportunities || []).includes(item.opp_id));
  db.opportunities = db.opportunities.filter((item) => !(ids.opportunities || []).includes(item.opp_id));
  db.contacts = db.contacts.filter((item) => !(ids.contacts || []).includes(item.contact_id));
  db.departments = db.departments.filter((item) => !(ids.departments || []).includes(item.dept_id));
  db.schools = db.schools.filter((item) => !(ids.schools || []).includes(item.school_id));
  const after = db.schools.length + db.departments.length + db.contacts.length + db.opportunities.length;
  log.상태 = '롤백완료';
  return { deleted: before - after, migrationId };
}

function buildLegacyRows(count = 100) {
  const districts = ['김포시', '파주시', '부천시', '안산시', '고양시'];
  const programs = ['흑백창업가', '필터버블 탈출', 'Re_Brain / 팝콘브레인', 'MDC + 진로빅데이터', '캡스톤 디자인'];
  return Array.from({ length: count }, (_, index) => ({
    학교명: `${districts[index % districts.length].replace('시', '')}기존${String(index + 1).padStart(3, '0')}고`,
    지역_시: '경기도',
    지역_구: districts[index % districts.length],
    학교유형: index % 4 === 0 ? '특성화고' : '고등학교',
    부서명: ['진로부', '창체부', '정보부'][index % 3],
    담당자명: `이관담당${index + 1}`,
    휴대폰: `010-${1000 + index}-${2000 + index}`,
    이메일: `legacy${index + 1}@school.kr`,
    관심프로그램: programs[index % programs.length],
    우선순위: ['S', 'A', 'B', 'C'][index % 4],
    메모: '기존 통합 CRM에서 이관'
  }));
}

function valueByMapping(row, mapping, field) {
  const key = mapping[field] || field;
  return row[key] ?? '';
}

function parseDistrict(value = '') {
  const match = String(value).match(/([가-힣]+시|[가-힣]+구|[가-힣]+군)/);
  return match ? match[1] : '';
}

function createMockBackup(db) {
  const name = `Backup_${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`;
  const snapshot = JSON.parse(JSON.stringify({ schools: db.schools, departments: db.departments, contacts: db.contacts, opportunities: db.opportunities, activities: db.activities }));
  const backup = { name, createdAt: nowISO(), snapshot };
  db.backups.push(backup);
  db.backups = db.backups.slice(-30);
  return { name, createdAt: backup.createdAt };
}

function previewMockRestore(payload = {}) {
  const data = payload.data || {};
  return {
    counts: {
      schools: (data.schools || []).length,
      departments: (data.departments || []).length,
      contacts: (data.contacts || []).length,
      opportunities: (data.opportunities || []).length,
      activities: (data.activities || []).length
    }
  };
}

function executeMockRestore(db, payload = {}) {
  const data = payload.data || {};
  db.schools = data.schools || [];
  db.departments = data.departments || [];
  db.contacts = data.contacts || [];
  db.opportunities = data.opportunities || [];
  db.activities = data.activities || [];
  return { restored: true, ...previewMockRestore(payload) };
}

function resetMockAll(db, payload = {}) {
  if (!payload.password && !window.__USE_MOCK) throw new Error('비밀번호 재확인이 필요합니다.');
  db.schools = [];
  db.departments = [];
  db.contacts = [];
  db.opportunities = [];
  db.activities = [];
  return { reset: true };
}

function buildMockNotification(db, payload = {}) {
  const summary = buildSummary(db);
  return {
    sent: true,
    mock: Boolean(payload.mock),
    to: db.settings.notifications.email.to,
    subject: '[학교영업CRM] 오늘의 영업 알림',
    counts: {
      actions: summary.이번주_다음액션.length,
      stale: summary.정체알림.length
    }
  };
}

function buildMockReport(reportId, month) {
  return {
    report_id: reportId,
    제목: `${month} 월간 영업 리포트`,
    기간: month,
    생성일: nowISO(),
    html: `<h2>${month} 월간 영업 리포트</h2><p>단계별 카드수 변화, 전환율, 관심프로그램별 성과, 정체 학교 TOP 10을 요약한 샘플 리포트입니다.</p><ul><li>신규 리드 23건</li><li>EVD 완료 8건</li><li>계약 완료 2건</li><li>활성 파이프라인 4,200만원</li></ul>`
  };
}

function getMockReport(db, payload = {}) {
  const report = db.reports.find((item) => item.report_id === (payload.report_id || payload.id));
  if (!report) throw new Error('리포트를 찾을 수 없습니다.');
  return report;
}

function generateMockReport(db, payload = {}) {
  const month = payload.month || new Date().toISOString().slice(0, 7);
  const reportId = `R${month.replace('-', '')}_${Date.now()}`;
  const summary = buildSummary(db);
  const report = {
    report_id: reportId,
    제목: `${month} 월간 영업 리포트`,
    기간: month,
    생성일: nowISO(),
    html: `<h2>${month} 월간 영업 리포트</h2>
      <h3>핵심 요약</h3>
      <ul>
        <li>신규 리드 ${summary.이번달_신규리드수}건</li>
        <li>EVD 완료 ${summary.이번달_EVD완료수}건</li>
        <li>계약 완료 ${summary.이번달_계약완료수}건</li>
        <li>활성 파이프라인 ${Number(summary.활성파이프라인_총예상금액 || 0).toLocaleString('ko-KR')}원</li>
      </ul>
      <h3>전환율</h3>
      <p>TM→EVD ${Math.round(summary.전환율_TM_to_EVD * 100)}%, EVD→제안 ${Math.round(summary.전환율_EVD_to_제안 * 100)}%, 제안→계약 ${Math.round(summary.전환율_제안_to_계약 * 100)}%</p>`
  };
  db.reports.push(report);
  return report;
}

function normalizeArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}
