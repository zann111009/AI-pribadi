const express = require('express');
const router = express.Router();
const axios = require('axios');
const SessionStore = require('../stores/session');
const { sendMessage, listModels, GEMINI_API_URL } = require('../services/openrouter');
const { generateImage } = require('../services/image');

const session = new SessionStore();

router.post('/chat', async (req, res, next) => {
  try {
    const { message, userName } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({
        error: 'Pesan tidak boleh kosong',
        valid: false,
      });
    }

    session.add('user', message.trim());

    const fullHistory = session.getAll();

    const result = await sendMessage(fullHistory, undefined, { userName });
    const aiResponse = result.text;

    session.add('assistant', aiResponse);

    res.json({
      response: aiResponse,
      timestamp: new Date().toISOString(),
      sessionSize: session.size(),
      model: result.model,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/models', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY belum diatur' });
    }

    const models = await listModels(apiKey);

    const filtered = models
      .filter((m) => {
        const methods = m.supportedGenerationMethods || [];
        return methods.includes('generateContent');
      })
      .map((m) => ({
        name: m.name,
        displayName: m.displayName,
        description: m.description,
        supportedGenerationMethods: m.supportedGenerationMethods,
      }));

    res.json({ models: filtered });
  } catch (error) {
    console.error('[ListModels]', error.message);
    res.status(500).json({
      error: 'Gagal mengambil daftar model',
      detail: error.message,
    });
  }
});

router.post('/generate-image', async (req, res, next) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return res.status(400).json({
        error: 'Prompt tidak boleh kosong',
        valid: false,
      });
    }

    const image = await generateImage(prompt.trim());

    res.set('Content-Type', image.mimeType || 'image/png');
    res.send(image.buffer);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
