const CACHE_NAME = 'school-crm-shell-v5';
const APP_SHELL = [
  './',
  './index.html',
  './css/tokens.css',
  './css/style.css',
  './css/kanban.css',
  './css/dashboard.css',
  './css/list.css',
  './css/import.css',
  './css/schoolDetail.css',
  './js/api.js',
  './js/auth.js',
  './js/router.js',
  './js/store.js',
  './js/utils.js',
  './js/components/navbar.js',
  './js/components/modal.js',
  './js/components/toast.js',
  './js/components/badge.js',
  './js/components/schoolCard.js',
  './js/components/filterBar.js',
  './js/components/stageColumn.js',
  './js/components/dataTable.js',
  './js/components/kpiCard.js',
  './js/components/chart.js',
  './js/components/stageChangeModal.js',
  './js/components/contactCard.js',
  './js/components/activityTimeline.js',
  './js/components/bantMeddicForm.js',
  './js/components/oppTabs.js',
  './js/utils/tagHelper.js',
  './js/utils/csvParser.js',
  './js/views/schoolDetail.js',
  './js/utils/voiceRecognition.js',
  './js/views/kanban.js',
  './js/views/dashboard.js',
  './js/views/list.js',
  './js/views/import.js',
  './views/login.js',
  './views/kanban.js',
  './views/dashboard.js',
  './views/list.js',
  './views/schoolDetail.js',
  './views/import.js',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (url.href.includes('script.google.com')) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
  );
});
