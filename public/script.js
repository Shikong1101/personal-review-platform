/* =====================================================================
   個人紀錄回顧平台 - script.js
   資料儲存：Google Drive（records.json）
   ===================================================================== */

/* ===================== 設定 ===================== */
const CLIENT_ID = '303723952901-b5aq1p5o5h7kk6ja5dgsc7556mukq75a.apps.googleusercontent.com';
const SCOPES    = 'https://www.googleapis.com/auth/drive.appdata';
const FILE_NAME = 'records.json';

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
    titlePlaceholder: '例如：0050 / SPY',
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

/* ===================== 狀態 ===================== */
let currentTemplate     = null;
let currentTradeProduct = 'GOLD';
let accessToken         = null;
let driveFileId         = null; // records.json 在 Drive 的 file ID
let records             = [];   // 記憶體內的資料

/* ===================== 工具函式 ===================== */
function showStatus(message, isError = false) {
  const el = document.getElementById('formStatus');
  if (!el) return;
  el.textContent = message || '';
  el.className = 'form-status';
  if (message) {
    el.classList.add(isError ? 'error' : 'success');
    setTimeout(() => { el.textContent = ''; el.className = 'form-status'; }, 2500);
  }
}

function escapeHTML(str = '') {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function parsePnl(val) {
  const n = parseFloat(String(val).trim());
  return isNaN(n) ? null : n;
}

/* ===================== Google 登入 ===================== */
function initGoogleAuth() {
  // 等 GSI script 載入完成
  const waitGSI = setInterval(() => {
    if (window.google && window.google.accounts) {
      clearInterval(waitGSI);
      setupTokenClient();
    }
  }, 100);
}

function setupTokenClient() {
  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: async (tokenResponse) => {
      if (tokenResponse.error) {
        console.error('授權失敗：', tokenResponse);
        return;
      }
      accessToken = tokenResponse.access_token;
      onLoginSuccess();
    }
  });

  document.getElementById('loginBtnMain')?.addEventListener('click', () => {
    tokenClient.requestAccessToken();
  });

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    google.accounts.oauth2.revoke(accessToken, () => {
      accessToken = null;
      driveFileId = null;
      records = [];
      showLoginPrompt();
    });
  });
}

function showLoginPrompt() {
  document.getElementById('loginPrompt')?.classList.remove('hidden');
  document.getElementById('appContent')?.classList.add('hidden');
  document.getElementById('userInfo')?.classList.add('hidden');
}

async function onLoginSuccess() {
  document.getElementById('loginPrompt')?.classList.add('hidden');
  document.getElementById('appContent')?.classList.remove('hidden');
  document.getElementById('userInfo')?.classList.remove('hidden');

  // 取得使用者名稱
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const info = await res.json();
    const nameEl = document.getElementById('userName');
    if (nameEl) nameEl.textContent = info.name || info.email || '';
  } catch (_) {}

  // 載入 Drive 資料
  await loadFromDrive();
  if (currentTemplate) loadRecords();
}

/* ===================== Google Drive 讀寫 ===================== */

/** 找 records.json 的 file ID，找不到就建立 */
async function findOrCreateFile() {
  // 先搜尋
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${FILE_NAME}'&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    driveFileId = searchData.files[0].id;
    return driveFileId;
  }

  // 不存在就建立空的
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: FILE_NAME,
      parents: ['appDataFolder']
    })
  });
  const createData = await createRes.json();
  driveFileId = createData.id;
  return driveFileId;
}

/** 從 Drive 讀取所有資料 */
async function loadFromDrive() {
  try {
    showStatus('載入中…');
    await findOrCreateFile();

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (res.status === 204 || res.headers.get('content-length') === '0') {
      records = [];
    } else {
      const text = await res.text();
      records = text ? JSON.parse(text) : [];
    }
    showStatus('');
  } catch (err) {
    console.error('Drive 讀取失敗：', err);
    records = [];
    showStatus('');
  }
}

/** 把目前 records 存回 Drive */
async function saveToDrive() {
  if (!driveFileId) await findOrCreateFile();

  const content = JSON.stringify(records, null, 2);
  const blob = new Blob([content], { type: 'application/json' });

  await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=media`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: blob
    }
  );
}

/* ===================== 交易表格 ===================== */
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

  const select = tr.querySelector('.trade-result');
  select.addEventListener('change', () => { select.className = `trade-result ${select.value}`; });
  tr.querySelector('.btn-danger').addEventListener('click', () => tr.remove());
  tbody.appendChild(tr);
}

function clearTradeTable() {
  const tbody = document.querySelector('#tradeTable tbody');
  if (tbody) tbody.innerHTML = '';
}

function collectTradeDetails() {
  const tbody = document.querySelector('#tradeTable tbody');
  if (!tbody) return [];

  return Array.from(tbody.querySelectorAll('tr')).map(tr => {
    const get = sel => tr.querySelector(sel)?.value.trim() || '';
    const pnlRaw = tr.querySelector('.trade-pnl')?.value.trim() || '';
    const row = {
      datetime: get('.trade-datetime'), product: get('.trade-product'),
      timeframe: get('.trade-timeframe'), snrType: get('.trade-snr'),
      emaOrder: get('.trade-ema-order'), emaFit: get('.trade-ema-fit'),
      kbarPattern: get('.trade-kbar'), dxyDiv: get('.trade-dxy'),
      result: get('.trade-result'),
      pnl: pnlRaw !== '' ? parseFloat(pnlRaw) : null,
    };
    const vals = [row.datetime, row.product, row.timeframe, row.snrType,
                  row.emaOrder, row.emaFit, row.kbarPattern, row.dxyDiv, row.result];
    if (vals.every(v => v === '') && row.pnl === null) return null;
    return row;
  }).filter(Boolean);
}

/* ===================== 套用模板 ===================== */
function applyTemplate(name) {
  currentTemplate = name;
  const t = TEMPLATES[name];

  document.getElementById('mainPanel')?.classList.remove('hidden');
  document.getElementById('templateHint').textContent = t.hint;

  const isTrade = name === 'trade';
  document.getElementById('tradeProductSection')?.classList.toggle('hidden', !isTrade);
  document.getElementById('tradeTableSection')?.classList.toggle('hidden', !isTrade);
  document.getElementById('tradeReminder')?.classList.toggle('hidden', !isTrade);
  document.getElementById('dateRow')?.classList.toggle('hidden', isTrade);
  document.getElementById('tradeStats')?.classList.toggle('hidden', !isTrade);

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

  document.getElementById('title').placeholder   = t.titlePlaceholder;
  document.getElementById('content').placeholder = t.contentPlaceholder;
  document.getElementById('value').placeholder   = t.valuePlaceholder;

  document.querySelectorAll('[data-template]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.template === name);
  });

  if (isTrade) {
    const tbody = document.querySelector('#tradeTable tbody');
    if (tbody && tbody.children.length === 0) addTradeRow();
  }

  loadRecords();
}

/* ===================== 品種 Tab ===================== */
function setTradeProduct(product) {
  currentTradeProduct = product;
  document.querySelectorAll('.product-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.product === product);
  });
  loadRecords();
}

/* ===================== 列表 ===================== */
function loadRecords() {
  const listEl = document.getElementById('recordList');
  if (!listEl || !currentTemplate) return;

  const def = TEMPLATES[currentTemplate].defaultCategory;
  let filtered = [];

  if (currentTemplate === 'trade') {
    filtered = records.filter(r => {
      if (r.category !== '交易') return false;
      if (!r.tradeDetails || r.tradeDetails.length === 0) return true;
      return r.tradeDetails.some(d =>
        (d.product || '').toUpperCase() === currentTradeProduct.toUpperCase()
      );
    });
    renderTradeStats(filtered);
  } else if (def) {
    filtered = records.filter(r => r.category === def);
  } else {
    const inputCat = (document.getElementById('category')?.value || '').trim();
    if (!inputCat) {
      listEl.innerHTML = '<p style="color:var(--text-hint);font-size:14px;">自訂分類請先在「類別」輸入分類名稱，才會顯示列表。</p>';
      return;
    }
    filtered = records.filter(r => (r.category || '') === inputCat);
  }

  if (!filtered.length) {
    listEl.innerHTML = '<p style="color:var(--text-hint);font-size:14px;">這個分類目前沒有紀錄。</p>';
    return;
  }

  listEl.innerHTML = filtered
    .slice().sort((a, b) => b.id - a.id)
    .map(recordToHTML).join('');
}

/* ===================== 勝率統計 ===================== */
function renderTradeStats(filteredRecords) {
  const rows = filteredRecords.flatMap(r =>
    (r.tradeDetails || []).filter(d =>
      (d.product || '').toUpperCase() === currentTradeProduct.toUpperCase()
    )
  );

  const winCount  = rows.filter(d => d.result === 'win').length;
  const loseCount = rows.filter(d => d.result === 'lose').length;
  const decided   = winCount + loseCount;
  const rate      = decided > 0 ? ((winCount / decided) * 100).toFixed(1) + '%' : '—';

  let totalPnl = null;
  rows.forEach(d => {
    const n = parsePnl(d.pnl);
    if (n !== null) { totalPnl = (totalPnl ?? 0) + n; }
  });
  const pnlText = totalPnl !== null
    ? (totalPnl >= 0 ? '+' : '') + totalPnl.toFixed(1) + ' 點' : '—';

  document.getElementById('statTotal').textContent = `總計：${rows.length} 筆`;
  document.getElementById('statWin').textContent   = `勝：${winCount}`;
  document.getElementById('statLose').textContent  = `敗：${loseCount}`;
  document.getElementById('statRate').textContent  = `勝率：${rate}`;
  document.getElementById('statPnl').textContent   = `累計盈虧：${pnlText}`;
}

/* ===================== 卡片渲染 ===================== */
function recordToHTML(r) {
  const isTrade  = r.category === '交易';
  const metaLine = r.date ? `日期：${escapeHTML(r.date)}` : '';

  let tradeMini = '';
  if (isTrade && Array.isArray(r.tradeDetails) && r.tradeDetails.length > 0) {
    const rows = r.tradeDetails.filter(d =>
      (d.product || '').toUpperCase() === currentTradeProduct.toUpperCase()
    );
    if (rows.length > 0) {
      tradeMini = `
        <div class="trade-mini">
          <table>
            <thead>
              <tr>
                <th>日期時間</th><th>商品</th><th>週期</th><th>SNR</th>
                <th>EMA排列</th><th>EMA貼合</th><th>K棒型態</th><th>DXY背離</th>
                <th>結果</th><th>盈虧（點）</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(d => {
                const pnl      = parsePnl(d.pnl);
                const pnlClass = pnl === null ? '' : pnl >= 0 ? 'pnl-positive' : 'pnl-negative';
                const pnlText  = pnl === null ? '—' : (pnl >= 0 ? '+' : '') + pnl.toFixed(1);
                const resultLabel = { win: '✅ 勝', lose: '❌ 敗', draw: '➖ 平' }[d.result] || '—';
                return `
                  <tr>
                    <td>${escapeHTML(d.datetime||'')}</td>
                    <td>${escapeHTML(d.product||'')}</td>
                    <td>${escapeHTML(d.timeframe||'')}</td>
                    <td>${escapeHTML(d.snrType||'')}</td>
                    <td>${escapeHTML(d.emaOrder||'')}</td>
                    <td>${escapeHTML(d.emaFit||'')}</td>
                    <td>${escapeHTML(d.kbarPattern||'')}</td>
                    <td>${escapeHTML(d.dxyDiv||'')}</td>
                    <td><span class="result-badge ${d.result||''}">${resultLabel}</span></td>
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
          ${r.category && !isTrade ? `<span class="record-category">（${escapeHTML(r.category)}）</span>` : ''}
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

  if (!title) { alert('標題必填'); return; }

  if (TEMPLATES[currentTemplate]?.defaultCategory) {
    category = TEMPLATES[currentTemplate].defaultCategory;
  }

  const tradeDetails = currentTemplate === 'trade' ? collectTradeDetails() : [];
  const now = new Date().toISOString();

  const newRecord = {
    id: Date.now(),
    title, category, content, value, date, tradeDetails,
    createdAt: now, updatedAt: now
  };

  try {
    showStatus('儲存中…');
    records.push(newRecord);
    await saveToDrive();
    showStatus('已儲存！');

    document.getElementById('recordForm')?.reset();
    if (TEMPLATES[currentTemplate]?.defaultCategory) {
      document.getElementById('category').value = TEMPLATES[currentTemplate].defaultCategory;
    }
    if (currentTemplate === 'trade') { clearTradeTable(); addTradeRow(); }

    loadRecords();
  } catch (err) {
    records.pop(); // 儲存失敗就回滾
    console.error(err);
    showStatus('儲存失敗：' + err.message, true);
  }
}

/* ===================== 刪除紀錄 ===================== */
async function deleteRecord(id) {
  if (!confirm('確定要刪除這筆紀錄嗎？')) return;

  const idx = records.findIndex(r => r.id === id);
  if (idx === -1) return;

  const deleted = records.splice(idx, 1)[0];
  try {
    showStatus('刪除中…');
    await saveToDrive();
    showStatus('已刪除');
    loadRecords();
  } catch (err) {
    records.splice(idx, 0, deleted); // 回滾
    console.error(err);
    showStatus('刪除失敗：' + err.message, true);
  }
}

/* ===================== 初始化 ===================== */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('recordForm')?.addEventListener('submit', handleSubmit);

  document.querySelectorAll('[data-template]').forEach(btn => {
    btn.addEventListener('click', () => applyTemplate(btn.dataset.template));
  });

  document.getElementById('addTradeRowBtn')?.addEventListener('click', () => addTradeRow());

  document.querySelectorAll('.product-tab').forEach(btn => {
    btn.addEventListener('click', () => setTradeProduct(btn.dataset.product));
  });

  initGoogleAuth();
});