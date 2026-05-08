import { callAPI } from '../api.js';
import { escapeHTML, formatWon } from '../utils.js';
import { contactOptions } from './contactCard.js';
import { toast } from './toast.js';

const BUDGET_SCORE = { '확정': 3, '추정': 2, '모름': 1, '없음': 0 };
const AUTH_SCORE = { '결정권자': 3, '영향력있음': 2, '단순담당': 1, '모름': 0 };

export function calculateBantMeddicScore(opp = {}) {
  let score = 0;
  score += BUDGET_SCORE[opp.BANT_예산상태] ?? 0;
  score += AUTH_SCORE[opp.BANT_권한] ?? 0;
  score += opp.BANT_니즈키워드 ? Math.min(3, String(opp.BANT_니즈키워드).split(',').map((item) => item.trim()).filter(Boolean).length) : 0;
  score += opp.BANT_시점 ? 3 : 0;
  score += opp.MEDDIC_챔피언_contactid ? 2 : 0;
  return score;
}

export function gradeByScore(score) {
  if (score >= 12) return 'S';
  if (score >= 9) return 'A';
  if (score >= 5) return 'B';
  return 'C';
}

function radioGroup(name, values, current) {
  return values.map(([value, score]) => `
    <label class="radio-pill"><input type="radio" name="${name}" value="${escapeHTML(value)}" ${current === value ? 'checked' : ''}> ${escapeHTML(value)} <small>${score}점</small></label>
  `).join('');
}

export function renderBantMeddicForm(container, { opp, contacts = [], onSaved } = {}) {
  const score = calculateBantMeddicScore(opp);
  const grade = gradeByScore(score);
  container.innerHTML = `
    <section class="validation-score-card">
      <div>
        <span class="muted-text">현재 점수</span>
        <strong id="score-text">${score}/14</strong>
      </div>
      <div>
        <span class="muted-text">등급</span>
        <strong id="grade-text" class="priority-letter ${grade.toLowerCase()}">${grade}</strong>
      </div>
      <label class="switch-line">
        <input id="manual-override" type="checkbox" ${opp.우선순위_수동오버라이드 === 'Y' ? 'checked' : ''}>
        수동오버라이드
      </label>
    </section>

    <form id="bant-meddic-form" class="detail-form wide-form">
      <section class="form-section">
        <h3>BANT</h3>
        <div class="guide-grid">
          <div class="guide-card">
            <div class="guide-title">Budget 예산 <span class="help" title="예: AI중점학교 예산 확정, 진로부 자체 예산 추정">?</span></div>
            <div class="radio-row">${radioGroup('BANT_예산상태', [['확정', 3], ['추정', 2], ['모름', 1], ['없음', 0]], opp.BANT_예산상태 || '모름')}</div>
            <label class="field compact"><span>금액</span><input name="BANT_예산금액" inputmode="numeric" value="${escapeHTML(opp.BANT_예산금액 || '')}" placeholder="예: 3000000"></label>
            <p class="field-guide">학교가 이 프로그램에 쓸 예산이 잡혀있는가?</p>
          </div>
          <div class="guide-card">
            <div class="guide-title">Authority 권한 <span class="help" title="예: 부장 선생님은 영향력 있음, 교감·교장은 결정권자 가능성 높음">?</span></div>
            <div class="radio-row">${radioGroup('BANT_권한', [['결정권자', 3], ['영향력있음', 2], ['단순담당', 1], ['모름', 0]], opp.BANT_권한 || '모름')}</div>
            <label class="field compact"><span>대상 담당자</span><select name="BANT_권한_contactid">${contactOptions(contacts, opp.BANT_권한_contactid || '')}</select></label>
            <p class="field-guide">내가 지금 만나는 사람이 결정할 수 있는 사람인가?</p>
          </div>
          <div class="guide-card">
            <div class="guide-title">Need 니즈 <span class="help" title="예: AI중점학교 운영 콘텐츠 부족, 디지털리터러시 수업 필요">?</span></div>
            <label class="field compact"><span>키워드</span><input name="BANT_니즈키워드" value="${escapeHTML(opp.BANT_니즈키워드 || '')}" placeholder="AI교육, 진로캠프, 학생참여"></label>
            <label class="field compact"><span>상세</span><textarea name="BANT_니즈상세" rows="4">${escapeHTML(opp.BANT_니즈상세 || '')}</textarea></label>
            <p class="field-guide">학교가 어떤 문제를 해결하고 싶어하는가?</p>
          </div>
          <div class="guide-card">
            <div class="guide-title">Timeline 시점 <span class="help" title="예: 1학기 추경 전, 2학기 창체 주간, 8월 교사 연수 전">?</span></div>
            <label class="field compact"><span>날짜 또는 분기</span><input name="BANT_시점" value="${escapeHTML(opp.BANT_시점 || '')}" placeholder="예: 2026-06 또는 2학기"></label>
            <p class="field-guide">언제까지 도입해야 하는가?</p>
          </div>
        </div>
      </section>

      <section class="form-section ${['제안서발송', '계약검토', '계약완료'].includes(opp.현재단계) ? 'is-emphasis' : ''}">
        <h3>MEDDIC</h3>
        <div class="two-col-form">
          <label class="field"><span>Metrics 성과지표 <em class="help" title="예: 학생 30명 디지털리터러시 진단점수 평균 15점 향상">?</em></span><textarea name="MEDDIC_메트릭" rows="3">${escapeHTML(opp.MEDDIC_메트릭 || '')}</textarea></label>
          <label class="field"><span>Economic Buyer 실제 사인자</span><select name="MEDDIC_이코노믹바이어_contactid">${contactOptions(contacts, opp.MEDDIC_이코노믹바이어_contactid || '')}</select></label>
          <label class="field"><span>Decision Criteria 평가 기준</span><textarea name="MEDDIC_결정기준" rows="3">${escapeHTML(opp.MEDDIC_결정기준 || '')}</textarea></label>
          <label class="field"><span>Decision Process 결정 절차</span><textarea name="MEDDIC_결정프로세스" rows="3" placeholder="품의 → 교감 → 교장 → 행정실">${escapeHTML(opp.MEDDIC_결정프로세스 || '')}</textarea></label>
          <label class="field"><span>Identify Pain 실제 고통 <em class="help" title="예: AI중점학교 지정받았는데 운영할 콘텐츠가 없음">?</em></span><textarea name="MEDDIC_페인" rows="3">${escapeHTML(opp.MEDDIC_페인 || '')}</textarea></label>
          <label class="field"><span>Champion 우리 편 <em class="help" title="예: 진로부장 김선생, 작년에 우리 흑백창업가 좋게 평가">?</em></span><select name="MEDDIC_챔피언_contactid">${contactOptions(contacts, opp.MEDDIC_챔피언_contactid || '')}</select></label>
          <label class="field"><span>Competition 경쟁사</span><textarea name="MEDDIC_경쟁사" rows="3">${escapeHTML(opp.MEDDIC_경쟁사 || '')}</textarea></label>
        </div>
      </section>

      <div class="form-actions sticky-actions">
        <span id="auto-priority-preview" class="muted-text">자동 산정 예상 우선순위: ${grade} · 예산 ${formatWon(opp.BANT_예산금액 || 0)}</span>
        <button class="button primary" type="submit">영업검증 저장</button>
      </div>
    </form>
  `;

  const form = container.querySelector('#bant-meddic-form');
  const override = container.querySelector('#manual-override');

  const readDraft = () => {
    const fd = new FormData(form);
    const draft = { ...opp };
    for (const [key, value] of fd.entries()) draft[key] = value;
    draft.우선순위_수동오버라이드 = override.checked ? 'Y' : 'N';
    return draft;
  };

  const refreshScore = () => {
    const draft = readDraft();
    const nextScore = calculateBantMeddicScore(draft);
    const nextGrade = gradeByScore(nextScore);
    container.querySelector('#score-text').textContent = `${nextScore}/14`;
    const gradeEl = container.querySelector('#grade-text');
    gradeEl.textContent = nextGrade;
    gradeEl.className = `priority-letter ${nextGrade.toLowerCase()}`;
    container.querySelector('#auto-priority-preview').textContent = `자동 산정 예상 우선순위: ${nextGrade} · 예산 ${formatWon(draft.BANT_예산금액 || 0)}`;
  };

  form.addEventListener('input', refreshScore);
  form.addEventListener('change', refreshScore);
  override.addEventListener('change', refreshScore);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const draft = readDraft();
    const nextScore = calculateBantMeddicScore(draft);
    const nextGrade = gradeByScore(nextScore);
    const payload = {
      opp_id: opp.opp_id,
      ...draft,
      우선순위_자동점수: nextScore,
      우선순위_수동오버라이드: override.checked ? 'Y' : 'N'
    };
    if (!override.checked) payload.우선순위 = nextGrade;
    try {
      const saved = await callAPI('opp.update', payload);
      if (draft.MEDDIC_챔피언_contactid) {
        await callAPI('contact.update', { contact_id: draft.MEDDIC_챔피언_contactid, 챔피언여부: 'Y' });
      }
      toast('영업검증 정보를 저장했습니다.');
      onSaved?.(saved);
    } catch (error) {
      toast(error.message || '영업검증 저장에 실패했습니다.', 'error');
    }
  });
}
