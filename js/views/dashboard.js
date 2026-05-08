import { callAPI } from '../api.js';
import { escapeHTML, formatWon, groupBy, parseJSON } from '../utils.js';
import { toast } from '../components/toast.js';
import { openModal } from '../components/modal.js';
import { kpiCard } from '../components/kpiCard.js';
import { createBarChart, createDoughnutChart, destroyCharts, palette, cssVar } from '../components/chart.js';
import { stageBadge, priorityBadge, tagBadges } from '../components/badge.js';

const 정상단계 = ['리드', 'TM시도', '자료발송', 'EVD예정', 'EVD완료', '제안서발송', '계약검토', '계약완료'];
const 전환흐름 = [
  { id: 'tm-evd', label: 'TM → EVD', from: 'TM시도', to: ['EVD예정', 'EVD완료'], summaryKey: '전환율_TM_to_EVD' },
  { id: 'evd-proposal', label: 'EVD → 제안', from: 'EVD완료', to: ['제안서발송'], summaryKey: '전환율_EVD_to_제안' },
  { id: 'proposal-contract', label: '제안 → 계약', from: '제안서발송', to: ['계약완료'], summaryKey: '전환율_제안_to_계약' }
];

let dashboardTarget = null;
let state = { summary: null, opps: [] };

export async function render(target) {
  dashboardTarget = target;
  destroyCharts('dashboard-');
  target.innerHTML = `
    <section class="page-head dashboard-head">
      <div>
        <h1 class="page-title">대시보드</h1>
        <p class="page-desc">이번 달 성과, 이번 주 액션, 정체 리스크와 지역·프로그램별 파이프라인을 한 화면에서 확인합니다.</p>
      </div>
      <div class="dashboard-actions">
        <button id="dashboard-refresh" class="ghost-button" type="button">새로고침</button>
        <a class="primary-button" href="#/list">리스트로 보기</a>
      </div>
    </section>
    <div id="dashboard-root"><div class="placeholder">대시보드 데이터를 불러오는 중입니다.</div></div>
  `;
  target.querySelector('#dashboard-refresh')?.addEventListener('click', () => loadAndRender());
  await loadAndRender();
}

async function loadAndRender() {
  const root = dashboardTarget.querySelector('#dashboard-root');
  root.innerHTML = '<div class="placeholder">대시보드 데이터를 불러오는 중입니다.</div>';
  try {
    const [summary, opps] = await Promise.all([
      callAPI('dashboard.summary', {}),
      callAPI('opp.list', {})
    ]);
    state.summary = summary;
    state.opps = normalizeOpps(opps);
    root.innerHTML = dashboardTemplate(summary, state.opps);
    bindDashboard(root);
    renderCharts(summary, state.opps);
  } catch (error) {
    root.innerHTML = `<div class="placeholder">대시보드를 불러오지 못했습니다.<br>${escapeHTML(error.message)}</div>`;
  }
}

function dashboardTemplate(summary, opps) {
  const currentMonth = getMonthPrefix(new Date());
  const 신규 = opps.filter((opp) => String(opp.생성일 || '').startsWith(currentMonth)).length || summary.이번달_신규리드수 || 0;
  const evd = summary.이번달_EVD완료수 || opps.filter((opp) => opp.현재단계 === 'EVD완료').length;
  const contract = summary.이번달_계약완료수 || opps.filter((opp) => opp.현재단계 === '계약완료').length;
  const activeAmount = summary.활성파이프라인_총예상금액 || opps.filter((opp) => !['계약완료', '드랍'].includes(opp.현재단계)).reduce((sum, opp) => sum + Number(opp.예상금액 || 0), 0);

  return `
    <section class="kpi-grid">
      ${kpiCard({ id: 'new-leads', label: '이번달 신규 리드', value: 신규, delta: 5, hint: '생성일 기준' })}
      ${kpiCard({ id: 'evd-done', label: '이번달 EVD 완료', value: evd, delta: -2, hint: '단계 기준' })}
      ${kpiCard({ id: 'contract-done', label: '이번달 계약완료', value: contract, delta: 0, hint: '계약완료 단계' })}
      ${kpiCard({ id: 'active-amount', label: '활성 파이프라인', value: compactWon(activeAmount), delta: 0, hint: '계약완료·드랍 제외' })}
    </section>

    <section class="dashboard-main-grid">
      <article class="dashboard-panel panel-pipeline">
        <div class="panel-head"><h2>단계별 파이프라인</h2><span>막대 클릭 시 칸반 필터 적용</span></div>
        <div class="chart-box"><canvas id="dashboard-pipeline-chart"></canvas></div>
        <div class="pipeline-legend">${renderStageRows(opps)}</div>
      </article>

      <article class="dashboard-panel panel-weekly">
        <div class="panel-head"><h2>이번 주 액션</h2><button class="text-button" type="button" data-list-filter="week-action">전체 보기</button></div>
        ${renderWeeklyActions(opps)}
      </article>

      <article class="dashboard-panel panel-stale">
        <div class="panel-head"><h2>정체 알림</h2><span>정체일수 큰 순 TOP 20</span></div>
        <div class="bulk-line">
          <button class="ghost-button small" type="button" data-stale-hold>선택 항목을 보류로 이동</button>
          <button class="ghost-button small" type="button" data-stale-recall>재콜 태그 일괄 부착</button>
        </div>
        ${renderStaleList(opps)}
      </article>

      <article class="dashboard-panel panel-conversion">
        <div class="panel-head"><h2>월간 전환율</h2><span>전월 대비 증감 목업 포함</span></div>
        ${renderConversions(summary, opps)}
      </article>
    </section>

    <section class="dashboard-sub-grid">
      <article class="dashboard-panel">
        <div class="panel-head"><h2>태그 분포</h2><span>활성 카드 기준 TOP 5</span></div>
        <div class="chart-box small"><canvas id="dashboard-tag-chart"></canvas></div>
        ${renderTopTags(opps)}
      </article>
      <article class="dashboard-panel">
        <div class="panel-head"><h2>지역별 파이프라인</h2><span>시·구 단위 카드수와 금액</span></div>
        <div class="chart-box small"><canvas id="dashboard-region-chart"></canvas></div>
      </article>
      <article class="dashboard-panel wide">
        <div class="panel-head"><h2>관심프로그램별 진척</h2><span>프로그램별 단계 분포</span></div>
        <div class="chart-box small"><canvas id="dashboard-program-chart"></canvas></div>
      </article>
    </section>
  `;
}

function bindDashboard(root) {
  root.querySelectorAll('[data-kpi-id]').forEach((button) => {
    button.addEventListener('click', () => applyKpiFilter(button.dataset.kpiId));
  });

  root.querySelector('[data-list-filter="week-action"]')?.addEventListener('click', () => {
    savePendingListFilter({ 기간: '이번주액션' });
    location.hash = '#/list';
  });

  root.querySelector('[data-stale-hold]')?.addEventListener('click', () => bulkStale('보류'));
  root.querySelector('[data-stale-recall]')?.addEventListener('click', () => bulkRecallTag());

  root.querySelectorAll('[data-opp-link]').forEach((row) => {
    row.addEventListener('click', (event) => {
      if (event.target.closest('input')) return;
      location.hash = `#/opp/${row.dataset.oppLink}`;
    });
  });

  root.querySelectorAll('[data-conversion-id]').forEach((button) => {
    button.addEventListener('click', () => openConversionDrilldown(button.dataset.conversionId));
  });

  root.querySelectorAll('[data-stage-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      savePendingKanbanFilter({ 단계: [button.dataset.stageFilter] });
      location.hash = '#/';
    });
  });
}

function renderCharts(summary, opps) {
  const stageStats = 정상단계.map((stage) => {
    const list = opps.filter((opp) => opp.현재단계 === stage);
    return { stage, count: list.length, amount: list.reduce((sum, opp) => sum + Number(opp.예상금액 || 0), 0) };
  });
  const pipelineChart = createBarChart(document.getElementById('dashboard-pipeline-chart'), {
    labels: stageStats.map((item) => item.stage),
    datasets: [
      { label: '카드수', data: stageStats.map((item) => item.count), backgroundColor: stageStats.map((item) => stageColor(item.stage)) }
    ],
    onClick: (_, elements) => {
      const index = elements?.[0]?.index;
      if (index === undefined) return;
      const stage = stageStats[index]?.stage;
      if (!stage) return;
      savePendingKanbanFilter({ 단계: [stage] });
      location.hash = '#/';
    }
  });
if (pipelineChart) {
  pipelineChart.options.plugins.tooltip.callbacks = {
    label: (context) => {
      const stat = stageStats[context.dataIndex];
      return `${stat.count}건 · ${formatWon(stat.amount)}`;
    }
  };
  pipelineChart.update();
}
  const topTags = tagCounts(opps).slice(0, 5);
  createDoughnutChart(document.getElementById('dashboard-tag-chart'), {
    labels: topTags.map((item) => item.tag),
    data: topTags.map((item) => item.count)
  });

  const regionStats = Object.entries(groupBy(opps, (opp) => `${opp.학교?.지역_시 || ''} ${opp.학교?.지역_구 || '미지정'}`.trim()))
    .map(([region, list]) => ({ region, count: list.length, amount: list.reduce((sum, opp) => sum + Number(opp.예상금액 || 0), 0) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  createBarChart(document.getElementById('dashboard-region-chart'), {
    labels: regionStats.map((item) => item.region),
    datasets: [{ label: '카드수', data: regionStats.map((item) => item.count), backgroundColor: cssVar('--tag-info') }]
  });

  const programs = Object.entries(groupBy(opps, '관심프로그램')).sort((a, b) => b[1].length - a[1].length).slice(0, 8);
  const colors = palette();
  createBarChart(document.getElementById('dashboard-program-chart'), {
    labels: programs.map(([program]) => program),
    stacked: true,
    datasets: 정상단계.slice(0, 7).map((stage, index) => ({
      label: stage,
      data: programs.map(([, list]) => list.filter((opp) => opp.현재단계 === stage).length),
      backgroundColor: colors[index % colors.length]
    }))
  });
}

function renderStageRows(opps) {
  return 정상단계.map((stage) => {
    const list = opps.filter((opp) => opp.현재단계 === stage);
    const amount = list.reduce((sum, opp) => sum + Number(opp.예상금액 || 0), 0);
    return `<button class="stage-stat-row" type="button" data-stage-filter="${escapeHTML(stage)}"><span>${escapeHTML(stage)}</span><strong>${list.length}건</strong><em>${formatWon(amount)}</em></button>`;
  }).join('');
}

function renderWeeklyActions(opps) {
  const list = opps.filter((opp) => isWithinDays(opp.다음액션일, 7)).sort((a, b) => String(a.다음액션일).localeCompare(String(b.다음액션일)));
  if (!list.length) return '<div class="empty-state">이번 주 다음액션이 없습니다.</div>';
  const grouped = groupBy(list, (opp) => dayGroup(opp.다음액션일));
  return `<div class="action-list">${Object.entries(grouped).map(([group, items]) => `
    <div class="action-group">
      <h3>${escapeHTML(group)}</h3>
      ${items.map((opp) => `
        <button class="action-row" type="button" data-opp-link="${escapeHTML(opp.opp_id)}">
          <span><strong>${escapeHTML(opp.학교?.학교명 || '-')}</strong> · ${escapeHTML(opp.부서?.부서명 || '-')}</span>
          <span>${escapeHTML(opp.다음액션 || '다음액션 미정')}</span>
          <em>${dDay(opp.다음액션일)}</em>
          ${priorityBadge(opp.우선순위)}
        </button>
      `).join('')}
    </div>
  `).join('')}</div>`;
}

function renderStaleList(opps) {
  const stale = opps.filter((opp) => opp.정체여부).sort((a, b) => Number(b.정체일수 || 0) - Number(a.정체일수 || 0)).slice(0, 20);
  if (!stale.length) return '<div class="empty-state">정체 알림 대상이 없습니다.</div>';
  return `<div class="stale-list">${stale.map((opp) => `
    <label class="stale-row" data-opp-link="${escapeHTML(opp.opp_id)}">
      <input type="checkbox" data-stale-select value="${escapeHTML(opp.opp_id)}" />
      <span><strong>${escapeHTML(opp.학교?.학교명 || '-')}</strong> · ${escapeHTML(opp.부서?.부서명 || '-')}</span>
      ${stageBadge(opp.현재단계)}
      <em>정체 ${Number(opp.정체일수 || 0)}일</em>
      <small>마지막활동 ${escapeHTML(opp.마지막활동일 || '-')}</small>
    </label>
  `).join('')}</div>`;
}

function renderConversions(summary, opps) {
  return `<div class="conversion-list">${전환흐름.map((flow, index) => {
    const fromCount = opps.filter((opp) => opp.현재단계 === flow.from).length;
    const toCount = opps.filter((opp) => flow.to.includes(opp.현재단계)).length;
    const rate = Math.round(Number(summary[flow.summaryKey] ?? (fromCount ? toCount / (fromCount + toCount) : 0)) * 100);
    const delta = [6, -3, 0][index];
    return `
      <button class="conversion-card" type="button" data-conversion-id="${flow.id}">
        <span>${escapeHTML(flow.label)}</span>
        <strong>${rate}%</strong>
        <div class="conversion-bar"><i style="width:${Math.max(4, Math.min(100, rate))}%"></i></div>
        <em class="${delta > 0 ? 'up' : delta < 0 ? 'down' : 'same'}">전월 대비 ${delta > 0 ? '+' : ''}${delta}%p</em>
      </button>
    `;
  }).join('')}</div>`;
}

function renderTopTags(opps) {
  const tags = tagCounts(opps).slice(0, 5);
  if (!tags.length) return '<div class="empty-state">태그 데이터가 없습니다.</div>';
  return `<div class="tag-rank-list">${tags.map((item, index) => `<div><strong>${index + 1}</strong><span>${escapeHTML(item.tag)}</span><em>${item.count}건</em></div>`).join('')}</div>`;
}

async function bulkStale(stage) {
  const ids = selectedStaleIds();
  if (!ids.length) return toast('선택된 정체 항목이 없습니다.', 'info');
  await Promise.all(ids.map((opp_id) => callAPI('opp.changeStage', { opp_id, 새단계: stage, 사유: '대시보드 정체 알림 일괄 처리' })));
  toast(`${ids.length}건을 ${stage} 단계로 이동했습니다.`, 'success');
  await loadAndRender();
}

async function bulkRecallTag() {
  const ids = selectedStaleIds();
  if (!ids.length) return toast('선택된 정체 항목이 없습니다.', 'info');
  await Promise.all(ids.map((opp_id) => callAPI('opp.addTags', { opp_id, 태그배열: ['부재중-재콜필요'] })));
  toast(`${ids.length}건에 재콜 태그를 부착했습니다.`, 'success');
  await loadAndRender();
}

function selectedStaleIds() {
  return Array.from(dashboardTarget.querySelectorAll('[data-stale-select]:checked')).map((input) => input.value);
}

function applyKpiFilter(id) {
  const filterMap = {
    'new-leads': { 생성월: getMonthPrefix(new Date()) },
    'evd-done': { 단계: ['EVD완료'] },
    'contract-done': { 단계: ['계약완료'] },
    'active-amount': { 제외단계: ['계약완료', '드랍'] }
  };
  savePendingListFilter(filterMap[id] || {});
  location.hash = '#/list';
}

function openConversionDrilldown(id) {
  const flow = 전환흐름.find((item) => item.id === id);
  if (!flow) return;
  const from = state.opps.filter((opp) => opp.현재단계 === flow.from);
  const to = state.opps.filter((opp) => flow.to.includes(opp.현재단계));
  const dropped = state.opps.filter((opp) => ['보류', '드랍'].includes(opp.현재단계));
  openModal({
    title: `${flow.label} 드릴다운`,
    body: `
      <div class="drilldown-grid">
        <div><strong>${escapeHTML(flow.from)}</strong><span>${from.length}건</span></div>
        <div><strong>${escapeHTML(flow.to.join('/'))}</strong><span>${to.length}건</span></div>
        <div><strong>보류·드랍</strong><span>${dropped.length}건</span></div>
      </div>
      <p class="muted-text">실제 전환율 분석은 활동 로그의 단계변경 이력을 기준으로 고도화할 수 있습니다. 현재 Phase 4에서는 현재 단계 분포와 Phase 1 summary 값을 함께 사용합니다.</p>
    `
  });
}

function normalizeOpps(opps = []) {
  return opps.map((opp) => ({
    ...opp,
    태그목록: parseJSON(opp.태그_JSON, []),
    학교: opp.학교 || {},
    부서: opp.부서 || {}
  }));
}

function tagCounts(opps) {
  const counts = {};
  opps.filter((opp) => !['계약완료', '드랍'].includes(opp.현재단계)).forEach((opp) => {
    parseJSON(opp.태그_JSON, []).forEach((tag) => { counts[tag] = (counts[tag] || 0) + 1; });
  });
  return Object.entries(counts).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
}

function isWithinDays(value, days) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diff = Math.ceil((date - today) / 86400000);
  return diff >= 0 && diff <= days;
}

function dayGroup(value) {
  const diff = dDayNumber(value);
  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  return '이번주';
}

function dDay(value) {
  const diff = dDayNumber(value);
  if (diff === 0) return 'D-Day';
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}

function dDayNumber(value) {
  const date = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date - today) / 86400000);
}

function getMonthPrefix(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function compactWon(value) {
  const number = Number(value || 0);
  if (number >= 100000000) return `${Math.round(number / 100000000)}억`;
  if (number >= 10000) return `${Math.round(number / 10000).toLocaleString('ko-KR')}만`;
  return number.toLocaleString('ko-KR');
}

function stageColor(stage) {
  const map = {
    '리드': '--stage-lead', 'TM시도': '--stage-tm', '자료발송': '--stage-material', 'EVD예정': '--stage-evd-scheduled',
    'EVD완료': '--stage-evd-done', '제안서발송': '--stage-proposal', '계약검토': '--stage-contract-review', '계약완료': '--stage-contract-done'
  };
  return cssVar(map[stage] || '--tag-neutral');
}

function savePendingListFilter(filter) {
  localStorage.setItem('crm_pending_list_filter', JSON.stringify(filter));
}

function savePendingKanbanFilter(filter) {
  localStorage.setItem('crm_pending_kanban_filter', JSON.stringify(filter));
}
