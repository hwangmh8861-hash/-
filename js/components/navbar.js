import { callAPI } from '../api.js';
import { clearToken } from '../auth.js';
import { debounce, escapeHTML } from '../utils.js';
import { toast } from './toast.js';

const tabs = [
  { href: '#/', label: '칸반' },
  { href: '#/dashboard', label: '대시보드' },
  { href: '#/list', label: '리스트' },
  { href: '#/import', label: '임포트' },
  { href: '#/migrate', label: '이관' },
  { href: '#/reports', label: '리포트' },
  { href: '#/settings', label: '설정' },
  { href: '#/help', label: '도움말' }
];

export function renderNavbar(currentHash = location.hash) {
  const active = currentHash || '#/';
  return `
    <nav class="navbar" aria-label="전역 메뉴">
      <a class="brand" href="#/" aria-label="학교영업CRM 홈">
        <span class="brand-mark">영</span>
        <span>학교영업CRM</span>
      </a>
      <div class="nav-tabs">
        ${tabs.map((tab) => `
          <a class="nav-tab ${isActive(active, tab.href) ? 'is-active' : ''}" href="${tab.href}">${tab.label}</a>
        `).join('')}
      </div>
      <div class="nav-actions">
        <div class="search-wrap">
          <input id="global-search" class="search-input" type="search" placeholder="학교·기회·담당자 검색" autocomplete="off" />
          <div id="global-search-panel" class="search-panel" hidden></div>
        </div>
        <button id="theme-toggle" class="icon-button" type="button" aria-label="테마 전환">◐</button>
        <button id="logout-button" class="text-button" type="button">로그아웃</button>
      </div>
    </nav>
  `;
}

export function bindNavbar() {
  const input = document.getElementById('global-search');
  const panel = document.getElementById('global-search-panel');
  const themeButton = document.getElementById('theme-toggle');
  const logoutButton = document.getElementById('logout-button');

  themeButton?.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('crm_theme', next);
    toast(next === 'dark' ? '다크 모드로 전환했습니다.' : '라이트 모드로 전환했습니다.');
  });

  logoutButton?.addEventListener('click', () => {
    clearToken();
    toast('로그아웃되었습니다.');
    location.hash = '#/login';
  });

  input?.addEventListener('input', debounce(async (event) => {
    const keyword = event.target.value.trim();
    if (!keyword) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }
    try {
      const result = await callAPI('search.global', { 검색어: keyword });
      panel.innerHTML = renderSearchResult(result);
      panel.hidden = false;
    } catch (error) {
      panel.innerHTML = `<div class="empty-state">검색 중 오류가 발생했습니다.</div>`;
      panel.hidden = false;
    }
  }, 300));

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.search-wrap') && panel) panel.hidden = true;
  });
}

function isActive(current, href) {
  if (href === '#/') return current === '#/' || current === '';
  return current.startsWith(href);
}

function renderSearchResult(result = {}) {
  const schools = result.schools || [];
  const opps = result.opps || [];
  const contacts = result.contacts || [];
  if (!schools.length && !opps.length && !contacts.length) {
    return `<div class="empty-state">검색 결과가 없습니다.</div>`;
  }
  return `
    ${renderGroup('학교', schools, (item) => ({
      href: `#/school/${item.school_id}`,
      title: item.학교명,
      sub: `${item.지역_시 || ''} ${item.지역_구 || ''} · ${item.학교유형 || ''}`
    }))}
    ${renderGroup('영업기회', opps, (item) => ({
      href: `#/opp/${item.opp_id}`,
      title: item.기회제목,
      sub: `${item.현재단계 || ''} · ${item.관심프로그램 || ''}`
    }))}
    ${renderGroup('담당자', contacts, (item) => ({
      href: `#/school/${item.school_id}`,
      title: item.이름,
      sub: `${item.직책 || ''} · ${item.이메일 || ''}`
    }))}
  `;
}

function renderGroup(title, list, mapper) {
  if (!list.length) return '';
  return `
    <div class="search-group">
      <div class="search-group-title">${title}</div>
      ${list.map((item) => {
        const mapped = mapper(item);
        return `
          <a class="search-item" href="${escapeHTML(mapped.href)}">
            <strong>${escapeHTML(mapped.title || '제목 없음')}</strong>
            <span>${escapeHTML(mapped.sub || '')}</span>
          </a>
        `;
      }).join('')}
    </div>
  `;
}
