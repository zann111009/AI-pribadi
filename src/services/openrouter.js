const axios = require('axios');

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const GENERATE_URL = (model) => `${GEMINI_API_URL}/${model}:generateContent`;

const SYSTEM_PROMPT = [
  'Kamu adalah Zann-AI, asisten AI pribadi yang membantu pengguna.',
  'Format semua jawaban dengan Markdown yang rapi.',
  'Gunakan paragraf pendek, judul (##) seperlunya, daftar berpoin untuk poin-poin,',
  'dan tabel Markdown untuk perbandingan atau data terstruktur.',
  'Jangan menulis semuanya dalam satu paragraf panjang.',
].join(' ');

const USER_NAME_MAX = 32;

function sanitizeUserName(userName) {
  if (typeof userName !== 'string') return '';
  return userName.replace(/[\r\n]+/g, ' ').trim().slice(0, USER_NAME_MAX);
}

function buildSystemPrompt(userName) {
  const name = sanitizeUserName(userName);
  if (!name) return SYSTEM_PROMPT;

  return [
    SYSTEM_PROMPT,
    `Nama pengguna yang sedang kamu bicarai adalah "${name}".`,
    'Sapa dan panggil pengguna dengan nama tersebut secara natural, misalnya "Hai ' + name + ', ...".',
    'Gunakan nama itu juga ketika jawaban bersifat personal atau menyapa pengguna.',
    'Jika nama pengguna tidak relevan dengan pertanyaan, tidak perlu Disebutkan.',
  ].join(' ');
}

function toGeminiMessages(messages) {
  const contents = [];
  for (const m of messages) {
    if (m.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: m.content }] });
    } else if (m.role === 'assistant') {
      contents.push({ role: 'model', parts: [{ text: m.content }] });
    }
  }
  return contents;
}

async function listModels(apiKey) {
  const response = await axios.get(`${GEMINI_API_URL}?key=${apiKey}`, {
    timeout: 30000,
  });
  return response.data.models || [];
}

async function sendMessage(messages, modelOverride, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY belum diatur di file .env');
  }

  const model = modelOverride || DEFAULT_MODEL;
  const contents = toGeminiMessages(messages);

  const body = {
    system_instruction: {
      parts: [{ text: buildSystemPrompt(options.userName) }],
    },
    contents,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
  };

  const url = `${GENERATE_URL(model)}?key=${apiKey}`;

  const maxRetries = 3;
  const baseDelay = 1500;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(url, body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 180000,
      });

      const candidate = response.data?.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text;
      const finishReason = candidate?.finishReason;

      if (!text) {
        throw new Error('Respons dari Gemini kosong');
      }

      console.log(`[Gemini] model=${model} finishReason=${finishReason || '-'}`);
      return { text, model, finishReason };
    } catch (error) {
      const status = error.response?.status;
      const googleMessage = error.response?.data?.error?.message || error.message;
      lastError = error;

      console.error(`[GeminiError] model=${model} status=${status} message=${googleMessage}`);

      // Coba lagi pada rate limit (429) atau layanan tidak tersedia (503)
      if ((status === 429 || status === 503) && attempt < maxRetries) {
        const delay = baseDelay * attempt;
        console.warn(`[Gemini] ${status}, coba lagi ${attempt}/${maxRetries} setelah ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (status === 404 && !modelOverride) {
        console.warn(`[Fallback] Model ${model} tidak ditemukan. Mencari alternatif...`);
        const models = await listModels(apiKey);
        const fallback = models.find((m) => {
          const name = m.name.replace('models/', '');
          return name.startsWith('gemini-3') && name.includes('flash');
        });

        if (fallback) {
          const fallbackName = fallback.name.replace('models/', '');
          console.warn(`[Fallback] Mencoba ${fallbackName}...`);
          return sendMessage(messages, fallbackName, options);
        } else {
          console.error('[Fallback] Tidak ada model alternatif yang cocok.');
        }
      }

      throw error;
    }
  }

  throw lastError;
}

module.exports = {
  sendMessage,
  listModels,
  DEFAULT_MODEL,
  GEMINI_API_URL,
  SYSTEM_PROMPT,
  buildSystemPrompt,
  sanitizeUserName,
};
