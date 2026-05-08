import { escapeHTML } from '../utils.js';

export function createDataTable(container, options = {}) {
  const table = new DataTable(container, options);
  table.render();
  return table;
}

class DataTable {
  constructor(container, options = {}) {
    this.container = container;
    this.rows = options.rows || [];
    this.columns = options.columns || [];
    this.rowId = options.rowId || ((row) => row.id);
    this.storageKey = options.storageKey || 'crm_table_columns';
    this.pageSize = Number(localStorage.getItem(`${this.storageKey}_pageSize`) || options.pageSize || 50);
    this.page = 1;
    this.sorts = [];
    this.columnFilters = {};
    this.selected = new Set(options.selected || []);
    this.onSelectionChange = options.onSelectionChange || (() => {});
    this.onRowDblClick = options.onRowDblClick || (() => {});
    this.onRender = options.onRender || (() => {});
    this.visibleColumnKeys = this.loadVisibleColumns();
  }

  setRows(rows = []) {
    this.rows = rows;
    this.page = 1;
    this.render();
  }

  getSelectedRows() {
    return this.filteredSortedRows().filter((row) => this.selected.has(this.rowId(row)));
  }

  getVisibleRows() {
    return this.filteredSortedRows();
  }

  render() {
    const rows = this.filteredSortedRows();
    const totalPages = Math.max(1, Math.ceil(rows.length / this.pageSize));
    this.page = Math.min(this.page, totalPages);
    const pageRows = rows.slice((this.page - 1) * this.pageSize, this.page * this.pageSize);
    const visibleColumns = this.columns.filter((column) => this.visibleColumnKeys.includes(column.key));

    this.container.innerHTML = `
      <div class="data-table-shell">
        <div class="data-table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th class="select-col"><input type="checkbox" data-select-all ${pageRows.length && pageRows.every((row) => this.selected.has(this.rowId(row))) ? 'checked' : ''} /></th>
                ${visibleColumns.map((column) => this.renderHeader(column)).join('')}
              </tr>
            </thead>
            <tbody>
              ${pageRows.length ? pageRows.map((row) => this.renderRow(row, visibleColumns)).join('') : `<tr><td colspan="${visibleColumns.length + 1}" class="empty-cell">조건에 맞는 데이터가 없습니다.</td></tr>`}
            </tbody>
          </table>
        </div>
        <div class="data-table-footer">
          <span>총 ${rows.length.toLocaleString('ko-KR')}건 · 선택 ${this.selected.size.toLocaleString('ko-KR')}건</span>
          <div class="table-paging">
            <select data-page-size>
              ${[50, 100, 200].map((size) => `<option value="${size}" ${this.pageSize === size ? 'selected' : ''}>${size}행</option>`).join('')}
            </select>
            <button class="ghost-button small" type="button" data-page-prev ${this.page <= 1 ? 'disabled' : ''}>이전</button>
            <span>${this.page} / ${totalPages}</span>
            <button class="ghost-button small" type="button" data-page-next ${this.page >= totalPages ? 'disabled' : ''}>다음</button>
          </div>
        </div>
      </div>
    `;
    this.bind();
    this.onRender(this);
  }

  renderHeader(column) {
    const sort = this.sorts.find((item) => item.key === column.key);
    const sortMark = sort ? (sort.dir === 'asc' ? '▲' : '▼') : '';
    const filtered = this.columnFilters[column.key] ? 'active' : '';
    return `
      <th data-sort-key="${escapeHTML(column.key)}">
        <button class="th-sort" type="button" data-sort="${escapeHTML(column.key)}">
          <span>${escapeHTML(column.label)}</span><em>${sortMark}</em>
        </button>
        <button class="th-filter ${filtered}" type="button" data-column-filter="${escapeHTML(column.key)}" aria-label="${escapeHTML(column.label)} 필터">깔때기</button>
      </th>
    `;
  }

  renderRow(row, columns) {
    const id = this.rowId(row);
    return `
      <tr data-row-id="${escapeHTML(id)}" tabindex="0">
        <td class="select-col"><input type="checkbox" data-row-select="${escapeHTML(id)}" ${this.selected.has(id) ? 'checked' : ''} /></td>
        ${columns.map((column) => `<td data-col="${escapeHTML(column.key)}">${this.renderCell(row, column)}</td>`).join('')}
      </tr>
    `;
  }

  renderCell(row, column) {
    if (column.render) return column.render(row);
    const value = getValue(row, column.key);
    return escapeHTML(value ?? '-');
  }

  bind() {
    this.container.querySelector('[data-select-all]')?.addEventListener('change', (event) => {
      const rows = this.currentPageRows();
      rows.forEach((row) => {
        const id = this.rowId(row);
        if (event.target.checked) this.selected.add(id);
        else this.selected.delete(id);
      });
      this.onSelectionChange(this.getSelectedRows());
      this.render();
    });

    this.container.querySelectorAll('[data-row-select]').forEach((input) => {
      input.addEventListener('change', (event) => {
        const id = event.target.dataset.rowSelect;
        if (event.target.checked) this.selected.add(id);
        else this.selected.delete(id);
        this.onSelectionChange(this.getSelectedRows());
        this.render();
      });
    });

    this.container.querySelectorAll('[data-sort]').forEach((button) => {
      button.addEventListener('click', (event) => {
        this.toggleSort(button.dataset.sort, event.shiftKey);
      });
    });

    this.container.querySelectorAll('[data-column-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.dataset.columnFilter;
        const column = this.columns.find((item) => item.key === key);
        const previous = this.columnFilters[key] || '';
        const value = window.prompt(`${column?.label || key} 컬럼에서 포함할 값을 입력해주세요. 비우면 필터가 해제됩니다.`, previous);
        if (value === null) return;
        if (value.trim()) this.columnFilters[key] = value.trim();
        else delete this.columnFilters[key];
        this.page = 1;
        this.render();
      });
    });

    this.container.querySelectorAll('tbody tr[data-row-id]').forEach((rowEl) => {
      rowEl.addEventListener('dblclick', () => {
        const row = this.rows.find((item) => this.rowId(item) === rowEl.dataset.rowId);
        if (row) this.onRowDblClick(row);
      });
      rowEl.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          const row = this.rows.find((item) => this.rowId(item) === rowEl.dataset.rowId);
          if (row) this.onRowDblClick(row);
        }
      });
    });

    this.container.querySelector('[data-page-prev]')?.addEventListener('click', () => {
      this.page = Math.max(1, this.page - 1);
      this.render();
    });

    this.container.querySelector('[data-page-next]')?.addEventListener('click', () => {
      const maxPage = Math.max(1, Math.ceil(this.filteredSortedRows().length / this.pageSize));
      this.page = Math.min(maxPage, this.page + 1);
      this.render();
    });

    this.container.querySelector('[data-page-size]')?.addEventListener('change', (event) => {
      this.pageSize = Number(event.target.value);
      localStorage.setItem(`${this.storageKey}_pageSize`, String(this.pageSize));
      this.page = 1;
      this.render();
    });
  }

  currentPageRows() {
    const rows = this.filteredSortedRows();
    return rows.slice((this.page - 1) * this.pageSize, this.page * this.pageSize);
  }

  filteredSortedRows() {
    let rows = this.rows.filter((row) => {
      return Object.entries(this.columnFilters).every(([key, value]) => {
        const raw = stringifyCell(getValue(row, key));
        return raw.toLowerCase().includes(String(value).toLowerCase());
      });
    });

    if (this.sorts.length) {
      rows = [...rows].sort((a, b) => {
        for (const sort of this.sorts) {
          const result = compareValue(getValue(a, sort.key), getValue(b, sort.key));
          if (result !== 0) return sort.dir === 'asc' ? result : -result;
        }
        return 0;
      });
    }

    return rows;
  }

  toggleSort(key, append = false) {
    const current = this.sorts.find((item) => item.key === key);
    let next;
    if (!current) next = { key, dir: 'asc' };
    else if (current.dir === 'asc') next = { key, dir: 'desc' };
    else next = null;

    if (!append) this.sorts = next ? [next] : [];
    else {
      this.sorts = this.sorts.filter((item) => item.key !== key);
      if (next) this.sorts.push(next);
    }
    this.render();
  }

  loadVisibleColumns() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.storageKey) || 'null');
      if (Array.isArray(saved) && saved.length) return saved;
    } catch (error) {}
    return this.columns.filter((column) => column.defaultVisible !== false).map((column) => column.key);
  }

  setVisibleColumns(keys = []) {
    this.visibleColumnKeys = keys;
    localStorage.setItem(this.storageKey, JSON.stringify(keys));
    this.render();
  }
}

function getValue(row, key) {
  return key.split('.').reduce((acc, part) => acc?.[part], row);
}

function stringifyCell(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') return Object.values(value).join(' ');
  return String(value ?? '');
}

function compareValue(a, b) {
  const aNumber = Number(a);
  const bNumber = Number(b);
  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) return aNumber - bNumber;
  return stringifyCell(a).localeCompare(stringifyCell(b), 'ko', { numeric: true });
}
