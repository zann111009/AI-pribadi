const axios = require('axios');

const HF_API_URL =
  process.env.HF_API_URL || 'https://router.huggingface.co/fal-ai/fal-ai/flux/schnell';
const HF_PLACEHOLDER_KEY = 'ganti-dengan-api-key-huggingface-anda';

const POLLINATIONS_ENABLED = process.env.POLLINATIONS_ENABLED !== 'false';
const POLLINATIONS_BASE = process.env.POLLINATIONS_BASE || 'https://image.pollinations.ai/prompt';
const POLLINATIONS_MODELS = (process.env.POLLINATIONS_MODELS || 'sana,flux')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
const POLLINATIONS_WIDTH = parseInt(process.env.POLLINATIONS_WIDTH || '1024', 10);
const POLLINATIONS_HEIGHT = parseInt(process.env.POLLINATIONS_HEIGHT || '1024', 10);
const POLLINATIONS_MAX_WAIT = parseInt(process.env.POLLINATIONS_MAX_WAIT || '25000', 10);

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
const GEMINI_IMAGE_ENABLED = process.env.GEMINI_IMAGE_ENABLED !== 'false';

const MAX_ATTEMPTS = 3;
const BASE_DELAY = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNetworkCode(code) {
  return ['ENOTFOUND', 'ENETUNREACH', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN'].includes(code);
}

function describeError(error) {
  const status = error.response?.status;
  const data = error.response?.data;

  if (status === 401 || status === 403) return 'API key tidak valid (401/403)';
  if (status === 402) return 'kredit tidak cukup (402)';
  if (status === 404) return 'model tidak ditemukan (404)';
  if (status === 410) return 'model sudah deprecated (410)';
  if (status === 429) return 'terlalu banyak request (429)';
  if (status === 503) return 'model sedang memuat (503)';
  if (status === 400) {
    const msg = data?.error?.message || data?.message || 'permintaan tidak valid';
    return `permintaan tidak valid (400): ${String(msg).slice(0, 160)}`;
  }
  if (status) return `HTTP ${status}`;
  if (isNetworkCode(error.code)) return `koneksi gagal (${error.code})`;
  return error.message || 'gagal tanpa keterangan';
}

async function generateWithHuggingFace(prompt, apiKey) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const isLast = attempt === MAX_ATTEMPTS;
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

      return {
        buffer: Buffer.from(response.data),
        mimeType: response.headers['content-type'] || 'image/png',
        provider: 'Hugging Face',
      };
    } catch (error) {
      const status = error.response?.status;
      const data = error.response?.data;

      if (!status && error.code) {
        console.error(`[Image:HF] Network error code=${error.code} url=${HF_API_URL} message=${error.message}`);
      }

      if (status === 503 && !isLast) {
        const estimatedTime = parseInt(data?.estimated_time || '20', 10);
        const delay = Math.max(BASE_DELAY, estimatedTime * 1000);
        console.warn(`[Image:HF] Model loading, retry ${attempt}/${MAX_ATTEMPTS} after ${delay}ms`);
        await sleep(delay);
        continue;
      }

      throw error;
    }
  }

  throw new Error('Hugging Face gagal setelah beberapa percobaan');
}

async function generateWithPollinations(prompt) {
  const deadline = Date.now() + POLLINATIONS_MAX_WAIT;
  const attempts = [];

  for (const model of POLLINATIONS_MODELS) {
    const url =
      `${POLLINATIONS_BASE}/${encodeURIComponent(prompt)}` +
      `?width=${POLLINATIONS_WIDTH}&height=${POLLINATIONS_HEIGHT}` +
      `&model=${model}&nologo=true&seed=${Date.now() % 100000}`;

    try {
      const response = await axios.get(url, {
        timeout: 180000,
        responseType: 'arraybuffer',
        headers: { Accept: 'image/*' },
      });

      const mimeType = response.headers['content-type'] || 'image/jpeg';
      const buffer = Buffer.from(response.data);

      if (!mimeType.startsWith('image/')) {
        throw new Error(`Pollinations mengembalikan tipe tidak valid: ${mimeType}`);
      }

      return { buffer, mimeType, provider: `Pollinations (${model})` };
    } catch (error) {
      const reason = describeError(error);
      attempts.push(`${model}: ${reason}`);

      // Free tier: 1 gambar per 45 detik per IP. Tunggu sedikit lalu coba lagi.
      const isFreeLimit = error.response?.status === 402;
      const isLoading = error.response?.status === 503;
      if ((isFreeLimit || isLoading) && Date.now() < deadline) {
        const wait = Math.min(5000, Math.max(0, deadline - Date.now()));
        if (wait > 0) {
          console.warn(`[Image:Pollinations] ${reason}, menunggu ${wait}ms lalu mencoba lagi`);
          await sleep(wait);
          continue;
        }
      }
    }
  }

  const err = new Error(`Pollinations gagal: ${attempts.join(' | ')}`);
  err.code = 'POLLINATIONS_FAILED';
  throw err;
}

async function generateWithGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY belum diatur');

  const response = await axios.post(
    `${GEMINI_API_URL}/${GEMINI_IMAGE_MODEL}:generateContent?key=${apiKey}`,
    {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    },
    { timeout: 180000 }
  );

  const parts = response.data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p) => p.inlineData && p.inlineData.data);

  if (!imagePart) throw new Error('Respons Gemini tidak berisi gambar');

  return {
    buffer: Buffer.from(imagePart.inlineData.data, 'base64'),
    mimeType: imagePart.inlineData.mimeType || 'image/png',
    provider: 'Gemini',
  };
}

async function generateImage(prompt) {
  const apiKey = process.env.HF_API_KEY;
  const failures = [];

  const providers = [];

  if (apiKey && apiKey !== HF_PLACEHOLDER_KEY) {
    providers.push({ name: 'Hugging Face', run: () => generateWithHuggingFace(prompt, apiKey) });
  } else if (!apiKey) {
    failures.push('Hugging Face: HF_API_KEY belum diatur');
  } else {
    failures.push('Hugging Face: API key masih placeholder');
  }

  if (POLLINATIONS_ENABLED) {
    providers.push({ name: 'Pollinations', run: () => generateWithPollinations(prompt) });
  }

  if (GEMINI_IMAGE_ENABLED && process.env.GEMINI_API_KEY) {
    providers.push({ name: 'Gemini', run: () => generateWithGemini(prompt) });
  }

  if (providers.length === 0) {
    throw new Error('Tidak ada provider generate image yang aktif');
  }

  for (const provider of providers) {
    try {
      const result = await provider.run();
      console.log(`[Image] Berhasil via ${result.provider} (${result.buffer.length} bytes)`);
      return result;
    } catch (error) {
      const reason = describeError(error);
      console.error(`[Image:${provider.name}] Gagal: ${reason}`);
      failures.push(`${provider.name}: ${reason}`);
    }
  }

  const summary = failures.join(' | ');
  const err = new Error(
    `Semua provider generate image gagal: ${summary}. ` +
    'Tambahkan kredit di huggingface.co/settings/billing untuk generate tanpa batas, ' +
    'atau tunggu 45 detik sebelum mencoba lagi.'
  );
  err.code = 'IMAGE_PROVIDERS_FAILED';
  err.failures = failures;
  throw err;
}

module.exports = {
  generateImage,
  generateWithHuggingFace,
  generateWithPollinations,
  generateWithGemini,
  describeError,
};
