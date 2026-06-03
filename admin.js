const CSV_PATH = '../data/products_master.csv';
const PRODUCTS_JSON_URL = 'https://jlr.starjapan.co.jp/assets/data/products.json';
const csvFileInput = document.getElementById('csvFileInput');
const loadSampleBtn = document.getElementById('loadSampleBtn');
const loadBlobJsonBtn = document.getElementById('loadBlobJsonBtn');
const downloadJsonBtn = document.getElementById('downloadJsonBtn');
const downloadCsvBtn = document.getElementById('downloadCsvBtn');
const keywordInput = document.getElementById('keywordInput');
const brandFilter = document.getElementById('brandFilter');
const yearFilter = document.getElementById('yearFilter');
const activeFilter = document.getElementById('activeFilter');
const productsTbody = document.getElementById('productsTbody');
const statusEl = document.getElementById('status');
const totalCountEl = document.getElementById('totalCount');
const activeCountEl = document.getElementById('activeCount');
const stockCountEl = document.getElementById('stockCount');
const dirtyCountEl = document.getElementById('dirtyCount');
const visibleCountEl = document.getElementById('visibleCount');

let products = [];
let originalProducts = [];

const headers = [
  'brand',
  'modelYear',
  'model',
  'itemType',
  'partNo',
  'dateCode',
  'price',
  'stock',
  'active'
];

csvFileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const text = await file.text();
  loadProductsFromCsv(text, file.name);
});

loadSampleBtn.addEventListener('click', async () => {
  try {
    const response = await fetch(CSV_PATH, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`CSVが見つかりません: ${CSV_PATH}`);
    }

    const text = await response.text();
    loadProductsFromCsv(text, CSV_PATH);
  } catch (error) {
    setStatus(error.message, true);
  }
});

loadBlobJsonBtn.addEventListener('click', async () => {
  try {
    const response = await fetch(PRODUCTS_JSON_URL, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`products.json が取得できません: ${PRODUCTS_JSON_URL}`);
    }

    const json = await response.json();

    products = json.map((item, index) => normalizeProduct({
      ...item,
      _rowId: index + 1,
      _dirty: false
    }));

    originalProducts = JSON.parse(JSON.stringify(products));

    setupFilters();
    enableActions(true);
    setStatus(`Blobのproducts.jsonを読み込みました。${products.length}件`);
    render();

  } catch (error) {
    setStatus(error.message, true);
  }
});

[keywordInput, brandFilter, yearFilter, activeFilter].forEach((el) => {
  el.addEventListener('input', render);
});

downloadJsonBtn.addEventListener('click', () => {
  const json = JSON.stringify(products.map(toPublicProduct), null, 2);
  downloadText('products.json', json, 'application/json');
});

downloadCsvBtn.addEventListener('click', () => {
  const csv = toCsv(products);
  downloadText('products_master.csv', csv, 'text/csv;charset=utf-8');
});

function loadProductsFromCsv(csvText, label) {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    setStatus('CSVにデータがありません', true);
    return;
  }

  const csvHeaders = rows[0].map(value => value.trim());
  const missing = headers.filter(header => !csvHeaders.includes(header));

  if (missing.length > 0) {
    setStatus(`必要な列がありません: ${missing.join(', ')}`, true);
    return;
  }

  products = rows.slice(1)
    .filter(row => row.some(cell => String(cell).trim() !== ''))
    .map((row, index) => {
      const item = {};
      csvHeaders.forEach((header, colIndex) => {
        item[header] = row[colIndex] ?? '';
      });

      return normalizeProduct({
        ...item,
        _rowId: index + 1,
        _dirty: false
      });
    });

  originalProducts = JSON.parse(JSON.stringify(products));
  setupFilters();
  enableActions(true);
  setStatus(`${label} を読み込みました。${products.length}件`);
  render();
}

function normalizeProduct(item) {
  return {
    brand: String(item.brand ?? '').trim(),
    modelYear: String(item.modelYear ?? '').replace('MY', '').trim(),
    model: String(item.model ?? '').trim(),
    itemType: String(item.itemType ?? '').trim(),
    partNo: String(item.partNo ?? '').trim(),
    dateCode: String(item.dateCode ?? '').trim(),
    price: toNumber(item.price),
    stock: toNumber(item.stock),
    active: toBoolean(item.active),
    _rowId: item._rowId,
    _dirty: Boolean(item._dirty)
  };
}

function toPublicProduct(item) {
  return {
    brand: String(item.brand ?? '').trim(),
    modelYear: String(item.modelYear ?? '').replace('MY', '').trim(),
    model: String(item.model ?? '').trim(),
    itemType: String(item.itemType ?? '').trim(),
    partNo: String(item.partNo ?? '').trim(),
    dateCode: String(item.dateCode ?? '').trim(),
    price: toNumber(item.price),
    stock: toNumber(item.stock),
    active: toBoolean(item.active)
  };
}

function setupFilters() {
  setOptions(brandFilter, unique(products.map(p => p.brand)).sort());
  setOptions(yearFilter, unique(products.map(p => p.modelYear)).sort((a, b) => Number(a) - Number(b)));
}

function setOptions(selectEl, values) {
  const current = selectEl.value;
  selectEl.innerHTML = '<option value="">すべて</option>';

  values.filter(Boolean).forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    selectEl.appendChild(option);
  });

  selectEl.value = current;
}

function render() {
  const filtered = getFilteredProducts();

  productsTbody.innerHTML = '';

  if (filtered.length === 0) {
    productsTbody.innerHTML = '<tr><td colspan="9" class="empty">該当する商品がありません</td></tr>';
  } else {
    const fragment = document.createDocumentFragment();

    filtered.forEach(product => {
      const tr = document.createElement('tr');
      if (product._dirty) tr.classList.add('changed');

      tr.innerHTML = `
        <td>${escapeHtml(product.brand)}</td>
        <td class="small">${escapeHtml(product.modelYear)}</td>
        <td>${escapeHtml(product.model)}</td>
        <td>${escapeHtml(product.itemType)}</td>
        <td class="part-no">${escapeHtml(product.partNo)}</td>
        <td class="small">${escapeHtml(product.dateCode)}</td>
        <td class="number">
          <input type="number" min="0" step="1" value="${product.price}" data-field="price" data-id="${product._rowId}">
        </td>
        <td class="number">
          <input type="number" min="0" step="1" value="${product.stock}" data-field="stock" data-id="${product._rowId}">
        </td>
        <td class="checkbox">
          <input type="checkbox" ${product.active ? 'checked' : ''} data-field="active" data-id="${product._rowId}">
        </td>
      `;

      fragment.appendChild(tr);
    });

    productsTbody.appendChild(fragment);
  }

  productsTbody.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', handleEdit);
  });

  updateSummary(filtered);
}

function handleEdit(event) {
  const input = event.target;
  const id = Number(input.dataset.id);
  const field = input.dataset.field;
  const product = products.find(item => item._rowId === id);

  if (!product) return;

  if (field === 'price' || field === 'stock') {
    product[field] = toNumber(input.value);
  } else if (field === 'active') {
    product[field] = input.checked;
  }

  product._dirty = hasChanged(product);
  render();
}

function hasChanged(product) {
  const original = originalProducts.find(item => item._rowId === product._rowId);
  if (!original) return true;

  return headers.some(header => product[header] !== original[header]);
}

function getFilteredProducts() {
  const keyword = keywordInput.value.trim().toLowerCase();
  const brand = brandFilter.value;
  const year = yearFilter.value;
  const active = activeFilter.value;

  return products.filter(product => {
    const text = [
      product.brand,
      product.modelYear,
      product.model,
      product.itemType,
      product.partNo,
      product.dateCode
    ].join(' ').toLowerCase();

    if (keyword && !text.includes(keyword)) return false;
    if (brand && product.brand !== brand) return false;
    if (year && product.modelYear !== year) return false;
    if (active !== '' && String(product.active) !== active) return false;

    return true;
  });
}

function updateSummary(filtered) {
  totalCountEl.textContent = products.length;
  activeCountEl.textContent = products.filter(p => p.active).length;
  stockCountEl.textContent = products.filter(p => p.stock > 0).length;
  dirtyCountEl.textContent = products.filter(p => p._dirty).length;
  visibleCountEl.textContent = `${filtered.length}件表示`;
}

function enableActions(enabled) {
  downloadJsonBtn.disabled = !enabled;
  downloadCsvBtn.disabled = !enabled;
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#b42318' : '#4b5563';
  statusEl.style.background = isError ? '#fff1f0' : '#f7faf8';
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function toCsv(items) {
  const lines = [headers.join(',')];

  items.forEach(item => {
    const row = headers.map(header => csvEscape(item[header]));
    lines.push(row.join(','));
  });

  return '\uFEFF' + lines.join('\r\n');
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadText(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function toNumber(value) {
  const num = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(num) ? num : 0;
}

function toBoolean(value) {
  const text = String(value ?? '').trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'yes' || text === '表示' || text === '有効';
}

function unique(values) {
  return [...new Set(values)];
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
