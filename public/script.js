/* =====================================================================
   個人紀錄回顧平台 - script.js
   資料儲存：Google Drive（records.json）
   ===================================================================== */

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
    titlePlaceholder: '',
    contentPlaceholder: '這一組交易的整體想法與情緒（可留空）。',
    valuePlaceholder: '',
    hint: '交易模板：先選品種，用下方表格記錄每一單明細。'
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
let tokenExpiresAt      = 0;    // ms timestamp，token 到期時間
let driveFileId         = null;
let records             = [];
let _tokenClient        = null; // 供 refreshToken() 使用

/* ===================== 工具 ===================== */
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
  const n = parseFloat(String(val ?? '').trim());
  return isNaN(n) ? null : n;
}

/* ===================== Google 登入 ===================== */
function initGoogleAuth() {
  const waitGSI = setInterval(() => {
    if (window.google && window.google.accounts) {
      clearInterval(waitGSI);
      setupTokenClient();
    }
  }, 100);
}

function setupTokenClient() {
  // 初次登入用的 client（會彈授權視窗）
  _tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: async (tokenResponse) => {
      if (tokenResponse.error) { console.error('授權失敗：', tokenResponse); return; }
      accessToken    = tokenResponse.access_token;
      tokenExpiresAt = Date.now() + (tokenResponse.expires_in - 300) * 1000;
      await onLoginSuccess();
    }
  });

  document.getElementById('loginBtnMain')?.addEventListener('click', () => {
    _tokenClient.requestAccessToken({ prompt: 'consent' });
  });

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    google.accounts.oauth2.revoke(accessToken, () => {
      accessToken    = null;
      tokenExpiresAt = 0;
      driveFileId    = null;
      records        = [];
      currentTemplate = null;

      document.getElementById('mainPanel')?.classList.add('hidden');
      document.querySelectorAll('[data-template]').forEach(btn => btn.classList.remove('active'));
      document.getElementById('templateHint').textContent = '請先點上方分類按鈕開始。';

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

  try {
    const res  = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const info = await res.json();
    const el   = document.getElementById('userName');
    if (el) el.textContent = info.name || info.email || '';
  } catch (_) {}

  await loadFromDrive();
  if (currentTemplate) applyTemplate(currentTemplate);
}

/* ===================== Token 自動刷新 ===================== */

/** 確保 token 有效，過期就靜默刷新後 resolve */
function ensureToken() {
  // token 還有效就直接過
  if (accessToken && Date.now() < tokenExpiresAt) return Promise.resolve();

  // 需要刷新：建立一個一次性 client 來靜默取得新 token
  return new Promise((resolve, reject) => {
    const refreshClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (tokenResponse) => {
        if (tokenResponse.error) {
          reject(new Error('Token 刷新失敗：' + tokenResponse.error));
          return;
        }
        accessToken    = tokenResponse.access_token;
        tokenExpiresAt = Date.now() + (tokenResponse.expires_in - 300) * 1000;
        resolve();
      }
    });
    // prompt: '' 表示靜默刷新，不彈視窗
    refreshClient.requestAccessToken({ prompt: '' });

    // 10 秒超時保護
    setTimeout(() => reject(new Error('Token 刷新逾時')), 10000);
  });
}


/* ===================== Google Drive ===================== */
async function findOrCreateFile() {
  const searchRes  = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${FILE_NAME}'&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    driveFileId = searchData.files[0].id;
    return;
  }

  const createRes  = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] })
  });
  const createData = await createRes.json();
  driveFileId = createData.id;
}

async function loadFromDrive() {
  try {
    showStatus('載入中…');
    if (!accessToken || Date.now() >= tokenExpiresAt) {
      await ensureToken();
    }
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

async function saveToDrive() {
  if (!accessToken || Date.now() >= tokenExpiresAt) {
    await ensureToken();
  }
  if (!driveFileId) await findOrCreateFile();
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
  await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=media`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: blob
    }
  );
}

/* ===================== 交易表格（新增用） ===================== */
function addTradeRow(data = {}) {
  const tbody = document.querySelector('#tradeTable tbody');
  if (!tbody) return;

  const result = data.result || '';
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="trade-datetime" value="${escapeHTML(data.datetime || '')}" placeholder="0326 2140"></td>
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
    const get    = sel => tr.querySelector(sel)?.value.trim() || '';
    const pnlRaw = tr.querySelector('.trade-pnl')?.value.trim() || '';
    const row = {
      datetime:    get('.trade-datetime'),
      product:     currentTradeProduct,
      timeframe:   get('.trade-timeframe'),
      snrType:     get('.trade-snr'),
      emaOrder:    get('.trade-ema-order'),
      emaFit:      get('.trade-ema-fit'),
      kbarPattern: get('.trade-kbar'),
      dxyDiv:      get('.trade-dxy'),
      result:      get('.trade-result'),
      pnl:         pnlRaw !== '' ? parseFloat(pnlRaw) : null,
    };
    const vals = [row.datetime, row.timeframe, row.snrType, row.emaOrder,
                  row.emaFit, row.kbarPattern, row.dxyDiv, row.result];
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

  // 交易專屬顯示/隱藏
  document.getElementById('tradeProductSection')?.classList.toggle('hidden', !isTrade);
  document.getElementById('tradeTableSection')?.classList.toggle('hidden', !isTrade);
  document.getElementById('tradeReminder')?.classList.toggle('hidden', !isTrade);
  document.getElementById('dateRow')?.classList.toggle('hidden', isTrade);
  document.getElementById('tradeStats')?.classList.toggle('hidden', !isTrade);
  document.getElementById('tradeListTable')?.classList.toggle('hidden', !isTrade);
  document.getElementById('recordList')?.classList.toggle('hidden', isTrade);

  // 交易時隱藏標題/類別/數值
  document.getElementById('generalFields')?.classList.toggle('hidden', isTrade);

  // 類別欄
  const categoryInput = document.getElementById('category');
  if (categoryInput) {
    if (t.defaultCategory) {
      categoryInput.value   = t.defaultCategory;
      categoryInput.readOnly = true;
    } else {
      categoryInput.readOnly = false;
      categoryInput.value    = '';
      categoryInput.placeholder = '輸入你想要的分類，例如：心情、工作…';
    }
  }

  const titleInput   = document.getElementById('title');
  const contentInput = document.getElementById('content');
  const valueInput   = document.getElementById('value');
  if (titleInput)   titleInput.placeholder   = t.titlePlaceholder;
  if (contentInput) contentInput.placeholder = t.contentPlaceholder;
  if (valueInput)   valueInput.placeholder   = t.valuePlaceholder;

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
  if (!currentTemplate) return;

  if (currentTemplate === 'trade') {
    renderTradeEditTable();
    return;
  }

  const listEl = document.getElementById('recordList');
  if (!listEl) return;

  const def = TEMPLATES[currentTemplate].defaultCategory;
  let filtered = [];

  if (def) {
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

/* ===================== 交易可編輯大表格 ===================== */
function renderTradeEditTable() {
  const tbody = document.getElementById('tradeEditBody');
  if (!tbody) return;

  // 篩選當前品種的所有 tradeDetail 列，並附帶其所屬 record id
  const rows = [];
  records.forEach(r => {
    if (r.category !== '交易') return;
    (r.tradeDetails || []).forEach((d, dIdx) => {
      if ((d.product || '').toUpperCase() === currentTradeProduct.toUpperCase()) {
        rows.push({ recordId: r.id, detailIdx: dIdx, ...d });
      }
    });
  });

  // 更新統計
  renderTradeStats(rows);

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--text-hint);padding:20px;">這個品種目前沒有紀錄。</td></tr>`;
    return;
  }

  // 由新到舊排序（用 recordId 近似時間）
  rows.sort((a, b) => b.recordId - a.recordId);

  tbody.innerHTML = '';
  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.dataset.recordId  = row.recordId;
    tr.dataset.detailIdx = row.detailIdx;

    const result = row.result || '';
    tr.innerHTML = `
      <td><input type="text" class="edit-datetime" value="${escapeHTML(row.datetime || '')}"></td>
      <td><input type="text" class="edit-timeframe" value="${escapeHTML(row.timeframe || '')}"></td>
      <td><input type="text" class="edit-snr" value="${escapeHTML(row.snrType || '')}"></td>
      <td><input type="text" class="edit-ema-order" value="${escapeHTML(row.emaOrder || '')}"></td>
      <td><input type="text" class="edit-ema-fit" value="${escapeHTML(row.emaFit || '')}"></td>
      <td><input type="text" class="edit-kbar" value="${escapeHTML(row.kbarPattern || '')}"></td>
      <td><input type="text" class="edit-dxy" value="${escapeHTML(row.dxyDiv || '')}"></td>
      <td>
        <select class="edit-result ${result}">
          <option value="">—</option>
          <option value="win" ${result === 'win' ? 'selected' : ''}>✅ 勝</option>
          <option value="lose" ${result === 'lose' ? 'selected' : ''}>❌ 敗</option>
          <option value="draw" ${result === 'draw' ? 'selected' : ''}>➖ 平</option>
        </select>
      </td>
      <td><input type="number" class="edit-pnl" value="${escapeHTML(String(row.pnl ?? ''))}" step="0.1"></td>
      <td><button type="button" class="btn-danger delete-edit-row">刪除</button></td>
    `;

    // 離開欄位自動存
    tr.querySelectorAll('input, select').forEach(input => {
      input.addEventListener('change', () => saveEditRow(tr));
      input.addEventListener('blur',   () => saveEditRow(tr));
    });

    // 結果欄顏色
    const sel = tr.querySelector('.edit-result');
    sel.addEventListener('change', () => { sel.className = `edit-result ${sel.value}`; });

    // 刪除
    tr.querySelector('.delete-edit-row').addEventListener('click', () => deleteDetailRow(tr));

    tbody.appendChild(tr);
  });
}

/** 從可編輯表格收集一列的值，存回 records 並寫 Drive */
async function saveEditRow(tr) {
  const recordId  = Number(tr.dataset.recordId);
  const detailIdx = Number(tr.dataset.detailIdx);

  const record = records.find(r => r.id === recordId);
  if (!record || !record.tradeDetails[detailIdx]) return;

  const get    = sel => tr.querySelector(sel)?.value.trim() || '';
  const pnlRaw = tr.querySelector('.edit-pnl')?.value.trim() || '';

  record.tradeDetails[detailIdx] = {
    ...record.tradeDetails[detailIdx],
    datetime:    get('.edit-datetime'),
    timeframe:   get('.edit-timeframe'),
    snrType:     get('.edit-snr'),
    emaOrder:    get('.edit-ema-order'),
    emaFit:      get('.edit-ema-fit'),
    kbarPattern: get('.edit-kbar'),
    dxyDiv:      get('.edit-dxy'),
    result:      get('.edit-result'),
    pnl:         pnlRaw !== '' ? parseFloat(pnlRaw) : null,
  };
  record.updatedAt = new Date().toISOString();

  try {
    await saveToDrive();
    // 更新統計但不重繪表格（避免游標跳走）
    const rows = [];
    records.forEach(r => {
      if (r.category !== '交易') return;
      (r.tradeDetails || []).forEach((d) => {
        if ((d.product || '').toUpperCase() === currentTradeProduct.toUpperCase()) rows.push(d);
      });
    });
    renderTradeStats(rows);
  } catch (err) {
    console.error('自動存失敗：', err);
  }
}

/** 刪除可編輯表格的某一列 */
async function deleteDetailRow(tr) {
  if (!confirm('確定要刪除這筆明細嗎？')) return;

  const recordId  = Number(tr.dataset.recordId);
  const detailIdx = Number(tr.dataset.detailIdx);

  const record = records.find(r => r.id === recordId);
  if (!record) return;

  record.tradeDetails.splice(detailIdx, 1);

  // 如果這筆 record 的 tradeDetails 全空了，整筆刪掉
  if (record.tradeDetails.length === 0 && !record.content) {
    const idx = records.findIndex(r => r.id === recordId);
    if (idx !== -1) records.splice(idx, 1);
  }

  try {
    await saveToDrive();
    renderTradeEditTable();
  } catch (err) {
    console.error('刪除失敗：', err);
  }
}

/* ===================== 勝率統計 ===================== */
function renderTradeStats(rows) {
  const winCount  = rows.filter(d => d.result === 'win').length;
  const loseCount = rows.filter(d => d.result === 'lose').length;
  const decided   = winCount + loseCount;
  const rate      = decided > 0 ? ((winCount / decided) * 100).toFixed(1) + '%' : '—';

  let totalPnl = null;
  rows.forEach(d => {
    const n = parsePnl(d.pnl);
    if (n !== null) totalPnl = (totalPnl ?? 0) + n;
  });
  const pnlText = totalPnl !== null
    ? (totalPnl >= 0 ? '+' : '') + totalPnl.toFixed(1) + ' 點' : '—';

  document.getElementById('statTotal').textContent = `總計：${rows.length} 筆`;
  document.getElementById('statWin').textContent   = `勝：${winCount}`;
  document.getElementById('statLose').textContent  = `敗：${loseCount}`;
  document.getElementById('statRate').textContent  = `勝率：${rate}`;
  document.getElementById('statPnl').textContent   = `累計盈虧：${pnlText}`;
}

/* ===================== 一般卡片渲染 ===================== */
function recordToHTML(r) {
  const metaLine = r.date ? `日期：${escapeHTML(r.date)}` : '';
  return `
    <div class="record-card">
      <div class="record-header">
        <div>
          <strong>${escapeHTML(r.title)}</strong>
          ${r.category ? `<span class="record-category">（${escapeHTML(r.category)}）</span>` : ''}
        </div>
        <div class="record-actions">
          <button onclick="deleteRecord(${r.id})">刪除</button>
        </div>
      </div>
      ${metaLine ? `<div class="record-meta">${metaLine}</div>` : ''}
      <div class="record-content">${r.content ? escapeHTML(r.content) : ''}</div>
      ${r.value ? `<div class="record-value">數值：${escapeHTML(r.value)}</div>` : ''}
    </div>
  `;
}

/* ===================== 新增紀錄 ===================== */
async function handleSubmit(e) {
  e.preventDefault();

  const isTrade  = currentTemplate === 'trade';
  const title    = isTrade ? (currentTradeProduct + ' 交易') : (document.getElementById('title')?.value.trim() || '');
  const category = TEMPLATES[currentTemplate]?.defaultCategory || document.getElementById('category')?.value.trim() || '';
  const content  = document.getElementById('content')?.value.trim() || '';
  const value    = isTrade ? '' : (document.getElementById('value')?.value.trim() || '');
  const date     = isTrade ? '' : (document.getElementById('date')?.value || '');

  if (!isTrade && !title) { alert('標題必填'); return; }

  const tradeDetails = isTrade ? collectTradeDetails() : [];
  if (isTrade && tradeDetails.length === 0) { alert('請至少填寫一列交易明細'); return; }

  const now = new Date().toISOString();
  const newRecord = { id: Date.now(), title, category, content, value, date, tradeDetails, createdAt: now, updatedAt: now };

  try {
    showStatus('儲存中…');
    records.push(newRecord);
    await saveToDrive();
    showStatus('已儲存！');

    document.getElementById('recordForm')?.reset();
    if (!isTrade && TEMPLATES[currentTemplate]?.defaultCategory) {
      document.getElementById('category').value = TEMPLATES[currentTemplate].defaultCategory;
    }
    if (isTrade) { clearTradeTable(); addTradeRow(); }

    loadRecords();
  } catch (err) {
    records.pop();
    console.error(err);
    showStatus('儲存失敗：' + err.message, true);
  }
}

/* ===================== 刪除紀錄（一般） ===================== */
async function deleteRecord(id) {
  if (!confirm('確定要刪除這筆紀錄嗎？')) return;

  const idx = records.findIndex(r => r.id === id);
  if (idx === -1) return;

  const deleted = records.splice(idx, 1)[0];
  try {
    await saveToDrive();
    showStatus('已刪除');
    loadRecords();
  } catch (err) {
    records.splice(idx, 0, deleted);
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