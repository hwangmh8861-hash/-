import { callAPI } from '../api.js';
import { escapeHTML, formatWon, groupBy, debounce } from '../utils.js';
import { toast } from '../components/toast.js';
import { openModal, closeModal } from '../components/modal.js';
import { stageColumn, abnormalTray } from '../components/stageColumn.js';
import { renderFilterBar, bindFilterBar, applyOpportunityFilters, 기본필터상태 } from '../components/filterBar.js';
import {
  단계목록,
  비정상단계목록,
  기본태그,
  parseTags,
  calculateStagnation,
  suggestedTagsForStageMove,
  isNextActionRequired
} from '../utils/tagHelper.js';

const state = {
  allOpps: [],
  filteredOpps: [],
  filters: { ...기본필터상태 },
  collapsedStages: new Set(),
  isolatedStage: '',
  groupBySchool: false,
  abnormalOpen: false,
  contextMenu: null,
  sortableList: []
};

let targetEl = null;
let longPressTimer = null;

export async function render(target) {
  targetEl = target;
  target.innerHTML = `
    <section class="page-head kanban-page-head">
      <div>
        <h1 class="page-title">칸반 파이프라인</h1>
        <p class="page-desc">학교와 부서를 분리해 관리하고, 정체·다음액션·TM 태그를 한 화면에서 확인합니다.</p>
      </div>
      <div class="kanban-head-actions">
        <button id="toggle-school-group" class="ghost-button" type="button" aria-pressed="false">🏫 학교 단위 묶기</button>
        <button id="new-opp-button" class="primary-button" type="button">+ 새 기회</button>
      </div>
    </section>
    <div id="kanban-filter-root"></div>
    <section id="abnormal-summary" class="abnormal-summary"></section>
    <section id="kanban-board-root" class="kanban-board-shell"><div class="placeholder">칸반 데이터를 불러오는 중입니다.</div></section>
  `;

  bindHeaderActions();

  try {
    const opps = await callAPI('opp.list', {});
    state.allOpps = normalizeOpportunities(opps);
    applyPendingDashboardFilter();
    applyAndRender();
  } catch (error) {
    target.querySelector('#kanban-board-root').innerHTML = `<div class="placeholder">칸반 데이터를 불러오지 못했습니다.<br>${escapeHTML(error.message)}</div>`;
  }
}


function applyPendingDashboardFilter() {
  try {
    const saved = JSON.parse(localStorage.getItem('crm_pending_kanban_filter') || '{}');
    localStorage.removeItem('crm_pending_kanban_filter');
    if (saved?.단계?.length) state.isolatedStage = saved.단계[0];
  } catch (error) {}
}

function applyAndRender() {
  state.filteredOpps = applyOpportunityFilters(state.allOpps, state.filters);
  renderFilter();
  renderAbnormalSummary();
  renderBoard();
  bindBoardEvents();
  initSortable();
}

function renderFilter() {
  const root = targetEl.querySelector('#kanban-filter-root');
  root.innerHTML = renderFilterBar({ filters: state.filters, opps: state.allOpps });
  bindFilterBar(root, {
    filters: state.filters,
    opps: state.allOpps,
    onChange: (nextFilters) => {
      state.filters = { ...기본필터상태, ...nextFilters };
      applyAndRender();
    }
  });
}

function renderAbnormalSummary() {
  const root = targetEl.querySelector('#abnormal-summary');
  const hold = state.filteredOpps.filter((opp) => opp.현재단계 === '보류');
  const drop = state.filteredOpps.filter((opp) => opp.현재단계 === '드랍');
  root.innerHTML = `
    <div class="abnormal-summary-bar">
      <button class="abnormal-toggle ${state.abnormalOpen ? 'is-open' : ''}" type="button" data-toggle-abnormal>
        보류 ${hold.length}건 · 드랍 ${drop.length}건 ${state.abnormalOpen ? '접기' : '펼치기'}
      </button>
      <span class="abnormal-desc">비정상 상태는 평소엔 카운트만 보고, 필요할 때만 펼쳐 확인합니다.</span>
    </div>
    ${state.abnormalOpen ? `
      <div class="abnormal-tray">
        ${abnormalTray({ stage: '보류', cards: hold, allCards: state.allOpps })}
        ${abnormalTray({ stage: '드랍', cards: drop, allCards: state.allOpps })}
      </div>
    ` : ''}
  `;
}

function renderBoard() {
  const root = targetEl.querySelector('#kanban-board-root');
  const normalOpps = state.filteredOpps.filter((opp) => 단계목록.includes(opp.현재단계));
  const byStage = groupBy(normalOpps, '현재단계');
  const stageList = state.isolatedStage ? 단계목록.filter((stage) => stage === state.isolatedStage) : 단계목록;
  root.innerHTML = `
    <div class="kanban-board ${state.groupBySchool ? 'is-grouped' : ''}" data-kanban-board>
      ${stageList.map((stage) => stageColumn({
        stage,
        cards: byStage[stage] || [],
        allCards: state.allOpps,
        grouped: state.groupBySchool,
        collapsed: state.collapsedStages.has(stage),
        isolated: Boolean(state.isolatedStage)
      })).join('')}
    </div>
  `;
}

function bindHeaderActions() {
  targetEl.querySelector('#toggle-school-group')?.addEventListener('click', () => {
    state.groupBySchool = !state.groupBySchool;
    const button = targetEl.querySelector('#toggle-school-group');
    button?.setAttribute('aria-pressed', String(state.groupBySchool));
    if (button) button.textContent = state.groupBySchool ? '🏫 학교 단위 묶기 해제' : '🏫 학교 단위 묶기';
    renderBoard();
    bindBoardEvents();
    initSortable();
  });

  targetEl.querySelector('#new-opp-button')?.addEventListener('click', () => openNewOpportunityModal());
}

function bindBoardEvents() {
  targetEl.querySelector('[data-toggle-abnormal]')?.addEventListener('click', () => {
    state.abnormalOpen = !state.abnormalOpen;
    renderAbnormalSummary();
    bindBoardEvents();
    initSortable();
  });

  targetEl.querySelectorAll('[data-toggle-column]').forEach((button) => {
    button.addEventListener('click', () => {
      const stage = button.dataset.toggleColumn;
      if (state.collapsedStages.has(stage)) state.collapsedStages.delete(stage);
      else state.collapsedStages.add(stage);
      renderBoard();
      bindBoardEvents();
      initSortable();
    });
  });

  targetEl.querySelectorAll('[data-column-menu]').forEach((button) => {
    button.addEventListener('click', (event) => openColumnMenu(event.currentTarget, event.currentTarget.dataset.columnMenu));
  });

  targetEl.querySelectorAll('[data-new-opp-stage]').forEach((button) => {
    button.addEventListener('click', () => openNewOpportunityModal(button.dataset.newOppStage));
  });

  targetEl.querySelectorAll('[data-open-detail]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const oppId = event.currentTarget.dataset.openDetail;
      if (oppId) location.hash = `#/opp/${oppId}`;
    });
  });

  targetEl.querySelectorAll('[data-filter-tag]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const tag = event.currentTarget.dataset.filterTag;
      state.filters = { ...state.filters, 태그: [tag], 태그조건: 'OR' };
      applyAndRender();
    });
  });

  targetEl.querySelectorAll('[data-filter-priority]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const priority = event.currentTarget.dataset.filterPriority;
      state.filters = { ...state.filters, 우선순위: [priority] };
      applyAndRender();
    });
  });

  targetEl.querySelectorAll('[data-add-tag]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      openTagPopover(event.currentTarget, event.currentTarget.dataset.addTag);
    });
  });

  targetEl.querySelectorAll('[data-card]').forEach((card) => {
    card.addEventListener('click', (event) => {
      if (event.target.closest('button')) return;
      const oppId = card.dataset.oppId;
      if (oppId) location.hash = `#/opp/${oppId}`;
    });
    card.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openCardContextMenu(event.clientX, event.clientY, card.dataset.oppId);
    });
    card.addEventListener('touchstart', (event) => {
      longPressTimer = window.setTimeout(() => {
        const touch = event.touches[0];
        openCardContextMenu(touch.clientX, touch.clientY, card.dataset.oppId);
      }, 650);
    }, { passive: true });
    ['touchend', 'touchmove', 'touchcancel'].forEach((name) => {
      card.addEventListener(name, () => window.clearTimeout(longPressTimer), { passive: true });
    });
    card.addEventListener('mouseenter', () => highlightSameSchool(card.dataset.schoolId, true));
    card.addEventListener('mouseleave', () => highlightSameSchool(card.dataset.schoolId, false));
  });

  document.addEventListener('click', closeContextMenuOnOutside, { once: true });
}

function initSortable() {
  state.sortableList.forEach((item) => item.destroy?.());
  state.sortableList = [];
  if (state.groupBySchool) return;
  if (!window.Sortable) return;
  targetEl.querySelectorAll('[data-stage-dropzone]').forEach((list) => {
    const sortable = window.Sortable.create(list, {
      group: '학교영업기회',
      animation: 150,
      draggable: '.kanban-card',
      ghostClass: 'is-dragging',
      filter: '.column-add-button',
      onEnd: async (event) => {
        const card = event.item;
        const oppId = card.dataset.oppId;
        const newStage = event.to.dataset.stageDropzone;
        const oldStage = card.dataset.stage;
        if (!oppId || !newStage || newStage === oldStage) return;
        await openStageMoveModal({ oppId, oldStage, newStage });
      }
    });
    state.sortableList.push(sortable);
  });
}

async function openStageMoveModal({ oppId, oldStage, newStage }) {
  const suggestions = suggestedTagsForStageMove(oldStage, newStage);
  const requireNextAction = isNextActionRequired(oldStage, newStage);
  openModal({
    title: `${oldStage} → ${newStage} 단계 이동`,
    body: `
      <form id="stage-move-form" class="modal-form">
        <div class="form-row">
          <label for="stage-reason">이동 사유 선택 입력</label>
          <textarea id="stage-reason" class="textarea" placeholder="예: 자료 요청으로 자료발송 단계 이동"></textarea>
        </div>
        ${suggestions.length ? `
          <div class="form-row">
            <label>자동 부착 제안 태그</label>
            <div class="modal-chip-row">
              ${suggestions.map((tag) => `<label class="check-chip"><input type="checkbox" name="stage-tags" value="${escapeHTML(tag)}" checked /> ${escapeHTML(tag)}</label>`).join('')}
            </div>
          </div>
        ` : ''}
        ${requireNextAction ? `
          <div class="form-row">
            <label for="required-next-action">다음액션 <span class="required-mark">필수</span></label>
            <input id="required-next-action" class="input" required placeholder="예: 방문 일정 확정 전화" />
          </div>
          <div class="form-row">
            <label for="required-next-action-date">다음액션일 <span class="required-mark">필수</span></label>
            <input id="required-next-action-date" class="input" type="date" required />
          </div>
        ` : ''}
        <div class="modal-actions inline">
          <button class="ghost-button" type="button" data-cancel-stage-move>취소</button>
          <button class="primary-button" type="submit">단계 이동 저장</button>
        </div>
      </form>
    `
  });

  const form = document.getElementById('stage-move-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const selectedTags = Array.from(form.querySelectorAll('input[name="stage-tags"]:checked')).map((input) => input.value);
    const reason = document.getElementById('stage-reason')?.value || '';
    const nextAction = document.getElementById('required-next-action')?.value || '';
    const nextActionDate = document.getElementById('required-next-action-date')?.value || '';
    try {
      await callAPI('opp.changeStage', { opp_id: oppId, 새단계: newStage, 사유: reason });
      if (selectedTags.length) await callAPI('opp.addTags', { opp_id: oppId, 태그배열: selectedTags });
      if (nextAction || nextActionDate) {
        await callAPI('activity.create', {
          opp_id: oppId,
          활동유형: '메모',
          활동내용: '단계 이동 후 다음액션 등록',
          다음액션: nextAction,
          다음액션일: nextActionDate
        });
      }
      closeModal();
      toast('단계를 이동했습니다.');
      await reloadOpps();
    } catch (error) {
      toast(error.message || '단계 이동에 실패했습니다.', 'error');
      await reloadOpps();
    }
  });

  document.querySelector('[data-cancel-stage-move]')?.addEventListener('click', async () => {
    closeModal();
    await reloadOpps();
  });
}

function openColumnMenu(button, stage) {
  removeFloatingMenus();
  const rect = button.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.className = 'floating-menu column-floating-menu';
  menu.style.left = `${Math.min(rect.left, window.innerWidth - 260)}px`;
  menu.style.top = `${rect.bottom + 8}px`;
  menu.innerHTML = `
    <button type="button" data-column-action="collapse">컬럼 접기</button>
    <button type="button" data-column-action="isolate">이 컬럼만 보기</button>
    <button type="button" data-column-action="clear-isolate">전체 컬럼 보기</button>
    <button type="button" data-column-action="bulk-move">일괄 단계이동</button>
  `;
  document.body.appendChild(menu);
  menu.addEventListener('click', async (event) => {
    const action = event.target.dataset.columnAction;
    if (!action) return;
    if (action === 'collapse') {
      state.collapsedStages.add(stage);
      renderBoard();
      bindBoardEvents();
      initSortable();
    }
    if (action === 'isolate') {
      state.isolatedStage = stage;
      renderBoard();
      bindBoardEvents();
      initSortable();
    }
    if (action === 'clear-isolate') {
      state.isolatedStage = '';
      renderBoard();
      bindBoardEvents();
      initSortable();
    }
    if (action === 'bulk-move') openBulkMoveModal(stage);
    removeFloatingMenus();
  });
}

function openCardContextMenu(x, y, oppId) {
  removeFloatingMenus();
  const opp = state.allOpps.find((item) => item.opp_id === oppId);
  if (!opp) return;
  const menu = document.createElement('div');
  menu.className = 'floating-menu card-context-menu';
  menu.style.left = `${Math.min(x, window.innerWidth - 300)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - 440)}px`;
  menu.innerHTML = `
    <div class="floating-menu-title">${escapeHTML(opp.기회제목 || '영업기회')}</div>
    <div class="floating-menu-section-title">빠른 단계이동</div>
    ${[...단계목록, ...비정상단계목록].filter((stage) => stage !== opp.현재단계).map((stage) => `<button type="button" data-quick-stage="${escapeHTML(stage)}">${escapeHTML(stage)}</button>`).join('')}
    <div class="floating-menu-section-title">빠른 작업</div>
    <button type="button" data-context-action="tag">태그 추가</button>
    <button type="button" data-context-action="activity">활동 추가</button>
    <button type="button" data-context-action="clone">카드 복제</button>
    <button type="button" data-context-action="hold">보류로 보내기</button>
    <button type="button" data-context-action="drop">드랍</button>
  `;
  document.body.appendChild(menu);
  menu.addEventListener('click', async (event) => {
    const stage = event.target.dataset.quickStage;
    const action = event.target.dataset.contextAction;
    if (stage) {
      removeFloatingMenus();
      await openStageMoveModal({ oppId, oldStage: opp.현재단계, newStage: stage });
      return;
    }
    if (action === 'tag') openTagInputModal(oppId);
    if (action === 'activity') openQuickActivityModal(oppId);
    if (action === 'clone') openCloneModal(oppId);
    if (action === 'hold') await quickChangeStage(oppId, '보류');
    if (action === 'drop') await quickChangeStage(oppId, '드랍');
    removeFloatingMenus();
  });
}

function openTagPopover(anchor, oppId) {
  removeFloatingMenus();
  const rect = anchor.getBoundingClientRect();
  const popover = document.createElement('div');
  popover.className = 'floating-menu tag-popover';
  popover.style.left = `${Math.min(rect.left, window.innerWidth - 320)}px`;
  popover.style.top = `${rect.bottom + 8}px`;
  popover.innerHTML = `
    <div class="floating-menu-title">태그 추가</div>
    <input class="input tag-search-input" placeholder="태그명 입력" />
    <div class="tag-suggestion-list">
      ${기본태그.slice(0, 8).map((tag) => `<button type="button" data-add-suggested-tag="${escapeHTML(tag)}">${escapeHTML(tag)}</button>`).join('')}
    </div>
  `;
  document.body.appendChild(popover);

  popover.querySelector('.tag-search-input')?.addEventListener('input', debounce(async (event) => {
    const prefix = event.target.value.trim();
    const list = popover.querySelector('.tag-suggestion-list');
    if (!prefix) return;
    try {
      const suggestions = await callAPI('tag.suggest', { prefix });
      const tags = suggestions.map((item) => item.태그 || item).filter(Boolean);
      list.innerHTML = [...new Set(tags.concat(prefix))].slice(0, 8).map((tag) => `<button type="button" data-add-suggested-tag="${escapeHTML(tag)}">${escapeHTML(tag)}</button>`).join('');
    } catch (error) {
      list.innerHTML = `<button type="button" data-add-suggested-tag="${escapeHTML(prefix)}">${escapeHTML(prefix)} 추가</button>`;
    }
  }, 240));

  popover.addEventListener('click', async (event) => {
    const tag = event.target.dataset.addSuggestedTag;
    if (!tag) return;
    await addTags(oppId, [tag]);
    removeFloatingMenus();
  });
}

function openTagInputModal(oppId) {
  openModal({
    title: '빠른 태그 추가',
    body: `
      <form id="quick-tag-form" class="modal-form">
        <div class="form-row">
          <label for="quick-tag-input">태그명</label>
          <input id="quick-tag-input" class="input" list="tag-options" placeholder="예: 부재중-재콜필요" required />
          <datalist id="tag-options">${기본태그.map((tag) => `<option value="${escapeHTML(tag)}"></option>`).join('')}</datalist>
        </div>
        <div class="modal-actions inline">
          <button class="primary-button" type="submit">추가</button>
        </div>
      </form>
    `
  });
  document.getElementById('quick-tag-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const tag = document.getElementById('quick-tag-input')?.value.trim();
    if (!tag) return;
    await addTags(oppId, [tag]);
    closeModal();
  });
}

function openQuickActivityModal(oppId) {
  openModal({
    title: '빠른 활동 추가',
    body: `
      <form id="quick-activity-form" class="modal-form">
        <div class="form-row">
          <label for="quick-activity-content">활동내용</label>
          <textarea id="quick-activity-content" class="textarea" required placeholder="예: 부장 선생님 부재로 3일 뒤 재콜"></textarea>
        </div>
        <div class="form-row">
          <label for="quick-next-action">다음액션</label>
          <input id="quick-next-action" class="input" placeholder="예: 재콜" />
        </div>
        <div class="form-row">
          <label for="quick-next-action-date">다음액션일</label>
          <input id="quick-next-action-date" class="input" type="date" />
        </div>
        <div class="modal-actions inline"><button class="primary-button" type="submit">저장</button></div>
      </form>
    `
  });
  document.getElementById('quick-activity-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await callAPI('activity.create', {
        opp_id: oppId,
        활동유형: '메모',
        활동내용: document.getElementById('quick-activity-content')?.value || '',
        다음액션: document.getElementById('quick-next-action')?.value || '',
        다음액션일: document.getElementById('quick-next-action-date')?.value || ''
      });
      closeModal();
      toast('활동을 추가했습니다.');
      await reloadOpps();
    } catch (error) {
      toast(error.message || '활동 추가에 실패했습니다.', 'error');
    }
  });
}

function openCloneModal(oppId) {
  const opp = state.allOpps.find((item) => item.opp_id === oppId);
  openModal({
    title: '카드 복제',
    body: `
      <p class="modal-help">같은 학교의 다른 부서로 복제할 때 사용합니다. 현재 Phase 3에서는 부서명만 새로 입력하는 간편 복제입니다.</p>
      <form id="clone-form" class="modal-form">
        <div class="form-row"><label for="clone-dept">새 부서명</label><input id="clone-dept" class="input" required placeholder="예: 창체부" /></div>
        <div class="modal-actions inline"><button class="primary-button" type="submit">복제</button></div>
      </form>
    `
  });
  document.getElementById('clone-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await callAPI('opp.create', {
        ...opp,
        opp_id: undefined,
        dept_id: `${opp.dept_id || 'D'}-복제`,
        부서명_신규: document.getElementById('clone-dept')?.value || '새 부서',
        기회제목: `${opp.학교?.학교명 || '학교'}-${document.getElementById('clone-dept')?.value || '새 부서'}-${opp.관심프로그램 || '프로그램'}`,
        현재단계: '리드'
      });
      closeModal();
      toast('카드를 복제했습니다.');
      await reloadOpps();
    } catch (error) {
      toast(error.message || '복제에 실패했습니다.', 'error');
    }
  });
}

function openBulkMoveModal(stage) {
  const count = state.filteredOpps.filter((opp) => opp.현재단계 === stage).length;
  openModal({
    title: `${stage} 일괄 단계이동`,
    body: `
      <form id="bulk-move-form" class="modal-form">
        <p class="modal-help">현재 필터 결과 중 ${stage} 단계 ${count}건을 선택한 단계로 이동합니다.</p>
        <div class="form-row">
          <label for="bulk-stage-select">이동할 단계</label>
          <select id="bulk-stage-select" class="select">
            ${[...단계목록, ...비정상단계목록].filter((item) => item !== stage).map((item) => `<option value="${escapeHTML(item)}">${escapeHTML(item)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row"><label for="bulk-reason">사유</label><textarea id="bulk-reason" class="textarea"></textarea></div>
        <div class="modal-actions inline"><button class="primary-button" type="submit">일괄 이동</button></div>
      </form>
    `
  });
  document.getElementById('bulk-move-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const toStage = document.getElementById('bulk-stage-select')?.value;
    const reason = document.getElementById('bulk-reason')?.value || '일괄 단계이동';
    const targets = state.filteredOpps.filter((opp) => opp.현재단계 === stage);
    try {
      for (const opp of targets) {
        await callAPI('opp.changeStage', { opp_id: opp.opp_id, 새단계: toStage, 사유: reason });
      }
      closeModal();
      toast(`${targets.length}건을 이동했습니다.`);
      await reloadOpps();
    } catch (error) {
      toast(error.message || '일괄 이동 중 오류가 발생했습니다.', 'error');
      await reloadOpps();
    }
  });
}

function openNewOpportunityModal(defaultStage = '리드') {
  const schools = Object.values(groupBy(state.allOpps, 'school_id')).map((list) => list[0]?.학교).filter(Boolean);
  openModal({
    title: '새 영업기회 추가',
    body: `
      <form id="new-opp-form" class="modal-form">
        <div class="form-row">
          <label for="new-school">기존 학교 선택</label>
          <select id="new-school" class="select" required>
            ${schools.map((school) => `<option value="${escapeHTML(school.school_id)}">${escapeHTML(school.학교명)} · ${escapeHTML(school.지역_구 || '')}</option>`).join('')}
          </select>
        </div>
        <div class="form-row"><label for="new-dept">부서명</label><input id="new-dept" class="input" required placeholder="예: 진로부" /></div>
        <div class="form-row"><label for="new-contact">담당자명</label><input id="new-contact" class="input" placeholder="예: 김선생" /></div>
        <div class="form-row">
          <label for="new-program">관심프로그램</label>
          <select id="new-program" class="select">
            ${['흑백창업가', '필터버블 탈출', 'Re_Brain / 팝콘브레인', 'MDC + 진로빅데이터', '핑퐁로봇', '존중의숲', '습관추론게임', 'AI 리터러시 미니제안', '자기주도학습 비밀노트', '헤이븐월드 RPG', '캡스톤 디자인', '기타 커스텀'].map((item) => `<option>${escapeHTML(item)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row"><label for="new-tags">태그</label><input id="new-tags" class="input" placeholder="쉼표로 구분" /></div>
        <div class="form-row"><label for="new-note">메모</label><textarea id="new-note" class="textarea"></textarea></div>
        <div class="modal-actions inline"><button class="primary-button" type="submit">새 기회 생성</button></div>
      </form>
    `
  });

  document.getElementById('new-opp-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const schoolId = document.getElementById('new-school')?.value;
    const school = schools.find((item) => item.school_id === schoolId);
    const deptName = document.getElementById('new-dept')?.value || '부서 미지정';
    const program = document.getElementById('new-program')?.value || '기타 커스텀';
    try {
      await callAPI('opp.create', {
        school_id: schoolId,
        부서명_신규: deptName,
        담당자명_신규: document.getElementById('new-contact')?.value || '',
        기회제목: `${school?.학교명 || '학교'}-${deptName}-${program}`,
        현재단계: defaultStage,
        관심프로그램: program,
        우선순위: 'C',
        태그_JSON: JSON.stringify((document.getElementById('new-tags')?.value || '').split(',').map((item) => item.trim()).filter(Boolean)),
        기회메모: document.getElementById('new-note')?.value || '',
        예상금액: 0
      });
      closeModal();
      toast('새 영업기회를 생성했습니다.');
      await reloadOpps();
    } catch (error) {
      toast(error.message || '영업기회 생성에 실패했습니다.', 'error');
    }
  });
}

async function addTags(oppId, tags) {
  try {
    await callAPI('opp.addTags', { opp_id: oppId, 태그배열: tags });
    toast('태그를 추가했습니다.');
    await reloadOpps();
  } catch (error) {
    toast(error.message || '태그 추가에 실패했습니다.', 'error');
  }
}

async function quickChangeStage(oppId, stage) {
  const opp = state.allOpps.find((item) => item.opp_id === oppId);
  if (!opp) return;
  try {
    await callAPI('opp.changeStage', { opp_id: oppId, 새단계: stage, 사유: '컨텍스트 메뉴 빠른 이동' });
    toast(`${stage} 단계로 이동했습니다.`);
    await reloadOpps();
  } catch (error) {
    toast(error.message || '단계 이동에 실패했습니다.', 'error');
  }
}

async function reloadOpps() {
  const opps = await callAPI('opp.list', {});
  state.allOpps = normalizeOpportunities(opps);
  applyAndRender();
}

function normalizeOpportunities(opps = []) {
  return opps.map((opp) => {
    const stagnation = calculateStagnation(opp);
    return {
      ...opp,
      ...stagnation,
      태그목록: parseTags(opp.태그_JSON)
    };
  });
}

function highlightSameSchool(schoolId, active) {
  if (!schoolId) return;
  targetEl.querySelectorAll(`[data-school-id="${CSS.escape(schoolId)}"]`).forEach((el) => {
    el.classList.toggle('same-school-highlight', active);
  });
}

function closeContextMenuOnOutside(event) {
  if (event.target.closest('.floating-menu')) {
    document.addEventListener('click', closeContextMenuOnOutside, { once: true });
    return;
  }
  removeFloatingMenus();
}

function removeFloatingMenus() {
  document.querySelectorAll('.floating-menu').forEach((menu) => menu.remove());
}
