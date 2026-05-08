const listeners = new Set();

const state = {
  사용자: null,
  로딩중: false,
  검색어: '',
  테마: localStorage.getItem('crm_theme') || 'light',
  현재경로: location.hash || '#/',
  마지막오류: null
};

export const store = new Proxy(state, {
  set(target, key, value) {
    target[key] = value;
    listeners.forEach((listener) => listener({ key, value, state: target }));
    return true;
  }
});

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setState(patch = {}) {
  Object.entries(patch).forEach(([key, value]) => {
    store[key] = value;
  });
}

export function getState() {
  return { ...state };
}
