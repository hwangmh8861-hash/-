import { callAPI } from '../api.js';
import { escapeHTML, formatDate } from '../utils.js';
import { toast } from '../components/toast.js';

let reports = [];
let selected = null;

export async function render(target) {
  reports = await callAPI('reports.list');
  selected = selected || reports[0]?.report_id || '';
  const current = selected ? await callAPI('reports.get', { report_id: selected }) : null;
  target.innerHTML = renderShell(current);
  bindEvents(target);
}

function renderShell(current) {
  return `
    <section class="page-head">
      <div>
        <h1 class="page-title">월간 리포트</h1>
        <p class="page-desc">매월 1일 자동 생성되는 영업 성과 리포트를 열람합니다.</p>
      </div>
      <button id="generate-report" class="primary-button" type="button">이번달 리포트 생성</button>
    </section>
    <div class="ops-grid two" style="grid-template-columns: 340px minmax(0, 1fr);">
      <aside class="ops-card">
        <h2>리포트 목록</h2>
        <div class="report-list">
          ${reports.map((report) => `
            <button class="report-item" type="button" data-report-id="${escapeHTML(report.report_id)}">
              <span><strong>${escapeHTML(report.제목)}</strong><br><small>${formatDate(report.생성일)} · ${escapeHTML(report.기간)}</small></span>
              <span>열기</span>
            </button>
          `).join('') || '<p>아직 생성된 리포트가 없습니다.</p>'}
        </div>
      </aside>
      <main class="report-viewer">
        ${current ? current.html : '<p>왼쪽에서 리포트를 선택하거나 새 리포트를 생성하세요.</p>'}
      </main>
    </div>
  `;
}

function bindEvents(target) {
  target.addEventListener('click', async (event) => {
    const reportButton = event.target.closest('[data-report-id]');
    if (reportButton) {
      selected = reportButton.dataset.reportId;
      return render(target);
    }
    if (event.target.id === 'generate-report') {
      const result = await callAPI('reports.generate', { month: new Date().toISOString().slice(0, 7) });
      selected = result.report_id;
      toast('리포트를 생성했습니다.');
      return render(target);
    }
  });
}
