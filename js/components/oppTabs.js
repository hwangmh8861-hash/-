import { callAPI } from '../api.js';
import { escapeHTML, formatDate, formatWon, parseJSON } from '../utils.js';
import { stageBadge, priorityBadge, tagBadges } from './badge.js';
import { contactCard } from './contactCard.js';
import { openStageChangeModal } from './stageChangeModal.js';
import { renderBantMeddicForm } from './bantMeddicForm.js';
import { renderActivityTimeline, openActivityModal } from './activityTimeline.js';
import { openModal, closeModal } from './modal.js';
import { toast } from './toast.js';

const PROGRAMS = ['흑백창업가', '필터버블 탈출', 'Re_Brain / 팝콘브레인', 'MDC + 진로빅데이터', '핑퐁로봇', '존중의숲', '습관추론게임', 'AI 리터러시 미니제안', '자기주도학습 비밀노트', '헤이븐월드 RPG', '캡스톤 디자인', '기타 커스텀'];
const STAGES = ['리드', 'TM시도', '자료발송', 'EVD예정', 'EVD완료', '제안서발송', '계약검토', '계약완료', '보류', '드랍'];
const PRIORITIES = ['S', 'A', 'B', 'C'];
const TAGS = ['부재중-재콜필요', '담당자부재-시간약속', '통화거절', '이메일요청', '자료검토중-회신대기', '회의중-재콜약속', '관심있음-EVD예정', '관심없음', '잘못된번호', '보류-시점미정', '결정자아님-상위연결필요', '기타'];

export function renderOppTabs(container, context = {}) {
  const state = {
    activeTab: context.initialTab || 'basic',
    ...context
  };

  const draw = () => {
    if (!state.opp) {
      container.innerHTML = `<div class="empty-state">왼쪽에서 영업기회를 선택하세요.</div>`;
      return;
    }
    container.innerHTML = `
      <section class="opp-summary-card">
        <div>
          <h2>${escapeHTML(state.opp.기회제목 || '영업기회')}</h2>
          <p>${escapeHTML(state.school?.학교명 || '')} · ${escapeHTML(state.dept?.부서명 || '')}</p>
        </div>
        <div class="badge-row">${stageBadge(state.opp.현재단계)}${priorityBadge(state.opp.우선순위)}${tagBadges(parseJSON(state.opp.태그_JSON, []).slice(0, 4))}</div>
      </section>
      <nav class="opp-tabs" aria-label="기회 상세 탭">
        ${tabButton('basic', '기본정보', state.activeTab)}
        ${tabButton('validation', '영업검증', state.activeTab)}
        ${tabButton('activity', '활동로그', state.activeTab)}
        ${tabButton('next', '다음액션', state.activeTab)}
      </nav>
      <section id="opp-tab-panel" class="opp-tab-panel"></section>
    `;
    container.querySelectorAll('[data-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        state.activeTab = button.dataset.tab;
        draw();
      });
    });
    const panel = container.querySelector('#opp-tab-panel');
    if (state.activeTab === 'basic') renderBasicTab(panel, state);
    if (state.activeTab === 'validation') renderBantMeddicForm(panel, { opp: state.opp, contacts: state.contacts, onSaved: async () => state.onRefresh?.() });
    if (state.activeTab === 'activity') renderActivityTimeline(panel, { opp: state.opp, activities: state.activities, onChanged: async () => state.onRefresh?.() });
    if (state.activeTab === 'next') renderNextActionTab(panel, state);
  };

  draw();
}

function tabButton(key, label, activeTab) {
  return `<button class="opp-tab ${activeTab === key ? 'is-active' : ''}" type="button" data-tab="${key}">${label}</button>`;
}

function renderBasicTab(panel, state) {
  const opp = state.opp;
  const contacts = state.contacts || [];
  const tags = parseJSON(opp.태그_JSON, []);
  panel.innerHTML = `
    <form id="opp-basic-form" class="detail-form">
      <section class="form-section">
        <h3>기회 정보</h3>
        <div class="two-col-form">
          <label class="field"><span>기회제목</span><input name="기회제목" value="${escapeHTML(opp.기회제목 || '')}"></label>
          <label class="field"><span>현재단계</span><select name="현재단계">${STAGES.map((stage) => `<option value="${stage}" ${opp.현재단계 === stage ? 'selected' : ''}>${stage}</option>`).join('')}</select></label>
          <label class="field"><span>단계진입일</span><input value="${escapeHTML(formatDate(opp.단계진입일))}" readonly></label>
          <label class="field"><span>정체일수</span><input class="${opp.정체여부 ? 'danger-input' : ''}" value="${Number(opp.정체일수 || opp.정체일수_캐시 || 0)}일" readonly></label>
          <label class="field"><span>우선순위</span><select name="우선순위">${PRIORITIES.map((priority) => `<option value="${priority}" ${opp.우선순위 === priority ? 'selected' : ''}>${priority}</option>`).join('')}</select></label>
          <label class="field inline-check"><input type="checkbox" name="우선순위_수동오버라이드" ${opp.우선순위_수동오버라이드 === 'Y' ? 'checked' : ''}> 우선순위 수동 지정</label>
          <label class="field"><span>관심프로그램</span><select name="관심프로그램" multiple size="5">${PROGRAMS.map((program) => `<option value="${escapeHTML(program)}" ${String(opp.관심프로그램 || '').split(',').map((item) => item.trim()).includes(program) ? 'selected' : ''}>${escapeHTML(program)}</option>`).join('')}</select></label>
          <div class="field"><span>태그</span><div class="chip-row">${TAGS.map((tag) => `<label class="chip check-chip"><input type="checkbox" name="태그" value="${escapeHTML(tag)}" ${tags.includes(tag) ? 'checked' : ''}> ${escapeHTML(tag)}</label>`).join('')}</div></div>
          <label class="field"><span>예상계약일</span><input name="예상계약일" type="date" value="${escapeHTML(opp.예상계약일 || '')}"></label>
          <label class="field"><span>예상금액</span><input name="예상금액" inputmode="numeric" value="${escapeHTML(opp.예상금액 || '')}" placeholder="원 단위"></label>
          <label class="field"><span>사업신청유형</span><input name="사업신청유형" value="${escapeHTML(opp.사업신청유형 || '')}" placeholder="예: AI중점학교, 일반예산"></label>
          <label class="field"><span>사업신청상태</span><input name="사업신청상태" value="${escapeHTML(opp.사업신청상태 || '')}" placeholder="예: 신청예정, 선정, 미선정"></label>
        </div>
        <label class="field"><span>기회메모</span><textarea name="기회메모" rows="7" placeholder="마크다운 형식으로 핵심 맥락을 정리하세요.">${escapeHTML(opp.기회메모 || '')}</textarea></label>
        <div class="form-actions">
          <button class="button ghost" type="button" id="change-stage-button">단계변경 모달 열기</button>
          <button class="button primary" type="submit">기본정보 저장</button>
        </div>
      </section>
    </form>

    <section class="form-section">
      <div class="section-title-row">
        <h3>부서 담당자 리스트</h3>
        <button class="button ghost" type="button" id="add-contact-button">담당자 추가</button>
      </div>
      <div class="contact-grid">
        ${contacts.length ? contacts.map(contactCard).join('') : '<div class="empty-state">등록된 담당자가 없습니다.</div>'}
      </div>
    </section>
  `;

  const form = panel.querySelector('#opp-basic-form');
  const stageSelect = form.querySelector('[name="현재단계"]');
  stageSelect.addEventListener('change', () => {
    openStageChangeModal({ opp, initialStage: stageSelect.value, onChanged: () => state.onRefresh?.() });
    stageSelect.value = opp.현재단계;
  });
  panel.querySelector('#change-stage-button').addEventListener('click', () => openStageChangeModal({ opp, onChanged: () => state.onRefresh?.() }));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    const programs = Array.from(form.querySelector('[name="관심프로그램"]').selectedOptions).map((option) => option.value);
    const selectedTags = Array.from(form.querySelectorAll('[name="태그"]:checked')).map((node) => node.value);
    const payload = {
      opp_id: opp.opp_id,
      기회제목: fd.get('기회제목'),
      우선순위: fd.get('우선순위'),
      우선순위_수동오버라이드: form.querySelector('[name="우선순위_수동오버라이드"]').checked ? 'Y' : 'N',
      관심프로그램: programs.join(','),
      태그_JSON: JSON.stringify(selectedTags),
      예상계약일: fd.get('예상계약일'),
      예상금액: Number(fd.get('예상금액') || 0),
      사업신청유형: fd.get('사업신청유형'),
      사업신청상태: fd.get('사업신청상태'),
      기회메모: fd.get('기회메모')
    };
    try {
      await callAPI('opp.update', payload);
      toast('기본정보를 저장했습니다.');
      state.onRefresh?.();
    } catch (error) {
      toast(error.message || '기본정보 저장에 실패했습니다.', 'error');
    }
  });

  panel.querySelector('#add-contact-button')?.addEventListener('click', () => openContactModal({ state, contact: null }));
  bindContactActions(panel, state);
}

function bindContactActions(panel, state) {
  panel.querySelectorAll('[data-contact-action]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      const card = event.target.closest('[data-contact-id]');
      const contactId = card?.dataset.contactId;
      const contact = state.contacts.find((item) => item.contact_id === contactId);
      const action = event.target.dataset.contactAction;
      if (!contact) return;
      if (action === 'edit') openContactModal({ state, contact });
      if (action === 'delete') {
        if (!confirm('담당자를 제거할까요?')) return;
        try {
          await callAPI('contact.delete', { contact_id: contactId });
          toast('담당자를 제거했습니다.');
          state.onRefresh?.();
        } catch (error) {
          toast(error.message || '담당자 제거에 실패했습니다.', 'error');
        }
      }
      if (action === 'champion') {
        try {
          await callAPI('contact.update', { contact_id: contactId, 챔피언여부: contact.챔피언여부 === 'Y' ? 'N' : 'Y' });
          if (contact.챔피언여부 !== 'Y') await callAPI('opp.update', { opp_id: state.opp.opp_id, MEDDIC_챔피언_contactid: contactId });
          toast('챔피언 표시를 변경했습니다.');
          state.onRefresh?.();
        } catch (error) {
          toast(error.message || '챔피언 변경에 실패했습니다.', 'error');
        }
      }
    });
  });
}

function openContactModal({ state, contact = null }) {
  const isEdit = Boolean(contact);
  openModal({
    title: isEdit ? '담당자 편집' : '담당자 추가',
    body: `
      <form id="contact-form" class="form-stack">
        <label class="field"><span>이름</span><input name="이름" value="${escapeHTML(contact?.이름 || '')}" required></label>
        <label class="field"><span>직책</span><input name="직책" value="${escapeHTML(contact?.직책 || '교사')}"></label>
        <label class="field"><span>휴대폰</span><input name="휴대폰" value="${escapeHTML(contact?.휴대폰 || '')}"></label>
        <label class="field"><span>사무실전화</span><input name="사무실전화" value="${escapeHTML(contact?.사무실전화 || state.school?.대표전화 || '')}"></label>
        <label class="field"><span>이메일</span><input name="이메일" value="${escapeHTML(contact?.이메일 || '')}"></label>
        <label class="field"><span>관계강도</span><select name="관계강도">${['약', '중', '강'].map((value) => `<option value="${value}" ${contact?.관계강도 === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
        <label class="field inline-check"><input type="checkbox" name="챔피언여부" ${contact?.챔피언여부 === 'Y' ? 'checked' : ''}> 챔피언</label>
        <label class="field"><span>담당자메모</span><textarea name="담당자메모" rows="4">${escapeHTML(contact?.담당자메모 || '')}</textarea></label>
      </form>
    `,
    actions: `
      <button class="button ghost" type="button" data-modal-close="true">취소</button>
      <button class="button primary" type="button" id="save-contact">저장</button>
    `
  });
  document.getElementById('save-contact').addEventListener('click', async () => {
    const form = document.getElementById('contact-form');
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const payload = {
      school_id: state.school.school_id,
      dept_id: state.dept.dept_id,
      이름: fd.get('이름'),
      직책: fd.get('직책'),
      휴대폰: fd.get('휴대폰'),
      사무실전화: fd.get('사무실전화'),
      이메일: fd.get('이메일'),
      관계강도: fd.get('관계강도'),
      챔피언여부: form.querySelector('[name="챔피언여부"]').checked ? 'Y' : 'N',
      담당자메모: fd.get('담당자메모')
    };
    try {
      if (isEdit) await callAPI('contact.update', { contact_id: contact.contact_id, ...payload });
      else await callAPI('contact.create', payload);
      closeModal();
      toast('담당자를 저장했습니다.');
      state.onRefresh?.();
    } catch (error) {
      toast(error.message || '담당자 저장에 실패했습니다.', 'error');
    }
  });
}

function renderNextActionTab(panel, state) {
  const opp = state.opp;
  const actions = buildOpenActions(opp, state.activities || []);
  panel.innerHTML = `
    <section class="next-action-layout">
      <div class="mini-calendar">
        ${renderMiniCalendar(actions)}
      </div>
      <div class="next-action-list">
        <div class="section-title-row">
          <h3>오픈된 다음액션</h3>
          <button class="button ghost" type="button" id="add-next-action">후속 액션 추가</button>
        </div>
        ${actions.length ? actions.map((item, index) => `
          <label class="next-action-item">
            <input type="checkbox" data-action-index="${index}">
            <span><strong>${escapeHTML(formatDate(item.date))}</strong> ${escapeHTML(item.text)} <small>${escapeHTML(item.type || '')}</small></span>
          </label>
        `).join('') : '<div class="empty-state">열려 있는 다음액션이 없습니다.</div>'}
      </div>
    </section>
  `;
  panel.querySelector('#add-next-action')?.addEventListener('click', () => openActivityModal({ opp, onSaved: () => state.onRefresh?.() }));
  panel.querySelectorAll('[data-action-index]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => openFollowupModal(state));
  });
}

function buildOpenActions(opp, activities) {
  const list = [];
  if (opp.다음액션 || opp.다음액션일) list.push({ text: opp.다음액션 || '다음액션', date: opp.다음액션일 || new Date().toISOString().slice(0, 10), type: '기회' });
  activities.forEach((activity) => {
    if (activity.다음액션 || activity.다음액션일) list.push({ text: activity.다음액션 || '후속 액션', date: activity.다음액션일 || activity.활동일시, type: activity.활동유형 });
  });
  return list.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function renderMiniCalendar(actions) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const actionDays = new Set(actions.map((item) => new Date(item.date).getDate()).filter(Boolean));
  return `
    <h3>${year}년 ${month + 1}월 액션 분포</h3>
    <div class="calendar-grid">
      ${Array.from({ length: lastDate }, (_, i) => i + 1).map((day) => `<span class="calendar-day ${actionDays.has(day) ? 'has-action' : ''}">${day}</span>`).join('')}
    </div>
    <p class="muted-text">색이 들어간 날짜에 후속 액션이 있습니다.</p>
  `;
}

function openFollowupModal(state) {
  openModal({
    title: '액션 완료 처리',
    body: `
      <form id="followup-form" class="form-stack">
        <p class="form-notice">액션을 완료했습니다. 이어서 추적할 후속 액션을 남기면 기회의 다음액션 정보가 갱신됩니다.</p>
        <label class="field"><span>후속 액션</span><input name="다음액션" placeholder="예: 회신 없으면 3일 뒤 재콜"></label>
        <label class="field"><span>후속 액션일</span><input name="다음액션일" type="date"></label>
      </form>
    `,
    actions: `<button class="button ghost" type="button" id="complete-no-followup">후속 없음</button><button class="button primary" type="button" id="save-followup">저장</button>`
  });
  document.getElementById('complete-no-followup').addEventListener('click', async () => {
    try {
      await callAPI('activity.create', {
        opp_id: state.opp.opp_id,
        활동유형: '메모',
        활동내용: '다음액션 완료 처리',
        다음액션: '',
        다음액션일: ''
      });
      await callAPI('opp.update', { opp_id: state.opp.opp_id, 다음액션: '', 다음액션일: '' });
      closeModal();
      toast('액션을 완료 처리했습니다.');
      state.onRefresh?.();
    } catch (error) {
      toast(error.message || '액션 완료 처리에 실패했습니다.', 'error');
    }
  });
  document.getElementById('save-followup').addEventListener('click', async () => {
    const fd = new FormData(document.getElementById('followup-form'));
    try {
      await callAPI('activity.create', {
        opp_id: state.opp.opp_id,
        활동유형: '메모',
        활동내용: '이전 다음액션 완료 후 후속 액션 등록',
        다음액션: fd.get('다음액션'),
        다음액션일: fd.get('다음액션일')
      });
      closeModal();
      toast('후속 액션을 등록했습니다.');
      state.onRefresh?.();
    } catch (error) {
      toast(error.message || '후속 액션 저장에 실패했습니다.', 'error');
    }
  });
}
