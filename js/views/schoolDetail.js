import { callAPI } from '../api.js';
import { escapeHTML, formatWon, parseJSON } from '../utils.js';
import { stageBadge, priorityBadge } from '../components/badge.js';
import { renderOppTabs } from '../components/oppTabs.js';
import { openModal, closeModal } from '../components/modal.js';
import { toast } from '../components/toast.js';

const PROGRAMS = ['흑백창업가', '필터버블 탈출', 'Re_Brain / 팝콘브레인', 'MDC + 진로빅데이터', '핑퐁로봇', '존중의숲', '습관추론게임', 'AI 리터러시 미니제안', '자기주도학습 비밀노트', '헤이븐월드 RPG', '캡스톤 디자인', '기타 커스텀'];
const STAGES = ['리드', 'TM시도', '자료발송', 'EVD예정', 'EVD완료', '제안서발송', '계약검토', '계약완료', '보류', '드랍'];

export async function render(target, params = {}) {
  const state = {
    schoolId: params.id || '',
    oppId: params.oppId || '',
    school: null,
    departments: [],
    contacts: [],
    opportunities: [],
    selectedOppId: params.oppId || '',
    selectedDeptId: '',
    selectedMode: 'opp'
  };

  async function load() {
    if (state.oppId && !state.schoolId) {
      const oppTree = await callAPI('opp.get', { opp_id: state.oppId });
      state.schoolId = oppTree.school_id;
      state.selectedOppId = oppTree.opp_id;
    }
    const tree = await callAPI('school.get', { school_id: state.schoolId });
    state.school = tree;
    state.departments = tree.부서들 || [];
    state.contacts = tree.담당자들 || [];
    state.opportunities = tree.기회들 || [];
    if (!state.selectedOppId && state.opportunities.length) state.selectedOppId = state.opportunities[0].opp_id;
    if (!state.selectedDeptId && state.departments.length) state.selectedDeptId = state.departments[0].dept_id;
  }

  async function refresh(keepHash = true) {
    await load();
    draw();
    if (keepHash && state.selectedOppId && location.hash.startsWith('#/opp/')) return;
  }

  function draw() {
    const activeOpps = state.opportunities.filter((opp) => !['계약완료', '드랍', '보류'].includes(opp.현재단계));
    target.innerHTML = `
      <section class="school-detail-page">
        <header class="school-detail-header">
          <div class="detail-header-main">
            <button class="back-button" type="button" id="back-button">← 뒤로</button>
            <div>
              <h1>${escapeHTML(state.school.학교명 || '학교 상세')}</h1>
              <p>${escapeHTML(state.school.학교유형 || '')} · ${escapeHTML(state.school.지역_시 || '')} ${escapeHTML(state.school.지역_구 || '')} · ${escapeHTML(state.school.사업카테고리 || '일반')}</p>
              <p class="header-counts">●${state.departments.length} 부서 · ●${state.contacts.length} 담당자 · ●${activeOpps.length} 활성기회 · 예상 ${formatWon(activeOpps.reduce((sum, opp) => sum + Number(opp.예상금액 || 0), 0))}</p>
            </div>
          </div>
          <div class="detail-header-actions">
            <button class="button ghost" type="button" id="edit-school">학교정보 편집</button>
            <button class="button primary" type="button" id="quick-new-opp">+ 새 기회</button>
            <button class="button ghost" type="button" id="add-dept">+ 부서 추가</button>
          </div>
        </header>
        <div class="detail-shell">
          <aside class="detail-tree-panel">
            ${renderTree()}
          </aside>
          <main class="detail-main-panel" id="detail-main-panel"></main>
        </div>
      </section>
    `;
    bindHeader();
    bindTree();
    renderMainPanel();
  }

  function renderTree() {
    const oppsByDept = state.opportunities.reduce((acc, opp) => {
      if (!acc[opp.dept_id]) acc[opp.dept_id] = [];
      acc[opp.dept_id].push(opp);
      return acc;
    }, {});
    return `
      <button class="tree-root" type="button" data-tree-school="true">🏫 ${escapeHTML(state.school.학교명 || '')}</button>
      <div class="tree-list">
        ${state.departments.map((dept) => {
          const deptOpps = oppsByDept[dept.dept_id] || [];
          return `
            <section class="tree-dept ${state.selectedDeptId === dept.dept_id && state.selectedMode === 'dept' ? 'is-selected' : ''}">
              <button class="tree-dept-button" type="button" data-dept-id="${escapeHTML(dept.dept_id)}">📁 ${escapeHTML(dept.부서명)} <span>${deptOpps.length} 기회</span></button>
              <div class="tree-opps">
                ${deptOpps.map((opp) => `
                  <button class="tree-opp ${state.selectedOppId === opp.opp_id ? 'is-selected' : ''}" type="button" data-opp-id="${escapeHTML(opp.opp_id)}">
                    <span>🎯 ${escapeHTML(primaryProgram(opp.관심프로그램))}</span>
                    <span class="tree-badges">${stageBadge(opp.현재단계)}${priorityBadge(opp.우선순위)}</span>
                  </button>
                `).join('')}
              </div>
            </section>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderMainPanel() {
    const panel = target.querySelector('#detail-main-panel');
    if (state.selectedMode === 'school') {
      renderSchoolEditPanel(panel);
      return;
    }
    if (state.selectedMode === 'dept') {
      const dept = state.departments.find((item) => item.dept_id === state.selectedDeptId);
      renderDeptEditPanel(panel, dept);
      return;
    }
    const opp = state.opportunities.find((item) => item.opp_id === state.selectedOppId);
    if (!opp) {
      panel.innerHTML = `<div class="empty-state">선택된 영업기회가 없습니다. 새 기회를 추가해 주세요.</div>`;
      return;
    }
    const dept = state.departments.find((item) => item.dept_id === opp.dept_id);
    const contacts = state.contacts.filter((item) => item.dept_id === opp.dept_id);
    callAPI('activity.list', { opp_id: opp.opp_id }).then((activities) => {
      renderOppTabs(panel, {
        school: state.school,
        dept,
        contacts,
        opp,
        activities,
        onRefresh: async () => refresh()
      });
    }).catch((error) => {
      panel.innerHTML = `<div class="empty-state">활동 로그를 불러오지 못했습니다. ${escapeHTML(error.message)}</div>`;
    });
  }

  function bindHeader() {
    target.querySelector('#back-button').addEventListener('click', () => history.length > 1 ? history.back() : location.hash = '#/');
    target.querySelector('#edit-school').addEventListener('click', () => { state.selectedMode = 'school'; state.selectedOppId = ''; draw(); });
    target.querySelector('#quick-new-opp').addEventListener('click', () => openQuickOpportunityModal());
    target.querySelector('#add-dept').addEventListener('click', () => openDeptModal());
  }

  function bindTree() {
    target.querySelector('[data-tree-school]')?.addEventListener('click', () => { state.selectedMode = 'school'; state.selectedOppId = ''; draw(); });
    target.querySelectorAll('[data-dept-id]').forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedMode = 'dept';
        state.selectedDeptId = button.dataset.deptId;
        state.selectedOppId = '';
        draw();
      });
    });
    target.querySelectorAll('[data-opp-id]').forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedMode = 'opp';
        state.selectedOppId = button.dataset.oppId;
        const opp = state.opportunities.find((item) => item.opp_id === state.selectedOppId);
        state.selectedDeptId = opp?.dept_id || state.selectedDeptId;
        if (!location.hash.startsWith('#/opp/')) history.replaceState(null, '', `#/school/${state.school.school_id}`);
        draw();
      });
    });
  }

  function renderSchoolEditPanel(panel) {
    panel.innerHTML = `
      <section class="edit-panel-card">
        <h2>학교 정보 편집</h2>
        <form id="school-form" class="detail-form">
          <div class="two-col-form">
            <label class="field"><span>학교명</span><input name="학교명" value="${escapeHTML(state.school.학교명 || '')}"></label>
            <label class="field"><span>학교유형</span><select name="학교유형">${['중학교', '고등학교', '특성화고'].map((type) => `<option value="${type}" ${state.school.학교유형 === type ? 'selected' : ''}>${type}</option>`).join('')}</select></label>
            <label class="field"><span>지역_시</span><input name="지역_시" value="${escapeHTML(state.school.지역_시 || '')}"></label>
            <label class="field"><span>지역_구</span><input name="지역_구" value="${escapeHTML(state.school.지역_구 || '')}"></label>
            <label class="field"><span>대표전화</span><input name="대표전화" value="${escapeHTML(state.school.대표전화 || '')}"></label>
            <label class="field"><span>학교홈페이지</span><input name="학교홈페이지" value="${escapeHTML(state.school.학교홈페이지 || '')}"></label>
            <label class="field"><span>사업카테고리</span><input name="사업카테고리" value="${escapeHTML(state.school.사업카테고리 || '')}"></label>
            <label class="field"><span>대표주소</span><input name="대표주소" value="${escapeHTML(state.school.대표주소 || '')}"></label>
          </div>
          <label class="field"><span>학교메모</span><textarea name="학교메모" rows="6">${escapeHTML(state.school.학교메모 || '')}</textarea></label>
          <div class="form-actions"><button class="button primary" type="submit">학교정보 저장</button></div>
        </form>
      </section>
    `;
    panel.querySelector('#school-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      const payload = Object.fromEntries(fd.entries());
      try {
        await callAPI('school.update', { school_id: state.school.school_id, ...payload });
        toast('학교정보를 저장했습니다.');
        refresh();
      } catch (error) {
        toast(error.message || '학교정보 저장에 실패했습니다.', 'error');
      }
    });
  }

  function renderDeptEditPanel(panel, dept) {
    if (!dept) {
      panel.innerHTML = `<div class="empty-state">부서를 찾을 수 없습니다.</div>`;
      return;
    }
    const deptContacts = state.contacts.filter((item) => item.dept_id === dept.dept_id);
    const deptOpps = state.opportunities.filter((item) => item.dept_id === dept.dept_id);
    panel.innerHTML = `
      <section class="edit-panel-card">
        <h2>${escapeHTML(dept.부서명)} 부서 정보</h2>
        <form id="dept-form" class="detail-form">
          <label class="field"><span>부서명</span><input name="부서명" value="${escapeHTML(dept.부서명 || '')}"></label>
          <label class="field"><span>부서메모</span><textarea name="부서메모" rows="5">${escapeHTML(dept.부서메모 || '')}</textarea></label>
          <div class="form-actions"><button class="button primary" type="submit">부서정보 저장</button></div>
        </form>
        <div class="summary-strip">
          <span>담당자 ${deptContacts.length}명</span><span>기회 ${deptOpps.length}건</span>
        </div>
      </section>
    `;
    panel.querySelector('#dept-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      try {
        await callAPI('dept.update', { dept_id: dept.dept_id, 부서명: fd.get('부서명'), 부서메모: fd.get('부서메모') });
        toast('부서정보를 저장했습니다.');
        refresh();
      } catch (error) {
        toast(error.message || '부서정보 저장에 실패했습니다.', 'error');
      }
    });
  }

  function openDeptModal() {
    openModal({
      title: '부서 추가',
      body: `
        <form id="dept-create-form" class="form-stack">
          <label class="field"><span>부서명</span><input name="부서명" placeholder="예: 진로부, 창체부, 연구부" required></label>
          <label class="field"><span>부서메모</span><textarea name="부서메모" rows="4"></textarea></label>
        </form>
      `,
      actions: `<button class="button ghost" type="button" data-modal-close="true">취소</button><button class="button primary" type="button" id="save-dept">추가</button>`
    });
    document.getElementById('save-dept').addEventListener('click', async () => {
      const form = document.getElementById('dept-create-form');
      if (!form.reportValidity()) return;
      const fd = new FormData(form);
      try {
        const dept = await callAPI('dept.create', { school_id: state.school.school_id, 부서명: fd.get('부서명'), 부서메모: fd.get('부서메모') });
        closeModal();
        state.selectedMode = 'dept';
        state.selectedDeptId = dept.dept_id;
        toast('부서를 추가했습니다.');
        refresh();
      } catch (error) {
        toast(error.message || '부서 추가에 실패했습니다.', 'error');
      }
    });
  }

  function openQuickOpportunityModal() {
    openModal({
      title: '같은 학교에 새 기회 추가',
      body: `
        <form id="quick-opp-form" class="form-stack">
          <label class="field"><span>부서 선택</span><select name="dept_id"><option value="">새 부서 입력</option>${state.departments.map((dept) => `<option value="${escapeHTML(dept.dept_id)}">${escapeHTML(dept.부서명)}</option>`).join('')}</select></label>
          <label class="field"><span>새 부서명</span><input name="부서명_신규" placeholder="기존 부서를 고르면 비워도 됩니다."></label>
          <label class="field"><span>담당자 선택</span><select name="contact_id"><option value="">선택 안 함 또는 새 담당자 입력</option>${state.contacts.map((contact) => `<option value="${escapeHTML(contact.contact_id)}">${escapeHTML(contact.이름)} · ${escapeHTML(contact.직책 || '')}</option>`).join('')}</select></label>
          <label class="field"><span>새 담당자명</span><input name="담당자명_신규" placeholder="선택한 담당자가 없을 때만 입력"></label>
          <label class="field"><span>관심프로그램</span><select name="관심프로그램">${PROGRAMS.map((program) => `<option value="${escapeHTML(program)}">${escapeHTML(program)}</option>`).join('')}</select></label>
          <label class="field"><span>시작 단계</span><select name="현재단계">${STAGES.map((stage) => `<option value="${stage}" ${stage === '리드' ? 'selected' : ''}>${stage}</option>`).join('')}</select></label>
          <label class="field"><span>메모</span><textarea name="기회메모" rows="5"></textarea></label>
        </form>
      `,
      actions: `<button class="button ghost" type="button" data-modal-close="true">취소</button><button class="button primary" type="button" id="create-quick-opp">생성</button>`
    });
    document.getElementById('create-quick-opp').addEventListener('click', async () => {
      const form = document.getElementById('quick-opp-form');
      const fd = new FormData(form);
      if (!fd.get('dept_id') && !fd.get('부서명_신규')) {
        toast('기존 부서를 선택하거나 새 부서명을 입력해주세요.', 'error');
        return;
      }
      try {
        const created = await callAPI('opp.create', {
          school_id: state.school.school_id,
          dept_id: fd.get('dept_id'),
          부서명_신규: fd.get('부서명_신규'),
          contact_id: fd.get('contact_id'),
          담당자명_신규: fd.get('담당자명_신규'),
          관심프로그램: fd.get('관심프로그램'),
          현재단계: fd.get('현재단계'),
          기회메모: fd.get('기회메모')
        });
        closeModal();
        state.selectedMode = 'opp';
        state.selectedOppId = created.opp_id;
        state.selectedDeptId = created.dept_id;
        history.replaceState(null, '', `#/opp/${created.opp_id}`);
        toast('새 기회를 생성했습니다.');
        refresh();
      } catch (error) {
        toast(error.message || '새 기회 생성에 실패했습니다.', 'error');
      }
    });
  }

  try {
    await load();
    draw();
    if (state.oppId && !location.hash.startsWith('#/opp/')) history.replaceState(null, '', `#/opp/${state.oppId}`);
  } catch (error) {
    target.innerHTML = `<div class="empty-state">학교 상세를 불러오지 못했습니다.<br>${escapeHTML(error.message)}</div>`;
  }
}

function primaryProgram(value) {
  return String(value || '기타 커스텀').split(',')[0].trim();
}
