const TOKEN_KEY = 'crm_token';
const EXPIRES_KEY = 'crm_token_expires_at';
const TOKEN_TTL_MS = 30 * 60 * 1000;

export function saveToken(token, expiresAt) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EXPIRES_KEY, String(expiresAt || Date.now() + TOKEN_TTL_MS));
}

export function getToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiresAt = Number(localStorage.getItem(EXPIRES_KEY) || 0);
  if (!token || !expiresAt || Date.now() > expiresAt) {
    clearToken();
    return null;
  }
  return token;
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}

export function isAuthenticated() {
  return Boolean(getToken());
}

export function extendSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;
  localStorage.setItem(EXPIRES_KEY, String(Date.now() + TOKEN_TTL_MS));
}

export function getTokenExpiresAt() {
  return Number(localStorage.getItem(EXPIRES_KEY) || 0);
}

export function attachSessionRefresh() {
  ['click', 'keydown', 'touchstart'].forEach((eventName) => {
    window.addEventListener(eventName, extendSession, { passive: true });
  });
}
