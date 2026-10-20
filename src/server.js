require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// .env.local dipakai untuk secret khusus pengembangan (mis. token Vercel Blob).
// Di production Vercel menyuntik env var langsung, jadi file ini tidak ada di sana.
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), override: true });
const chatRoute = require('./routes/chat');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', chatRoute);

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint tidak ditemukan' });
  }
  if (path.extname(req.path)) {
    return next();
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Zann-AI running at http://localhost:${PORT}`);
  console.log(`[Config] GEMINI_MODEL=${process.env.GEMINI_MODEL || '(default) gemini-3.5-flash'}`);
  console.log(`[Config] GEMINI_IMAGE_MODEL=${process.env.GEMINI_IMAGE_MODEL || '(tidak diatur)'}`);
});
