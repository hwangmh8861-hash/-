import { callAPI } from '../api.js';
import { $, escapeHTML } from '../utils.js';
import { toast } from '../components/toast.js';

let settings = null;
let activeTab = '기본';

const tabs = ['기본','정체·WIP','태그','우선순위','알림','백업·복원','마이그레이션','위험 작업'];

export async function render(target) {
  if (location.hash === '#/settings/notifications') activeTab = '알림';
  settings = await callAPI('settings.get');
  target.innerHTML = renderShell();
  bindEvents(target);
}

function renderShell() {
  return `
    <section class="page-head">
      <div>
        <h1 class="page-title">설정</h1>
        <p class="page-desc">단일 사용자 운영 기준, 알림, 백업, 마이그레이션 로그를 관리합니다.</p>
      </div>
      <button id="save-settings" class="primary-button" type="button">설정 저장</button>
    </section>
    <div class="settings-tabs">
      ${tabs.map((tab) => `<button class="settings-tab ${tab === activeTab ? 'is-active' : ''}" type="button" data-tab="${tab}">${tab}</button>`).join('')}
    </div>
    <section class="ops-card">${renderTab()}</section>
  `;
}

function renderTab() {
  const data = settings || {};
  if (activeTab === '기본') return `
    <h2>기본 설정</h2>
    <div class="setting-row"><strong>비밀번호 변경</strong><input id="new-password" class="input" type="password" placeholder="새 비밀번호" /></div>
    <div class="setting-row"><strong>화면 테마</strong><select id="theme-mode" class="select"><option value="system">시스템</option><option value="light" ${localStorage.getItem('crm_theme') === 'light' ? 'selected' : ''}>라이트</option><option value="dark" ${localStorage.getItem('crm_theme') === 'dark' ? 'selected' : ''}>다크</option></select></div>
    <div class="setting-row"><strong>GAS Web App URL</strong><input id="gas-url" class="input" value="${escapeHTML(localStorage.getItem('crm_gas_url') || '')}" placeholder="https://script.google.com/macros/s/.../exec" /></div>
  `;
  if (activeTab === '정체·WIP') return `
    <h2>단계별 정체 임계치와 WIP 한도</h2>
    ${Object.keys(data.stageThresholds || {}).map((stage) => `
      <div class="setting-row">
        <strong>${stage}</strong>
        <div class="ops-grid two">
          <input class="input threshold-input" data-stage="${stage}" type="number" min="0" value="${data.stageThresholds[stage]}" placeholder="정체 임계치" />
          <input class="input wip-input" data-stage="${stage}" type="number" min="0" value="${data.wipLimits?.[stage] ?? ''}" placeholder="WIP 한도" />
        </div>
      </div>
    `).join('')}
  `;
  if (activeTab === '태그') return `
    <h2>사용자 정의 태그</h2>
    <div class="ops-toolbar">
      <input id="new-tag" class="input" placeholder="새 태그명" />
      <select id="new-tag-category" class="select"><option value="부정">부정</option><option value="경고">경고</option><option value="중립">중립</option><option value="정보">정보</option><option value="긍정">긍정</option></select>
      <button id="add-tag" class="ghost-button" type="button">태그 추가</button>
    </div>
    <div class="validation-list">
      ${(data.customTags || []).map((tag, index) => `<div class="validation-item"><span>${escapeHTML(tag.name)} · ${escapeHTML(tag.category)}</span><button class="ghost-button" type="button" data-delete-tag="${index}">삭제</button></div>`).join('') || '<p>등록된 사용자 태그가 없습니다.</p>'}
    </div>
  `;
  if (activeTab === '우선순위') return `
    <h2>우선순위 자동 산정 가중치</h2>
    ${Object.entries(data.priorityWeights || {}).map(([key, value]) => `
      <div class="setting-row"><strong>${key}</strong><input class="input priority-weight" data-key="${key}" type="number" min="0" step="1" value="${value}" /></div>
    `).join('')}
    <p>수동오버라이드가 켜진 기회는 자동 산정을 적용하지 않습니다.</p>
  `;
  if (activeTab === '알림') return `
    <h2>알림 설정</h2>
    <div class="setting-row"><strong>이메일 알림</strong><label><input id="email-enabled" type="checkbox" ${data.notifications?.email?.enabled ? 'checked' : ''} /> 매일 요약 받기</label></div>
    <div class="setting-row"><strong>받는 이메일</strong><input id="email-to" class="input" value="${escapeHTML(data.notifications?.email?.to || '')}" placeholder="hwangmh8861@gmail.com" /></div>
    <div class="setting-row"><strong>발송 시간</strong><input id="email-time" class="input" type="time" value="${escapeHTML(data.notifications?.email?.time || '08:00')}" /></div>
    <div class="setting-row"><strong>알림 종류</strong><div class="badge-row">${['오늘 다음액션','정체 알림','이번주 EVD 예정','어제 활동 요약'].map((label) => `<label class="badge badge-soft" style="--badge-color:var(--tag-info)"><input class="notice-type" type="checkbox" value="${label}" ${data.notifications?.types?.includes(label) ? 'checked' : ''} /> ${label}</label>`).join('')}</div></div>
    <div class="setting-row"><strong>선택 채널</strong><p>카카오워크·슬랙·PWA 푸시는 별도 키 입력 후 활성화합니다. 현재 산출물은 설정 자리와 GAS 확장 포인트를 포함합니다.</p></div>
    <button id="send-test-email" class="ghost-button" type="button">테스트 이메일 발송</button>
  `;
  if (activeTab === '백업·복원') return `
    <h2>백업·복원</h2>
    <div class="ops-toolbar">
      <button id="manual-backup" class="primary-button" type="button">지금 백업 생성</button>
      <button id="download-json" class="ghost-button" type="button">전체 데이터 JSON 다운로드</button>
    </div>
    <div class="setting-row"><strong>JSON 복원</strong><input id="restore-json" class="input" type="file" accept="application/json,.json" /></div>
    <div id="restore-preview" class="ops-card" hidden></div>
    <h3>최근 백업</h3>
    <div class="validation-list">${(data.backups || []).map((item) => `<div class="validation-item"><span>${escapeHTML(item.name)} · ${escapeHTML(item.createdAt)}</span><button class="ghost-button" type="button" data-restore-backup="${escapeHTML(item.name)}">복원</button></div>`).join('') || '<p>아직 백업이 없습니다.</p>'}</div>
  `;
  if (activeTab === '마이그레이션') return `
    <h2>마이그레이션 로그</h2>
    <div class="ops-toolbar"><a class="primary-button" href="#/migrate">마이그레이션 실행</a></div>
    <div class="validation-list">${(data.migrationLogs || []).map((log) => `<div class="validation-item"><span>${escapeHTML(log.실행일시)} · ${escapeHTML(log.상태)} · ${escapeHTML(log.요약)}</span><small>${escapeHTML(log.migrationId)}</small></div>`).join('') || '<p>마이그레이션 로그가 없습니다.</p>'}</div>
  `;
  return `
    <h2>위험 작업</h2>
    <div class="ops-card danger-zone">
      <h3>데이터 전체 초기화</h3>
      <p>Schools, Departments, Contacts, Opportunities, Activities 데이터를 모두 삭제합니다. 실행 전 JSON 백업을 먼저 권장합니다.</p>
      <div class="form-row"><label for="reset-password">비밀번호 재확인</label><input id="reset-password" class="input" type="password" /></div>
      <button id="reset-all" class="ghost-button" type="button">전체 초기화</button>
    </div>
  `;
}

function bindEvents(target) {
  target.addEventListener('click', async (event) => {
    const tab = event.target.closest('[data-tab]');
    if (tab) {
      activeTab = tab.dataset.tab;
      return render(target);
    }
    if (event.target.id === 'save-settings') await saveSettings(target);
    if (event.target.id === 'add-tag') addTag(target);
    if (event.target.dataset.deleteTag) deleteTag(Number(event.target.dataset.deleteTag), target);
    if (event.target.id === 'manual-backup') await manualBackup(target);
    if (event.target.id === 'download-json') await downloadJSON();
    if (event.target.id === 'send-test-email') await sendTestEmail();
    if (event.target.id === 'reset-all') await resetAll(target);
  });

  target.addEventListener('change', async (event) => {
    if (event.target.id === 'restore-json') await previewRestore(event.target.files?.[0], target);
  });
}

async function saveSettings(target) {
  const next = JSON.parse(JSON.stringify(settings));
  if (activeTab === '기본') {
    const theme = $('#theme-mode', target)?.value || 'system';
    if (theme !== 'system') {
      localStorage.setItem('crm_theme', theme);
      document.documentElement.dataset.theme = theme;
    } else {
      localStorage.removeItem('crm_theme');
      document.documentElement.dataset.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    localStorage.setItem('crm_gas_url', $('#gas-url', target)?.value.trim() || '');
    const newPassword = $('#new-password', target)?.value.trim();
    if (newPassword) await callAPI('settings.changePassword', { newPassword });
  }
  target.querySelectorAll('.threshold-input').forEach((input) => { next.stageThresholds[input.dataset.stage] = Number(input.value || 0); });
  target.querySelectorAll('.wip-input').forEach((input) => { next.wipLimits[input.dataset.stage] = Number(input.value || 0); });
  target.querySelectorAll('.priority-weight').forEach((input) => { next.priorityWeights[input.dataset.key] = Number(input.value || 0); });
  if (activeTab === '알림') {
    next.notifications.email.enabled = $('#email-enabled', target)?.checked || false;
    next.notifications.email.to = $('#email-to', target)?.value.trim() || '';
    next.notifications.email.time = $('#email-time', target)?.value || '08:00';
    next.notifications.types = Array.from(target.querySelectorAll('.notice-type:checked')).map((input) => input.value);
  }
  settings = await callAPI('settings.save', next);
  toast('설정을 저장했습니다.');
  render(target);
}

function addTag(target) {
  const input = $('#new-tag', target);
  const category = $('#new-tag-category', target)?.value || '중립';
  const name = input?.value.trim();
  if (!name) return toast('태그명을 입력해주세요.', 'error');
  settings.customTags = settings.customTags || [];
  settings.customTags.push({ name, category });
  render(target);
}

function deleteTag(index, target) {
  settings.customTags.splice(index, 1);
  render(target);
}

async function manualBackup(target) {
  const result = await callAPI('backup.create');
  toast(`${result.name} 백업을 생성했습니다.`);
  settings = await callAPI('settings.get');
  render(target);
}

async function downloadJSON() {
  const data = await callAPI('export.all');
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `학교영업CRM_전체백업_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function previewRestore(file, target) {
  if (!file) return;
  const json = JSON.parse(await file.text());
  const result = await callAPI('restore.preview', { data: json });
  const box = $('#restore-preview', target);
  box.hidden = false;
  box.innerHTML = `
    <h3>복원 미리보기</h3>
    <p>Schools ${result.counts.schools}건 · Opportunities ${result.counts.opportunities}건 · Activities ${result.counts.activities}건</p>
    <div class="form-row"><label>비밀번호 재확인</label><input id="restore-password" class="input" type="password" /></div>
    <button id="execute-restore" class="primary-button" type="button">전체 데이터 덮어쓰기</button>
  `;
  $('#execute-restore', target)?.addEventListener('click', async () => {
    const password = $('#restore-password', target)?.value || '';
    await callAPI('restore.execute', { data: json, password });
    toast('복원을 완료했습니다.');
  });
}

async function sendTestEmail() {
  await callAPI('notifications.sendDaily', { mock: true });
  toast('테스트 이메일 발송 요청을 완료했습니다.');
}

async function resetAll(target) {
  if (!confirm('정말 전체 데이터를 초기화할까요?')) return;
  await callAPI('settings.resetAll', { password: $('#reset-password', target)?.value || '' });
  toast('전체 데이터를 초기화했습니다.');
}
