export function toast(message, type = 'info') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const item = document.createElement('div');
  item.className = `toast ${type === 'error' ? 'is-error' : ''}`;
  item.textContent = message;
  root.appendChild(item);
  setTimeout(() => {
    item.style.opacity = '0';
    item.style.transform = 'translateY(8px)';
    item.style.transition = '180ms ease';
  }, 2600);
  setTimeout(() => item.remove(), 3000);
}
