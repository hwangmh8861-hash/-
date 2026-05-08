import { callAPI } from '../api.js';
import { escapeHTML, formatDate, parseJSON } from '../utils.js';
import { tagBadges } from './badge.js';
import { openModal, closeModal } from './modal.js';
import { toast } from './toast.js';
import { createVoiceRecognition, isVoiceRecognitionSupported } from '../utils/voiceRecognition.js';

const TYPE_ICONS = {
  TM: '📞', 이메일: '📧', 방문EVD: '🏫', 제안서: '📄', 통화: '☎️', 문자: '💬', 단계변경: '🔁', 메모: '📝', 기타: '▫️'
};

const ACTIVITY_TYPES = ['TM', '이메일', '방문EVD', '제안서', '통화', '문자', '메모', '기타'];
const TM_TAGS = ['부재중-재콜필요', '담당자부재-시간약속', '통화거절', '이메일요청', '자료검토중-회신대기', '회의중-재콜약속', '관심있음-EVD예정', '관심없음', '잘못된번호', '결정자아님-상위연결필요', '기타'];

export function renderActivityTimeline(container, { opp, activities = [], onChanged } = {}) {
  const state = { type: '', tag: '', keyword: '' };

  const draw = () => {
    const filtered = activities.filter((item) => {
      const tags = parseJSON(item.결과태그_JSON, []);
      if (state.type && item.활동유형 !== state.type) return false;
      if (state.tag && !tags.includes(state.tag)) return false;
      if (state.keyword && ![item.활동내용, item.다음액션].join(' ').includes(state.keyword)) return false;
      return true;
    }).sort((a, b) => String(b.활동일시).localeCompare(String(a.활동일시)));

    container.innerHTML = `
      <section class="timeline-toolbar">
        <button class="button primary" type="button" id="new-activity">+ 새 활동</button>
        <select id="activity-type-filter"><option value="">활동유형 전체</option>${ACTIVITY_TYPES.concat('단계변경').map((type) => `<option value="${type}" ${state.type === type ? 'selected' : ''}>${type}</option>`).join('')}</select>
        <select id="activity-tag-filter"><option value="">태그 전체</option>${TM_TAGS.map((tag) => `<option value="${escapeHTML(tag)}" ${state.tag === tag ? 'selected' : ''}>${escapeHTML(tag)}</option>`).join('')}</select>
        <input id="activity-keyword-filter" value="${escapeHTML(state.keyword)}" placeholder="활동내용 검색" />
      </section>
      <section class="timeline-list">
        ${filtered.length ? filtered.map(activityCard).join('') : '<div class="empty-state">조건에 맞는 활동이 없습니다.</div>'}
      </section>
    `;
    bind();
  };

  const bind = () => {
    container.querySelector('#new-activity')?.addEventListener('click', () => openActivityModal({ opp, onSaved: async () => onChanged?.() }));
    container.querySelector('#activity-type-filter')?.addEventListener('change', (event) => { state.type = event.target.value; draw(); });
    container.querySelector('#activity-tag-filter')?.addEventListener('change', (event) => { state.tag = event.target.value; draw(); });
    container.querySelector('#activity-keyword-filter')?.addEventListener('input', (event) => { state.keyword = event.target.value; draw(); });
    container.querySelectorAll('[data-activity-action="edit"]').forEach((button) => {
      button.addEventListener('click', () => {
        const activity = activities.find((item) => item.activity_id === button.closest('[data-activity-id]').dataset.activityId);
        openActivityModal({ opp, activity, onSaved: async () => onChanged?.() });
      });
    });
    container.querySelectorAll('[data-activity-action="delete"]').forEach((button) => {
      button.addEventListener('click', async () => {
        const activityId = button.closest('[data-activity-id]').dataset.activityId;
        if (!confirm('활동 로그를 삭제할까요?')) return;
        try {
          await callAPI('activity.delete', { activity_id: activityId });
          toast('활동 로그를 삭제했습니다.');
          onChanged?.();
        } catch (error) {
          toast(error.message || '활동 삭제에 실패했습니다.', 'error');
        }
      });
    });
  };

  draw();
}

function activityCard(activity) {
  const tags = parseJSON(activity.결과태그_JSON, []);
  return `
    <article class="timeline-card" data-activity-id="${escapeHTML(activity.activity_id)}">
      <div class="timeline-card-head">
        <strong>${escapeHTML(formatDate(activity.활동일시))} · ${TYPE_ICONS[activity.활동유형] || '▫️'} ${escapeHTML(activity.활동유형 || '기타')}</strong>
        <span class="timeline-actions"><button type="button" data-activity-action="edit">편집</button><button type="button" data-activity-action="delete">삭제</button></span>
      </div>
      ${tags.length ? `<div class="badge-row">${tagBadges(tags)}</div>` : ''}
      <p>${escapeHTML(activity.활동내용 || '내용 없음')}</p>
      ${activity.다음액션 ? `<div class="next-line">→ 다음: ${escapeHTML(activity.다음액션)} ${activity.다음액션일 ? `(${escapeHTML(formatDate(activity.다음액션일))})` : ''}</div>` : ''}
      ${activity.첨부URL ? `<a class="attachment-link" href="${escapeHTML(activity.첨부URL)}" target="_blank" rel="noreferrer">첨부URL 열기</a>` : ''}
    </article>
  `;
}

export function openActivityModal({ opp, activity = null, onSaved } = {}) {
  const isEdit = Boolean(activity);
  const tags = parseJSON(activity?.결과태그_JSON, []);
  openModal({
    title: isEdit ? '활동 편집' : '새 활동 추가',
    body: `
      <form id="activity-form" class="form-stack">
        <label class="field"><span>활동일시</span><input name="활동일시" type="datetime-local" value="${toLocalInput(activity?.활동일시 || new Date().toISOString())}"></label>
        <label class="field"><span>활동유형</span><select name="활동유형">${ACTIVITY_TYPES.map((type) => `<option value="${type}" ${activity?.활동유형 === type ? 'selected' : ''}>${type}</option>`).join('')}</select></label>
        <div class="field"><span>결과태그</span><div class="chip-row">${TM_TAGS.map((tag) => `<label class="chip check-chip"><input type="checkbox" name="결과태그" value="${escapeHTML(tag)}" ${tags.includes(tag) ? 'checked' : ''}> ${escapeHTML(tag)}</label>`).join('')}</div></div>
        <label class="field"><span>활동내용</span><textarea name="활동내용" rows="6" placeholder="통화 내용, 미팅 반응, 전달 자료, 선생님 요청사항 등을 기록하세요.">${escapeHTML(activity?.활동내용 || '')}</textarea></label>
        <div class="voice-row">
          <button class="button ghost" type="button" id="voice-button" ${isVoiceRecognitionSupported() ? '' : 'disabled'}>음성메모 시작</button>
          <span id="voice-status" class="muted-text">${isVoiceRecognitionSupported() ? '한국어 받아쓰기를 사용할 수 있습니다.' : '현재 브라우저는 음성메모를 지원하지 않습니다.'}</span>
        </div>
        <label class="field"><span>다음액션</span><input name="다음액션" value="${escapeHTML(activity?.다음액션 || '')}" placeholder="예: 김부장 재콜, 자료 재발송 후 회신 확인"></label>
        <label class="field"><span>다음액션일</span><input name="다음액션일" type="date" value="${escapeHTML(activity?.다음액션일 || '')}"></label>
        <label class="field"><span>첨부 URL</span><input name="첨부URL" value="${escapeHTML(activity?.첨부URL || '')}" placeholder="구글드라이브 제안서 링크, 이메일 링크 등"></label>
      </form>
    `,
    actions: `
      <button class="button ghost" type="button" data-modal-close="true">취소</button>
      <button class="button primary" type="button" id="save-activity">저장</button>
    `
  });

  bindVoiceButton();
  document.getElementById('save-activity').addEventListener('click', async () => {
    const form = document.getElementById('activity-form');
    const fd = new FormData(form);
    const payload = {
      opp_id: opp.opp_id,
      활동일시: fromLocalInput(fd.get('활동일시')),
      활동유형: fd.get('활동유형'),
      결과태그_JSON: JSON.stringify(Array.from(form.querySelectorAll('[name="결과태그"]:checked')).map((node) => node.value)),
      활동내용: fd.get('활동내용'),
      다음액션: fd.get('다음액션'),
      다음액션일: fd.get('다음액션일'),
      첨부URL: fd.get('첨부URL')
    };
    try {
      if (isEdit) await callAPI('activity.update', { activity_id: activity.activity_id, ...payload });
      else await callAPI('activity.create', payload);
      closeModal();
      toast('활동 로그를 저장했습니다.');
      onSaved?.();
    } catch (error) {
      toast(error.message || '활동 저장에 실패했습니다.', 'error');
    }
  });
}

function bindVoiceButton() {
  const button = document.getElementById('voice-button');
  const status = document.getElementById('voice-status');
  const textarea = document.querySelector('#activity-form [name="활동내용"]');
  if (!button || !textarea) return;
  let listening = false;
  const recognition = createVoiceRecognition({
    onStart: () => { listening = true; button.textContent = '음성메모 중지'; status.textContent = '듣는 중입니다. 말한 내용이 활동내용에 추가됩니다.'; },
    onEnd: () => { listening = false; button.textContent = '음성메모 시작'; status.textContent = '음성메모가 종료되었습니다.'; },
    onError: (error) => { status.textContent = error.message; toast(error.message, 'error'); },
    onResult: ({ finalText, interimText }) => {
      status.textContent = interimText ? `인식 중: ${interimText}` : '듣는 중입니다.';
      if (finalText) textarea.value = `${textarea.value ? `${textarea.value}\n` : ''}${finalText.trim()}`;
    }
  });
  button.addEventListener('click', () => {
    if (!recognition.supported) return;
    if (listening) recognition.stop();
    else recognition.start();
  });
}

function toLocalInput(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value) {
  if (!value) return new Date().toISOString();
  return new Date(value).toISOString();
}
