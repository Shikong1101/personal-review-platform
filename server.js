const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

const DB_PATH = path.join(__dirname, 'db.json');

function loadDB() {
  try {
    if (!fs.existsSync(DB_PATH)) return [];
    const text = fs.readFileSync(DB_PATH, 'utf8');
    const data = JSON.parse(text || '[]');
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('讀取 db.json 失敗：', err);
    return [];
  }
}

function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

let records = loadDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 前端靜態檔
app.use(express.static(path.join(__dirname, 'public')));

// 取得所有紀錄
app.get('/records', (req, res) => {
  res.json(records);
});

// 新增紀錄（支援 tradeDetails）
app.post('/records', (req, res) => {
  const { title, category, content, value, date, tradeDetails } = req.body;

  if (!title || String(title).trim() === '') {
    return res.status(400).json({ error: 'title 必填' });
  }

  const now = new Date().toISOString();

  const newRecord = {
    id: Date.now(),
    title: String(title).trim(),
    category: category ? String(category).trim() : '',
    content: content ? String(content) : '',
    value: value ? String(value) : '',
    date: date ? String(date) : '',
    tradeDetails: Array.isArray(tradeDetails) ? tradeDetails : [],
    createdAt: now,
    updatedAt: now,
  };

  records.push(newRecord);
  saveDB(records);

  res.status(201).json(newRecord);
});

// 刪除紀錄
app.delete('/records/:id', (req, res) => {
  const id = Number(req.params.id);
  const idx = records.findIndex(r => r.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: '找不到這筆紀錄' });
  }

  const deleted = records.splice(idx, 1)[0];
  saveDB(records);

  res.json(deleted);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});