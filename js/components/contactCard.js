import { escapeHTML } from '../utils.js';

export function contactCard(contact = {}) {
  const phone = contact.휴대폰 || contact.사무실전화 || '';
  const email = contact.이메일 || '';
  return `
    <article class="contact-card" data-contact-id="${escapeHTML(contact.contact_id)}">
      <div class="contact-card-head">
        <div>
          <strong>${escapeHTML(contact.이름 || '이름 미상')}</strong>
          <span>${escapeHTML(contact.직책 || '직책 미상')}</span>
        </div>
        <button class="champion-toggle ${contact.챔피언여부 === 'Y' ? 'is-on' : ''}" type="button" data-contact-action="champion" title="챔피언 표시">☆</button>
      </div>
      <div class="contact-card-body">
        <p>관계강도: ${escapeHTML(contact.관계강도 || '약')}</p>
        <p>휴대폰: ${phone ? escapeHTML(phone) : '-'}</p>
        <p>이메일: ${email ? escapeHTML(email) : '-'}</p>
      </div>
      <div class="contact-actions">
        ${phone ? `<a class="mini-button" href="tel:${escapeHTML(phone)}">전화</a>` : '<span class="mini-button disabled">전화</span>'}
        ${phone ? `<a class="mini-button" href="sms:${escapeHTML(phone)}">문자</a>` : '<span class="mini-button disabled">문자</span>'}
        ${email ? `<a class="mini-button" href="mailto:${escapeHTML(email)}">이메일</a>` : '<span class="mini-button disabled">이메일</span>'}
        <button class="mini-button" type="button" data-contact-action="edit">편집</button>
        <button class="mini-button danger" type="button" data-contact-action="delete">제거</button>
      </div>
    </article>
  `;
}

export function contactOptions(contacts = [], selectedId = '') {
  return `<option value="">선택 안 함</option>${contacts.map((contact) => `
    <option value="${escapeHTML(contact.contact_id)}" ${contact.contact_id === selectedId ? 'selected' : ''}>
      ${escapeHTML(contact.이름 || '이름 미상')} · ${escapeHTML(contact.직책 || '')}
    </option>
  `).join('')}`;
}
