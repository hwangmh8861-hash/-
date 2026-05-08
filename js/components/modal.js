import { escapeHTML } from '../utils.js';

export function openModal({ title = '알림', body = '', actions = '' } = {}) {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.innerHTML = `
    <div class="modal-backdrop" data-modal-close="true">
      <section class="modal-card" role="dialog" aria-modal="true" aria-label="${escapeHTML(title)}">
        <div class="modal-head">
          <h2 class="modal-title">${escapeHTML(title)}</h2>
          <button class="icon-button" type="button" data-modal-close="true" aria-label="닫기">×</button>
        </div>
        <div class="modal-body">${body}</div>
        ${actions ? `<div class="modal-actions">${actions}</div>` : ''}
      </section>
    </div>
  `;
  root.addEventListener('click', onCloseClick, { once: true });
}

export function closeModal() {
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
}

function onCloseClick(event) {
  if (event.target.dataset.modalClose === 'true') closeModal();
  else document.getElementById('modal-root')?.addEventListener('click', onCloseClick, { once: true });
}
