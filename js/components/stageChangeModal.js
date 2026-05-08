import { callAPI } from '../api.js';
import { escapeHTML } from '../utils.js';
import { openModal, closeModal } from './modal.js';
import { toast } from './toast.js';

export const STAGES = ['리드', 'TM시도', '자료발송', 'EVD예정', 'EVD완료', '제안서발송', '계약검토', '계약완료', '보류', '드랍'];

const TAG_SUGGESTIONS = {
  'TM시도→자료발송': ['이메일요청', '자료검토중-회신대기'],
  'TM시도→EVD예정': ['관심있음-EVD예정'],
  '자료발송→EVD예정': ['관심있음-EVD예정'],
  'EVD완료→제안서발송': ['자료검토중-회신대기'],
  '제안서발송→계약검토': ['자료검토중-회신대기'],
  '리드→TM시도': ['부재중-재콜필요']
};

function suggestedTags(fromStage, toStage) {
  return TAG_SUGGESTIONS[`${fromStage}→${toStage}`] || [];
}

function requiresNextAction(fromStage, toStage) {
  return fromStage === 'TM시도' && toStage === 'EVD예정';
}

export function openStageChangeModal({ opp, initialStage, onChanged } = {}) {
  const fromStage = opp?.현재단계 || '리드';
  const toStage = initialStage || fromStage;
  const suggestions = suggestedTags(fromStage, toStage);
  renderModal(opp, fromStage, toStage, suggestions, onChanged);
}

function renderModal(opp, fromStage, toStage, suggestions, onChanged) {
  const isAbnormal = ['보류', '드랍'].includes(toStage);
  const nextRequired = requiresNextAction(fromStage, toStage);
  openModal({
    title: `단계 변경: ${fromStage} → ${toStage}`,
    body: `
      <form id="stage-change-form" class="form-stack">
        <label class="field">
          <span>새 단계</span>
          <select name="새단계">
            ${STAGES.map((stage) => `<option value="${stage}" ${stage === toStage ? 'selected' : ''}>${stage}</option>`).join('')}
          </select>
        </label>
        <div class="form-notice ${isAbnormal ? 'is-danger' : ''}" id="stage-warning">
          ${isAbnormal ? '보류·드랍은 비정상 흐름입니다. 사유를 남겨두는 것을 권장합니다.' : '단계 변경 시 활동 로그가 자동으로 생성됩니다.'}
        </div>
        <label class="field">
          <span>사유</span>
          <textarea name="사유" rows="4" placeholder="예: 진로부장 미팅 확정, 자료 발송 요청, 예산 시점 지연 등"></textarea>
        </label>
        <div class="field">
          <span>자동 제안 태그</span>
          <div id="stage-suggested-tags" class="chip-row">
            ${suggestions.length ? suggestions.map((tag) => `
              <label class="chip check-chip"><input type="checkbox" name="제안태그" value="${escapeHTML(tag)}" checked /> ${escapeHTML(tag)}</label>
            `).join('') : '<span class="muted-text">이 이동에 대한 자동 제안 태그가 없습니다.</span>'}
          </div>
        </div>
        <label class="field">
          <span>다음액션 ${nextRequired ? '<em class="required">필수</em>' : ''}</span>
          <input name="다음액션" placeholder="예: EVD 일정·장소 확정, 자료 재발송, 품의 일정 확인" />
        </label>
        <label class="field">
          <span>다음액션일 ${nextRequired ? '<em class="required">필수</em>' : ''}</span>
          <input name="다음액션일" type="date" />
        </label>
      </form>
    `,
    actions: `
      <button class="button ghost" type="button" data-modal-close="true">취소</button>
      <button class="button primary" type="button" id="confirm-stage-change">변경 + 활동 자동 기록</button>
    `
  });

  const form = document.getElementById('stage-change-form');
  const select = form.querySelector('[name="새단계"]');
  const suggestBox = document.getElementById('stage-suggested-tags');
  const warning = document.getElementById('stage-warning');

  select.addEventListener('change', () => {
    const stage = select.value;
    const next = suggestedTags(fromStage, stage);
    const abnormal = ['보류', '드랍'].includes(stage);
    warning.classList.toggle('is-danger', abnormal);
    warning.textContent = abnormal ? '보류·드랍은 비정상 흐름입니다. 사유를 남겨두는 것을 권장합니다.' : '단계 변경 시 활동 로그가 자동으로 생성됩니다.';
    suggestBox.innerHTML = next.length ? next.map((tag) => `
      <label class="chip check-chip"><input type="checkbox" name="제안태그" value="${escapeHTML(tag)}" checked /> ${escapeHTML(tag)}</label>
    `).join('') : '<span class="muted-text">이 이동에 대한 자동 제안 태그가 없습니다.</span>';
  });

  document.getElementById('confirm-stage-change').addEventListener('click', async () => {
    const fd = new FormData(form);
    const newStage = fd.get('새단계');
    const reason = String(fd.get('사유') || '').trim();
    const nextAction = String(fd.get('다음액션') || '').trim();
    const nextActionDate = String(fd.get('다음액션일') || '').trim();
    if (requiresNextAction(fromStage, newStage) && (!nextAction || !nextActionDate)) {
      toast('TM시도에서 EVD예정으로 이동할 때는 다음액션과 날짜가 필요합니다.', 'error');
      return;
    }
    try {
      const changed = await callAPI('opp.changeStage', { opp_id: opp.opp_id, 새단계: newStage, 사유: reason });
      const tags = Array.from(form.querySelectorAll('[name="제안태그"]:checked')).map((node) => node.value);
      if (tags.length) await callAPI('opp.addTags', { opp_id: opp.opp_id, 태그배열: tags });
      if (nextAction || nextActionDate) {
        await callAPI('activity.create', {
          opp_id: opp.opp_id,
          활동유형: '메모',
          활동내용: '단계 변경 후속 액션 등록',
          다음액션: nextAction,
          다음액션일: nextActionDate,
          결과태그_JSON: JSON.stringify(tags)
        });
      }
      closeModal();
      toast('단계를 변경했습니다.');
      onChanged?.(changed);
    } catch (error) {
      toast(error.message || '단계 변경에 실패했습니다.', 'error');
    }
  });
}
