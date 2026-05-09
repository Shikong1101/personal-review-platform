const express = require('express');
const path    = require('path');

const app  = express();
const PORT = 3000;

// 靜態檔案（前端）
app.use(express.static(path.join(__dirname, 'public')));

// 所有路由都回傳 index.html（SPA 支援）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running → http://localhost:${PORT}`);
});