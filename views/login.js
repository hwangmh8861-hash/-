import { saveToken } from '../js/auth.js';
import { toast } from '../js/components/toast.js';

export function render(target) {
  target.innerHTML = `
    <main class="login-page">
      <section class="login-card">
        <span class="brand-mark">영</span>
        <h1>학교영업CRM</h1>
        <p>비밀번호로 접속합니다. 목업 모드에서는 아무 값이나 입력해도 화면을 확인할 수 있습니다.</p>
        <form id="crm-login-form">
          <div class="form-row">
            <label for="crm-password">비밀번호</label>
            <input
              id="crm-password"
              name="crm-password"
              class="input"
              type="text"
              autocomplete="off"
              placeholder="아무 값이나 입력"
              required
            />
          </div>
          <button class="primary-button" type="submit" style="width: 100%; height: 48px;">로그인</button>
        </form>
      </section>
    </main>
  `;

  const form = document.getElementById('crm-login-form');

  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const token = 'mock-token-' + Date.now();
    const expiresAt = Date.now() + 30 * 60 * 1000;

    saveToken(token, expiresAt);
    toast('로그인되었습니다.');

    window.location.replace(window.location.origin + window.location.pathname + '#/');
  });
}