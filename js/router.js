import { isAuthenticated, attachSessionRefresh } from './auth.js';
import { store } from './store.js';
import { renderNavbar, bindNavbar } from './components/navbar.js';
import { toast } from './components/toast.js';
import * as loginView from '../views/login.js';
import * as kanbanView from './views/kanban.js';
import * as dashboardView from './views/dashboard.js';
import * as listView from './views/list.js';
import * as schoolDetailView from './views/schoolDetail.js';
import * as importView from './views/import.js';
import * as migrateView from './views/migrate.js';
import * as settingsView from './views/settings.js';
import * as reportsView from './views/reports.js';
import * as helpView from './views/help.js';
import { attachShortcuts } from './shortcuts.js';

const app = document.getElementById('app');

const routes = [
  { pattern: /^#\/$/, view: kanbanView, auth: true },
  { pattern: /^#\/dashboard$/, view: dashboardView, auth: true },
  { pattern: /^#\/list$/, view: listView, auth: true },
  { pattern: /^#\/school\/([^/]+)$/, view: schoolDetailView, auth: true, params: (match) => ({ id: match[1] }) },
  { pattern: /^#\/opp\/([^/]+)$/, view: schoolDetailView, auth: true, params: (match) => ({ oppId: match[1] }) },
  { pattern: /^#\/import$/, view: importView, auth: true },
  { pattern: /^#\/migrate$/, view: migrateView, auth: true },
  { pattern: /^#\/settings$/, view: settingsView, auth: true },
  { pattern: /^#\/settings\/notifications$/, view: settingsView, auth: true },
  { pattern: /^#\/reports$/, view: reportsView, auth: true },
  { pattern: /^#\/help$/, view: helpView, auth: true },
  { pattern: /^#\/login$/, view: loginView, auth: false }
];

export function startRouter() {
  attachSessionRefresh();
  attachShortcuts();
  applyTheme();
  window.addEventListener('hashchange', renderRoute);
  if (!location.hash) location.hash = '#/';
  renderRoute();
}

async function renderRoute() {
  const hash = location.hash || '#/';
  store.현재경로 = hash;

  const matchRoute = routes.find((route) => route.pattern.test(hash));
  const route = matchRoute || routes[0];
  const match = hash.match(route.pattern);
  const params = route.params ? route.params(match) : {};

  if (route.auth && !isAuthenticated()) {
    location.hash = '#/login';
    return;
  }

  if (!route.auth && isAuthenticated() && hash === '#/login') {
    location.hash = '#/';
    return;
  }

  try {
    if (route.auth) {
      app.innerHTML = `<div class="layout">${renderNavbar(hash)}<main id="view" class="main"></main></div>`;
      bindNavbar();
      await route.view.render(document.getElementById('view'), params);
    } else {
      await route.view.render(app, params);
    }
  } catch (error) {
    toast(error.message || '화면을 불러오지 못했습니다.', 'error');
  }
}

function applyTheme() {
  const saved = localStorage.getItem('crm_theme') || 'light';
  document.documentElement.dataset.theme = saved;
}

startRouter();
