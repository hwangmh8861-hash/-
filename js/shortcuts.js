import { openModal, closeModal } from './components/modal.js';
import { toast } from './components/toast.js';

let sequence = '';
let timer = null;

export function attachShortcuts() {
  window.addEventListener('keydown', handleKeydown);
}

function handleKeydown(event) {
  const target = event.target;
  const isTextInput = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    document.getElementById('global-search')?.focus();
    return;
  }

  if (isTextInput) return;

  if (event.key === '?') {
    event.preventDefault();
    openShortcutHelp();
    return;
  }

  const key = event.key.toLowerCase();
  if (key === 'n') {
    event.preventDefault();
    window.dispatchEvent(new CustomEvent('crm:new-opportunity'));
    toast('새 기회 생성 창을 열었습니다.');
    return;
  }

  if (key === 'f') {
    event.preventDefault();
    document.querySelector('[data-filter-focus="true"], .filter-search, .search-input')?.focus();
    return;
  }

  if (key === 't') {
    event.preventDefault();
    window.dispatchEvent(new CustomEvent('crm:toggle-school-grouping'));
    return;
  }

  if (/^[1-8]$/.test(key)) {
    event.preventDefault();
    window.dispatchEvent(new CustomEvent('crm:shortcut-number', { detail: Number(key) }));
    return;
  }

  if (['e', 'a', 's'].includes(key) && location.hash.startsWith('#/school')) {
    event.preventDefault();
    const map = { e: 'crm:detail-edit', a: 'crm:detail-add-activity', s: 'crm:detail-change-stage' };
    window.dispatchEvent(new CustomEvent(map[key]));
    return;
  }

  if (key === 'g') {
    sequence = 'g';
    clearTimeout(timer);
    timer = setTimeout(() => { sequence = ''; }, 900);
    return;
  }

  if (sequence === 'g') {
    const routeMap = { k: '#/', d: '#/dashboard', l: '#/list' };
    if (routeMap[key]) {
      event.preventDefault();
      location.hash = routeMap[key];
      sequence = '';
      return;
    }
  }
}

function openShortcutHelp() {
  openModal({
    title: '단축키 도움말',
    body: `
      <div class="shortcut-help-grid">
        <section>
          <h3>전역</h3>
          <p><kbd>Ctrl/⌘</kbd> + <kbd>K</kbd> 글로벌 검색</p>
          <p><kbd>G</kbd> + <kbd>K</kbd> 칸반으로 이동</p>
          <p><kbd>G</kbd> + <kbd>D</kbd> 대시보드로 이동</p>
          <p><kbd>G</kbd> + <kbd>L</kbd> 리스트로 이동</p>
          <p><kbd>N</kbd> 새 기회 생성</p>
          <p><kbd>?</kbd> 단축키 도움말</p>
        </section>
        <section>
          <h3>칸반</h3>
          <p><kbd>F</kbd> 필터 바 포커스</p>
          <p><kbd>1</kbd>~<kbd>8</kbd> 단계 컬럼 점프</p>
          <p><kbd>T</kbd> 학교 단위 묶음 토글</p>
        </section>
        <section>
          <h3>상세 페이지</h3>
          <p><kbd>E</kbd> 편집 모드</p>
          <p><kbd>A</kbd> 활동 추가</p>
          <p><kbd>S</kbd> 단계 변경</p>
          <p><kbd>1</kbd>~<kbd>4</kbd> 탭 전환</p>
        </section>
      </div>
    `,
    actions: `<button class="primary-button" type="button" data-modal-close="true">확인</button>`
  });
  document.querySelector('[data-modal-close="true"]')?.addEventListener('click', closeModal, { once: true });
}
