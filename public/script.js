/* ===================== 模板設定 ===================== */
const TEMPLATES = {
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
    titlePlaceholder: '這組交易的備註（可留空）',
    contentPlaceholder: '這一組交易的整體想法與情緒（可留空）。',
    valuePlaceholder: '本組整體盈虧（點數或金額）',
    hint: '交易模板：先選品種，再用下方表格記錄每一單的細節。'
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

/* 交易品種設定 */
const TRADE_PRODUCTS = ['GOLD', 'USTEC100', 'EURUSD'];

/* ===================== 狀態 ===================== */
let currentTemplate = null;
let currentTradeProduct = 'GOLD'; // 預設品種

/* ===================== 工具函式 ===================== */

/** 顯示表單操作回饋 */
function showStatus(message, isError = false) {
  const el = document.getElementById('formStatus');
  if (!el) return;
  el.textContent = message || '';
  el.className = 'form-status';
  if (message) {
    el.classList.add(isError ? 'error' : 'success');
    setTimeout(() => {
      el.textContent = '';
      el.className = 'form-status';
    }, 2500);
  }
}

/** HTML 跳脫，防 XSS */
function escapeHTML(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** 解析盈虧數字，無效值回傳 null */
function parsePnl(val) {
  const n = parseFloat(String(val).trim());
  return isNaN(n) ? null : n;
}

/* ===================== 交易表格 ===================== */

/** 新增一列交易明細 */
function addTradeRow(data = {}) {
  const tbody = document.querySelector('#tradeTable tbody');
  if (!tbody) return;

  const result = data.result || '';
  const tr = document.createElement('tr');

  tr.innerHTML = `
    <td><input type="text" class="trade-datetime" value="${escapeHTML(data.datetime || '')}" placeholder="1217 14:20"></td>
    <td><input type="text" class="trade-product" value="${escapeHTML(data.product || currentTradeProduct)}" placeholder="${currentTradeProduct}"></td>
    <td><input type="text" class="trade-timeframe" value="${escapeHTML(data.timeframe || '')}" placeholder="M15 / H1"></td>
    <td><input type="text" class="trade-snr" value="${escapeHTML(data.snrType || '')}" placeholder="SBR / RBS"></td>
    <td><input type="text" class="trade-ema-order" value="${escapeHTML(data.emaOrder || '')}" placeholder="5>20>60"></td>
    <td><input type="text" class="trade-ema-fit" value="${escapeHTML(data.emaFit || '')}" placeholder="高/中/低"></td>
    <td><input type="text" class="trade-kbar" value="${escapeHTML(data.kbarPattern || '')}" placeholder="Pin/吞沒"></td>
    <td><input type="text" class="trade-dxy" value="${escapeHTML(data.dxyDiv || '')}" placeholder="有/無"></td>
    <td>
      <select class="trade-result ${result}">
        <option value="">—</option>
        <option value="win" ${result === 'win' ? 'selected' : ''}>✅ 勝</option>
        <option value="lose" ${result === 'lose' ? 'selected' : ''}>❌ 敗</option>
        <option value="draw" ${result === 'draw' ? 'selected' : ''}>➖ 平</option>
      </select>
    </td>
    <td><input type="number" class="trade-pnl" value="${escapeHTML(String(data.pnl ?? ''))}" placeholder="點數" step="0.1"></td>
    <td><button type="button" class="btn-danger">刪除</button></td>
  `;

  // 結果欄 select 切換顏色
  const select = tr.querySelector('.trade-result');
  select.addEventListener('change', () => {
    select.className = `trade-result ${select.value}`;
  });

  tr.querySelector('.btn-danger').addEventListener('click', () => tr.remove());
  tbody.appendChild(tr);
}

/** 清空交易表格 */
function clearTradeTable() {
  const tbody = document.querySelector('#tradeTable tbody');
  if (tbody) tbody.innerHTML = '';
}

/** 收集表格所有列資料 */
function collectTradeDetails() {
  const tbody = document.querySelector('#tradeTable tbody');
  if (!tbody) return [];

  return Array.from(tbody.querySelectorAll('tr'))
    .map(tr => {
      const get = sel => tr.querySelector(sel)?.value.trim() || '';
      const pnlRaw = tr.querySelector('.trade-pnl')?.value.trim() || '';
      const row = {
        datetime:    get('.trade-datetime'),
        product:     get('.trade-product'),
        timeframe:   get('.trade-timeframe'),
        snrType:     get('.trade-snr'),
        emaOrder:    get('.trade-ema-order'),
        emaFit:      get('.trade-ema-fit'),
        kbarPattern: get('.trade-kbar'),
        dxyDiv:      get('.trade-dxy'),
        result:      get('.trade-result'),
        pnl:         pnlRaw !== '' ? parseFloat(pnlRaw) : null,
      };
      // 整列空白就丟掉
      const values = [row.datetime, row.product, row.timeframe, row.snrType,
                      row.emaOrder, row.emaFit, row.kbarPattern, row.dxyDiv, row.result];
      if (values.every(v => v === '') && row.pnl === null) return null;
      return row;
    })
    .filter(Boolean);
}

/* ===================== 套用模板 ===================== */
function applyTemplate(name) {
  currentTemplate = name;
  const t = TEMPLATES[name];

  // 顯示主面板
  document.getElementById('mainPanel')?.classList.remove('hidden');
  document.getElementById('templateHint').textContent = t.hint;

  // 品種 Tab（只在 trade 顯示）
  const tradeProductSection = document.getElementById('tradeProductSection');
  const tradeSection        = document.getElementById('tradeTableSection');
  const tradeReminder       = document.getElementById('tradeReminder');
  const dateRow             = document.getElementById('dateRow');
  const tradeStats          = document.getElementById('tradeStats');

  const isTrade = name === 'trade';

  tradeProductSection?.classList.toggle('hidden', !isTrade);
  tradeSection?.classList.toggle('hidden', !isTrade);
  tradeReminder?.classList.toggle('hidden', !isTrade);
  dateRow?.classList.toggle('hidden', isTrade);
  tradeStats?.classList.toggle('hidden', !isTrade);

  // 類別欄
  const categoryInput = document.getElementById('category');
  if (categoryInput) {
    if (t.defaultCategory) {
      categoryInput.value = t.defaultCategory;
      categoryInput.readOnly = true;
    } else {
      categoryInput.readOnly = false;
      categoryInput.value = '';
      categoryInput.placeholder = '輸入你想要的分類，例如：心情、工作…';
    }
  }

  // Placeholder
  const titleInput   = document.getElementById('title');
  const contentInput = document.getElementById('content');
  const valueInput   = document.getElementById('value');
  if (titleInput)   titleInput.placeholder   = t.titlePlaceholder;
  if (contentInput) contentInput.placeholder = t.contentPlaceholder;
  if (valueInput)   valueInput.placeholder   = t.valuePlaceholder;

  // 按鈕 active 狀態
  document.querySelectorAll('[data-template]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.template === name);
  });

  // trade：預設一列、自動帶入選中品種
  if (isTrade) {
    const tbody = document.querySelector('#tradeTable tbody');
    if (tbody && tbody.children.length === 0) addTradeRow();
  }

  loadRecords();
}

/* ===================== 品種 Tab 切換 ===================== */
function setTradeProduct(product) {
  currentTradeProduct = product;

  document.querySelectorAll('.product-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.product === product);
  });

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

    if (!currentTemplate) {
      listEl.innerHTML = '<p style="color:var(--text-hint);font-size:14px;">請先上方選擇一種分類。</p>';
      return;
    }

    const def = TEMPLATES[currentTemplate].defaultCategory;
    let filtered = [];

    if (currentTemplate === 'trade') {
      // 篩選：交易 + 當前品種
      filtered = data.filter(r => {
        if (r.category !== '交易') return false;
        if (!r.tradeDetails || r.tradeDetails.length === 0) return true;
        return r.tradeDetails.some(d =>
          (d.product || '').toUpperCase() === currentTradeProduct.toUpperCase()
        );
      });
      renderTradeStats(filtered);
    } else if (def) {
      filtered = data.filter(r => r.category === def);
    } else {
      const inputCat = (document.getElementById('category')?.value || '').trim();
      if (!inputCat) {
        listEl.innerHTML = '<p style="color:var(--text-hint);font-size:14px;">自訂分類請先在「類別」輸入分類名稱，才會顯示列表。</p>';
        return;
      }
      filtered = data.filter(r => (r.category || '') === inputCat);
    }

    if (!filtered.length) {
      listEl.innerHTML = '<p style="color:var(--text-hint);font-size:14px;">這個分類目前沒有紀錄。</p>';
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

/* ===================== 勝率統計 ===================== */
function renderTradeStats(records) {
  const el = {
    total: document.getElementById('statTotal'),
    win:   document.getElementById('statWin'),
    lose:  document.getElementById('statLose'),
    rate:  document.getElementById('statRate'),
    pnl:   document.getElementById('statPnl'),
  };
  if (!el.total) return;

  // 從所有紀錄的 tradeDetails 裡收集屬於當前品種的單子
  const rows = records.flatMap(r =>
    (r.tradeDetails || []).filter(d =>
      (d.product || '').toUpperCase() === currentTradeProduct.toUpperCase()
    )
  );

  const winCount  = rows.filter(d => d.result === 'win').length;
  const loseCount = rows.filter(d => d.result === 'lose').length;
  const decided   = winCount + loseCount; // 勝/敗才算勝率分母
  const rate      = decided > 0 ? ((winCount / decided) * 100).toFixed(1) + '%' : '—';

  let totalPnl = null;
  rows.forEach(d => {
    const n = parsePnl(d.pnl);
    if (n !== null) {
      if (totalPnl === null) totalPnl = 0;
      totalPnl += n;
    }
  });
  const pnlText = totalPnl !== null
    ? (totalPnl >= 0 ? '+' : '') + totalPnl.toFixed(1) + ' 點'
    : '—';

  el.total.textContent = `總計：${rows.length} 筆`;
  el.win.textContent   = `勝：${winCount}`;
  el.lose.textContent  = `敗：${loseCount}`;
  el.rate.textContent  = `勝率：${rate}`;
  el.pnl.textContent   = `累計盈虧：${pnlText}`;
}

/* ===================== 卡片渲染 ===================== */
function recordToHTML(r) {
  const isTrade = r.category === '交易';
  const metaLine = r.date ? `日期：${escapeHTML(r.date)}` : '';

  let tradeMini = '';
  if (isTrade && Array.isArray(r.tradeDetails) && r.tradeDetails.length > 0) {
    // 只顯示屬於當前品種的列
    const rows = r.tradeDetails.filter(d =>
      (d.product || '').toUpperCase() === currentTradeProduct.toUpperCase()
    );
    if (rows.length > 0) {
      tradeMini = `
        <div class="trade-mini">
          <table>
            <thead>
              <tr>
                <th>日期時間</th>
                <th>商品</th>
                <th>週期</th>
                <th>SNR</th>
                <th>EMA排列</th>
                <th>EMA貼合</th>
                <th>K棒型態</th>
                <th>DXY背離</th>
                <th>結果</th>
                <th>盈虧（點）</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(d => {
                const pnl = parsePnl(d.pnl);
                const pnlClass = pnl === null ? '' : pnl >= 0 ? 'pnl-positive' : 'pnl-negative';
                const pnlText = pnl === null ? '—' : (pnl >= 0 ? '+' : '') + pnl.toFixed(1);
                const resultLabel = { win: '✅ 勝', lose: '❌ 敗', draw: '➖ 平' }[d.result] || '—';
                const badgeClass = d.result || '';
                return `
                  <tr>
                    <td>${escapeHTML(d.datetime || '')}</td>
                    <td>${escapeHTML(d.product || '')}</td>
                    <td>${escapeHTML(d.timeframe || '')}</td>
                    <td>${escapeHTML(d.snrType || '')}</td>
                    <td>${escapeHTML(d.emaOrder || '')}</td>
                    <td>${escapeHTML(d.emaFit || '')}</td>
                    <td>${escapeHTML(d.kbarPattern || '')}</td>
                    <td>${escapeHTML(d.dxyDiv || '')}</td>
                    <td><span class="result-badge ${badgeClass}">${resultLabel}</span></td>
                    <td class="${pnlClass}">${pnlText}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  }

  return `
    <div class="record-card">
      <div class="record-header">
        <div>
          <strong>${escapeHTML(r.title)}</strong>
          ${r.category && !isTrade
            ? `<span class="record-category">（${escapeHTML(r.category)}）</span>`
            : ''}
        </div>
        <div class="record-actions">
          <button onclick="deleteRecord(${r.id})">刪除</button>
        </div>
      </div>

      ${!isTrade && metaLine ? `<div class="record-meta">${metaLine}</div>` : ''}

      <div class="record-content">${r.content ? escapeHTML(r.content) : ''}</div>
      ${r.value ? `<div class="record-value">數值：${escapeHTML(r.value)}</div>` : ''}

      ${tradeMini}
    </div>
  `;
}

/* ===================== 新增紀錄 ===================== */
async function handleSubmit(e) {
  e.preventDefault();

  const title    = document.getElementById('title')?.value.trim() || '';
  let   category = document.getElementById('category')?.value.trim() || '';
  const content  = document.getElementById('content')?.value.trim() || '';
  const value    = document.getElementById('value')?.value.trim() || '';
  const date     = currentTemplate === 'trade' ? '' : (document.getElementById('date')?.value || '');

  if (!title) {
    alert('標題必填');
    return;
  }

  // 有預設分類就用預設的
  if (currentTemplate && TEMPLATES[currentTemplate]?.defaultCategory) {
    category = TEMPLATES[currentTemplate].defaultCategory;
  }

  const tradeDetails = currentTemplate === 'trade' ? collectTradeDetails() : [];

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

    // 保留固定分類
    const defaultCat = TEMPLATES[currentTemplate]?.defaultCategory;
    if (defaultCat) {
      const catInput = document.getElementById('category');
      if (catInput) catInput.value = defaultCat;
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

/* ===================== 刪除紀錄 ===================== */
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

/* ===================== 初始化 ===================== */
document.addEventListener('DOMContentLoaded', () => {
  // 表單送出
  document.getElementById('recordForm')?.addEventListener('submit', handleSubmit);

  // 模板選擇
  document.querySelectorAll('[data-template]').forEach(btn => {
    btn.addEventListener('click', () => applyTemplate(btn.dataset.template));
  });

  // 新增交易列
  document.getElementById('addTradeRowBtn')?.addEventListener('click', () => addTradeRow());

  // 品種 Tab
  document.querySelectorAll('.product-tab').forEach(btn => {
    btn.addEventListener('click', () => setTradeProduct(btn.dataset.product));
  });

  console.log('初始化完成');
});