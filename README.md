# Zann-AI

Aplikasi Zann-AI (Custom Chatbot) berbasis web yang terhubung ke Gemini API.

## Fitur

- Antarmuka chat modern dan responsif (mirip ChatGPT)
- Layout full-screen dengan tema terang/gelap
- Backend Express untuk keamanan API key
- Manajemen konteks percakapan dalam sesi
- Fitur tambahan: Generate Image (Hugging Face FLUX.1)
- Model AI teks: gemini-3.5-flash (Gemini, bisa diubah via GEMINI_MODEL)

## Teknologi

- **Frontend**: HTML, Tailwind CSS (CDN), Vanilla JavaScript
- **Backend**: Node.js, Express
- **AI**: Gemini API
- **Storage**: In-memory session store

## Instalasi

```bash
# 1. Masuk ke folder project
cd ai-pribadi

# 2. Install dependencies
npm install

### Konfigurasi API Key

Edit file `.env` dan masukkan API key Anda:

```env
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-3.5-flash
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
HF_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxxxxx
```

- **Gemini API Key**: Daftar di [aistudio.google.com](https://aistudio.google.com)
- **Hugging Face API Key**: Daftar di [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)

1. Daftar di [aistudio.google.com](https://aistudio.google.com)
2. Dapatkan API Key dari Settings → API Keys
3. Salin ke file `.env`:
    ```
    GEMINI_API_KEY=AIzaSy...
    ```
npm start
# ATAU untuk development mode (auto-restart):
npm run dev

# 5. Buka browser
# http://localhost:3000
```

## Catatan Penting

### Kredital API
- Gemini: **permintaan gratis terbatas** per hari
- Hugging Face: **permintaan gratis terbatas** per hari
- Jika muncul error "rate limit", coba lagi sebentar

### Konfigurasi
- `maxOutputTokens` diatur ke 1024
- Timeout request: 180 detik

### API Key
- **Gemini**: Daftar di [aistudio.google.com](https://aistudio.google.com)
- **Hugging Face**: Daftar di [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
   ```
   GEMINI_API_KEY=AIzaSy...
   ```

## Struktur Folder

```
ai-pribadi/
├── index.html              # Halaman chat (frontend)
├── public/                 # File statis
│   ├── css/styles.css     # Styling custom
│   └── js/                # Frontend JavaScript
│       ├── ui.js          # Manipulasi DOM
│       └── chat.js        # Logika chat & API call
├── src/                   # Backend source
│   ├── server.js          # Express server
│   ├── routes/chat.js     # POST /api/chat
│   ├── services/
│   │   ├── openrouter.js    (Gemini API)
│   │   └── image.js         (Hugging Face API)
│   ├── middleware/errorHandler.js
│   └── stores/session.js
├── .env                   # API key (tidak untuk git)
├── .gitignore
├── package.json
└── README.md
```

## API Reference

### POST /api/chat

Mengirim pesan dan menerima respons AI.

**Body:**
```json
{
  "message": "Halo, siapa kamu?"
}
```

**Response:**
```json
{
  "response": "Halo! Saya Zann-AI...",
  "timestamp": "2026-09-19T10:00:00.000Z"
}
```

## Lisensi

MIT
