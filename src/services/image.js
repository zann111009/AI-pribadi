const axios = require('axios');

const HF_API_URL = process.env.HF_API_URL || 'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev';
const HF_PLACEHOLDER_KEY = 'ganti-dengan-api-key-huggingface-anda';

async function generateImage(prompt) {
  const apiKey = process.env.HF_API_KEY;

  if (!apiKey) {
    throw new Error('HF_API_KEY belum diatur di file .env');
  }

  if (apiKey === HF_PLACEHOLDER_KEY) {
    throw new Error('API key Hugging Face belum diisi. Daftar di huggingface.co/settings/tokens dan isi HF_API_KEY di .env');
  }

  const maxAttempts = 3;
  const baseDelay = 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.post(
        HF_API_URL,
        { inputs: prompt },
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 180000,
          responseType: 'arraybuffer',
        }
      );

      return Buffer.from(response.data);
    } catch (error) {
      const isLast = attempt === maxAttempts;
      const status = error.response?.status;
      const data = error.response?.data;

      if (!status && error.code) {
        console.error(`[Image] Network error code=${error.code} url=${HF_API_URL} message=${error.message}`);
      }

      if (status === 503 && !isLast) {
        const estimatedTime = parseInt(data?.estimated_time || '20', 10);
        const delay = Math.max(baseDelay, estimatedTime * 1000);
        console.warn(`[Image] Model loading, retry ${attempt}/${maxAttempts} after ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (status === 401 || status === 403) {
        throw new Error('API key Hugging Face tidak valid. Periksa HF_API_KEY di .env');
      }

      if (status === 429) {
        throw new Error('Terlalu banyak request ke Hugging Face, coba lagi sebentar');
      }

      if (status === 503 && isLast) {
        throw new Error('Model gambar sedang memuat, coba lagi beberapa saat');
      }

      if (status === 400) {
        const msg = data?.error?.message || data?.message || 'Permintaan ke Hugging Face tidak valid';
        throw new Error(msg);
      }

      throw error;
    }
  }
}

module.exports = { generateImage };