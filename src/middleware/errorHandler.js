function errorHandler(err, req, res, next) {
  console.error('[Error]', err.message);
  if (err.response) {
    console.error('[ErrorDetail] status=', err.response.status, 'data=', JSON.stringify(err.response.data));
  }

  const isImageRoute = req.path === '/generate-image';

  const friendly = {
    INVALID_API_KEY: isImageRoute
      ? 'API key Hugging Face tidak valid. Periksa HF_API_KEY di .env.'
      : 'API key Gemini tidak valid. Periksa file .env Anda.',
    HF_KEY_MISSING: 'API key Hugging Face belum diisi. Daftar di huggingface.co/settings/tokens dan isi HF_API_KEY di .env',
    DNS_ERROR: 'Tidak bisa menghubungi layanan AI (DNS error). Periksa koneksi internet/DNS.',
    CONNECTION_ERROR: 'Koneksi ke layanan AI gagal. Periksa firewall/proxy/VPN.',
    RATE_LIMIT: 'Terlalu banyak request, coba lagi sebentar.',
    AI_SERVICE_DOWN: 'Layanan AI sedang tidak tersedia, coba lagi nanti.',
    SERVICE_UNAVAILABLE: 'Koneksi ke layanan AI tidak tersedia.',
    TIMEOUT: 'Request ke AI terlalu lama, coba lagi.',
    INVALID_RESPONSE: 'Respons dari AI tidak valid.',
    INTERNAL_ERROR: 'Terjadi kesalahan pada server.',
    AI_ERROR: err.message || 'Terjadi kesalahan pada layanan AI.',
  };

  const code = err.code || 'INTERNAL_ERROR';

  const msg = err.message || '';
  if (msg.includes('HF_API_KEY') || msg.includes('belum diisi') || msg.includes('Hugging Face')) {
    return res.status(400).json({ error: friendly.HF_KEY_MISSING, code: 'HF_KEY_MISSING' });
  }

  // Handle DNS/connection errors from axios (err.code can be ENOTFOUND, ENETUNREACH, etc.)
  const dnsCodes = ['ENOTFOUND', 'ENETUNREACH', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN'];
  if (dnsCodes.includes(code)) {
    const friendlyCode = code === 'ENOTFOUND' ? 'DNS_ERROR' : 'CONNECTION_ERROR';
    return res.status(503).json({ error: friendly[friendlyCode], code: friendlyCode });
  }

  if (err.response) {
    const status = err.response.status;
    const data = err.response.data;

    if (status === 400 && data?.error?.status === 'INVALID_ARGUMENT') {
      return res.status(500).json({ error: friendly.INVALID_API_KEY, code: 'INVALID_API_KEY' });
    }

    if (status === 401 || status === 403) {
      return res.status(401).json({ error: friendly.INVALID_API_KEY, code: 'INVALID_API_KEY' });
    }

    if (status === 404) {
      return res.status(500).json({ error: 'Model AI tidak ditemukan. Periksa GEMINI_MODEL di .env.', code: 'MODEL_NOT_FOUND' });
    }

    if (status === 429) {
      return res.status(429).json({ error: friendly.RATE_LIMIT, code: 'RATE_LIMIT' });
    }

    if (status >= 500) {
      return res.status(502).json({ error: friendly.AI_SERVICE_DOWN, code: 'AI_SERVICE_DOWN' });
    }

    return res.status(status).json({
      error: data?.error?.message || friendly.AI_ERROR,
      code: 'AI_ERROR',
    });
  }

  // Fallback for any other error with known codes
  if (friendly[code]) {
    return res.status(500).json({ error: friendly[code], code });
  }

  res.status(500).json({ error: friendly.INTERNAL_ERROR, code });
}

module.exports = errorHandler;

module.exports.notFound = (req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' });
};