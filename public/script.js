/* ===================== 模板 ===================== */
const templates = {
  study: {
    name: '課程學習',
    defaultCategory: '課程',
    titlePlaceholder: '例如：心理學 CH1-3 複習',
    contentPlaceholder: '今天學到什麼？\n哪裡不懂？\n下一步要複習什麼？',
    valuePlaceholder: '今天讀了幾小時？',
    hint: '課程模板：適合記錄上課內容、複習進度、學習時數。'
  },
  workout: {
    name: '運動訓練',
    defaultCategory: '運動',
    titlePlaceholder: '例如：重訓腿推 / 羽球練習',
    contentPlaceholder: '項目：\n組數 / 時間：\n當天感受與注意事項：',
    valuePlaceholder: '運動時間（分鐘）或組數',
    hint: '運動模板：適合記錄訓練項目、時間、身體狀況。'
  },
  stock: {
    name: '股票紀錄',
    defaultCategory: '股票',
    titlePlaceholder: '例如：0050 / SPY 之類',
    contentPlaceholder: '購買理由：觀察多久 / 本益比 / 毛利等 / 是否為情緒單：',
    valuePlaceholder: '進場價或目前觀察價格',
    hint: '股票模板：適合記錄長期持有的理由。'
  },
  trade: {
    name: '交易紀錄',
    defaultCategory: '交易',
    titlePlaceholder: '例如：NAS100 SNR 交易紀錄',
    contentPlaceholder: '可以寫這一組交易的整體想法與情緒。',
    valuePlaceholder: '本組交易整體盈虧',
    hint: '交易模板：使用下方表格記錄每一單的細節。'
  },
  custom: {
    name: '自訂',
    defaultCategory: '',
    titlePlaceholder: '輸入你自己的標題',
    contentPlaceholder: '自由書寫你想記錄的內容。',
    valuePlaceholder: '可留空或自訂用途',
    hint: '自訂模板：不會自動套用類別，你可以完全自己決定寫法。'
  }
};

let currentTemplate = null;
let currentCategoryKey = null;

/* ===================== 小工具 ===================== */
function showStatus(message, isError = false) {
  const el = document.getElementById('formStatus');
  if (!el) return;
  el.textContent = message || '';
  el.classList.remove('success', 'error');
  if (message) {
    el.classList.add(isError ? 'error' : 'success');
    setTimeout(() => {
      el.textContent = '';
      el.classList.remove('success', 'error');
    }, 2500);
  }
}

function escapeHTML(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ===================== 交易表格 ===================== */
function addTradeRow(data = {}) {
  const tbody = document.querySelector('#tradeTable tbody');
  if (!tbody) return;

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="trade-datetime" value="${escapeHTML(data.datetime || '')}" placeholder="2025/12/03 14:20"></td>
    <td><input type="text" class="trade-product" value="${escapeHTML(data.product || '')}" placeholder="NAS100"></td>
    <td><input type="text" class="trade-timeframe" value="${escapeHTML(data.timeframe || '')}" placeholder="M15 / H1"></td>
    <td><input type="text" class="trade-snr" value="${escapeHTML(data.snrType || '')}" placeholder="SBR / RBS"></td>
    <td><input type="text" class="trade-ema-order" value="${escapeHTML(data.emaOrder || '')}" placeholder="5>20>60"></td>
    <td><input type="text" class="trade-ema-fit" value="${escapeHTML(data.emaFit || '')}" placeholder="高 / 中 / 低"></td>
    <td><input type="text" class="trade-kbar" value="${escapeHTML(data.kbarPattern || '')}" placeholder="Pin / Engulf"></td>
    <td><input type="text" class="trade-dxy" value="${escapeHTML(data.dxyDiv || '')}" placeholder="有 / 無"></td>
    <td><button type="button" class="small-btn delete-row-btn">刪除</button></td>
  `;

  tr.querySelector('.delete-row-btn')?.addEventListener('click', () => tr.remove());
  tbody.appendChild(tr);
}

function clearTradeTable() {
  const tbody = document.querySelector('#tradeTable tbody');
  if (tbody) tbody.innerHTML = '';
}

function collectTradeDetails() {
  const tbody = document.querySelector('#tradeTable tbody');
  if (!tbody) return [];

  const rows = Array.from(tbody.querySelectorAll('tr'));
  return rows
    .map(tr => {
      const get = (sel) => tr.querySelector(sel)?.value.trim() || '';
      const row = {
        datetime: get('.trade-datetime'),
        product: get('.trade-product'),
        timeframe: get('.trade-timeframe'),
        snrType: get('.trade-snr'),
        emaOrder: get('.trade-ema-order'),
        emaFit: get('.trade-ema-fit'),
        kbarPattern: get('.trade-kbar'),
        dxyDiv: get('.trade-dxy'),
      };
      if (Object.values(row).every(v => v === '')) return null;
      return row;
    })
    .filter(Boolean);
}

/* ===================== 套用模板 ===================== */
function applyTemplate(name) {
  currentTemplate = name;
  currentCategoryKey = name;

  const t = templates[name];

  const mainPanel = document.getElementById('mainPanel');
  const hintEl = document.getElementById('templateHint');
  const categoryInput = document.getElementById('category');
  const titleInput = document.getElementById('title');
  const contentInput = document.getElementById('content');
  const valueInput = document.getElementById('value');

  // 這些是你自己可能加在 HTML 的 id（沒有也不會壞）
  const tradeSection = document.getElementById('tradeTableSection');
  const tradeReminder = document.getElementById('tradeReminder');
  const dateRow = document.getElementById('dateRow');
  const recordFormTitle = document.getElementById('recordFormTitle');

  mainPanel?.classList.remove('hidden');
  if (hintEl) hintEl.textContent = t.hint;

  // 類別：固定分類鎖住；自訂解鎖
  if (categoryInput) {
    if (t.defaultCategory) {
      categoryInput.value = t.defaultCategory;
      categoryInput.readOnly = true;
      categoryInput.placeholder = '';
    } else {
      categoryInput.readOnly = false;
      if (!categoryInput.value) {
        categoryInput.placeholder = '輸入你想要的分類，例如：心情、工作…';
      }
    }
  }

  if (titleInput) titleInput.placeholder = t.titlePlaceholder;
  if (contentInput) contentInput.placeholder = t.contentPlaceholder;
  if (valueInput) valueInput.placeholder = t.valuePlaceholder;

  document.querySelectorAll('[data-template]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.template === name);
  });

  // ✅ 只讓 trade 顯示紅字提醒；其他模板都隱藏（照你要的）
  if (name === 'trade') {
    tradeSection?.classList.remove('hidden');
    tradeReminder?.classList.remove('hidden');

    // trade 不顯示「日期欄」與「新增紀錄標題」（你說 trade 要拿掉）
    dateRow?.classList.add('hidden');
    recordFormTitle?.classList.add('hidden');

    const tbody = document.querySelector('#tradeTable tbody');
    if (tbody && tbody.children.length === 0) addTradeRow();
  } else {
    tradeSection?.classList.add('hidden');
    tradeReminder?.classList.add('hidden');

    dateRow?.classList.remove('hidden');
    recordFormTitle?.classList.remove('hidden');
  }

  loadRecords();
}

/* ===================== 列表 ===================== */
async function loadRecords() {
  try {
    const res = await fetch('/records');
    if (!res.ok) throw new Error('讀取失敗：' + res.status);

    const data = await res.json();
    const listEl = document.getElementById('recordList');
    if (!listEl) return;

    if (!currentCategoryKey) {
      listEl.innerHTML = '<p>請先上方選擇一種分類。</p>';
      return;
    }

    const def = templates[currentCategoryKey].defaultCategory;
    let filtered = [];

    if (def) {
      filtered = data.filter(r => r.category === def);
    } else {
      const inputCat = (document.getElementById('category')?.value || '').trim();
      if (!inputCat) {
        listEl.innerHTML = '<p>自訂分類請先在「類別」輸入你想要的分類，才會顯示該分類列表。</p>';
        return;
      }
      filtered = data.filter(r => (r.category || '') === inputCat);
    }

    if (!filtered.length) {
      listEl.innerHTML = '<p>這個分類目前沒有紀錄。</p>';
      return;
    }

    listEl.innerHTML = filtered
      .slice()
      .sort((a, b) => b.id - a.id)
      .map(recordToHTML)
      .join('');

  } catch (err) {
    console.error(err);
    showStatus('紀錄讀取失敗：' + err.message, true);
  }
}

function recordToHTML(r) {
  const isTrade = (r.category === '交易');

  // ✅ 不顯示建立時間 createdAt，只顯示你填的 date
  const metaLine = r.date ? `日期：${escapeHTML(r.date)}` : '';

  // ✅ trade 列表：不顯示「交易明細」標題，只顯示表格
  let tradeMini = '';
  if (Array.isArray(r.tradeDetails) && r.tradeDetails.length > 0) {
    tradeMini = `
      <div class="trade-mini">
        <table>
          <thead>
            <tr>
              <th>日期時間</th>
              <th>商品</th>
              <th>週期</th>
              <th>SNR 類型</th>
              <th>EMA 排列</th>
              <th>EMA 貼合</th>
              <th>K棒型態</th>
              <th>DXY 背離</th>
            </tr>
          </thead>
          <tbody>
            ${r.tradeDetails.map(d => `
              <tr>
                <td>${escapeHTML(d.datetime || '')}</td>
                <td>${escapeHTML(d.product || '')}</td>
                <td>${escapeHTML(d.timeframe || '')}</td>
                <td>${escapeHTML(d.snrType || '')}</td>
                <td>${escapeHTML(d.emaOrder || '')}</td>
                <td>${escapeHTML(d.emaFit || '')}</td>
                <td>${escapeHTML(d.kbarPattern || '')}</td>
                <td>${escapeHTML(d.dxyDiv || '')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  return `
    <div class="record-card">
      <div class="record-header">
        <div>
          <strong>${escapeHTML(r.title)}</strong>
          ${r.category && r.category !== '交易' ? `<span>（${escapeHTML(r.category)}）</span>` : ''}
        </div>
        <div class="record-actions">
          <button onclick="deleteRecord(${r.id})">刪除</button>
        </div>
      </div>

      ${(!isTrade && metaLine) ? `<div class="record-meta">${metaLine}</div>` : ''}

      <div class="record-content">
        ${r.content ? escapeHTML(r.content) : ''}
        ${r.value ? `<div style="margin-top:6px;">數值：${escapeHTML(r.value)}</div>` : ''}
      </div>

      ${tradeMini}
    </div>
  `;
}

/* ===================== 新增 / 刪除 ===================== */
async function handleSubmit(e) {
  e.preventDefault();

  const title = document.getElementById('title')?.value.trim() || '';
  let category = document.getElementById('category')?.value.trim() || '';
  const content = document.getElementById('content')?.value.trim() || '';
  const value = document.getElementById('value')?.value.trim() || '';

  // ✅ trade 不用 date；其他照原本
  const date = (currentTemplate === 'trade') ? '' : (document.getElementById('date')?.value || '');

  if (!title) {
    alert('標題必填');
    return;
  }

  if (currentCategoryKey && templates[currentCategoryKey]) {
    category = templates[currentCategoryKey].defaultCategory || category;
  }

  const tradeDetails = (currentTemplate === 'trade') ? collectTradeDetails() : [];

  try {
    const res = await fetch('/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, category, content, value, date, tradeDetails })
    });

    if (!res.ok) {
      let msg = `儲存失敗：${res.status}`;
      try {
        const data = await res.json();
        if (data?.error) msg += `（${data.error}）`;
      } catch (_) {}
      showStatus(msg, true);
      return;
    }

    showStatus('已儲存！');

    document.getElementById('recordForm')?.reset();

    // 固定分類保留
    if (templates[currentCategoryKey]?.defaultCategory) {
      const cat = templates[currentCategoryKey].defaultCategory;
      const categoryInput = document.getElementById('category');
      if (categoryInput) categoryInput.value = cat;
    }

    // trade：清表格但保留一列
    if (currentTemplate === 'trade') {
      clearTradeTable();
      addTradeRow();
    }

    await loadRecords();

  } catch (err) {
    console.error(err);
    showStatus('新增時發生錯誤：' + err.message, true);
  }
}

async function deleteRecord(id) {
  if (!confirm('確定要刪除這筆紀錄嗎？')) return;

  try {
    const res = await fetch(`/records/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      showStatus('刪除失敗：' + res.status, true);
      return;
    }
    showStatus('已刪除');
    await loadRecords();
  } catch (err) {
    console.error(err);
    showStatus('刪除時發生錯誤：' + err.message, true);
  }
}

/* ===================== 綁定 ===================== */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('recordForm')?.addEventListener('submit', handleSubmit);

  document.querySelectorAll('[data-template]').forEach(btn => {
    btn.addEventListener('click', () => applyTemplate(btn.dataset.template));
  });

  document.getElementById('addTradeRowBtn')?.addEventListener('click', () => addTradeRow());

  console.log('初始化完成：請先選擇分類');
});