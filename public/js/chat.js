document.addEventListener('DOMContentLoaded', () => {
  const elements = {
    chatForm: document.getElementById('chatForm'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    messagesArea: document.getElementById('messagesArea'),
    welcomeMessage: document.getElementById('welcomeMessage'),
    typingIndicator: document.getElementById('typingIndicator'),
    errorToast: document.getElementById('errorToast'),
    errorText: document.getElementById('errorText'),
    clearSessionBtn: document.getElementById('sidebarClearBtn'),
    imagePrompt: document.getElementById('imagePrompt'),
    imageSendBtn: document.getElementById('imageSendBtn'),
    imageResults: document.getElementById('imageResults'),
    imageSkeleton: document.getElementById('imageSkeleton'),
    imageError: document.getElementById('imageError'),
    imageErrorText: document.getElementById('imageErrorText'),
    promptSuggestions: document.getElementById('promptSuggestions'),
    tabChat: document.getElementById('tabChat'),
    tabImage: document.getElementById('tabImage'),
    inputDock: document.querySelector('.input-dock'),
  };

  const ui = new ChatUI(elements);
  const modeChat = document.getElementById('modeChat');
  const modeImage = document.getElementById('modeImage');
  let currentMode = 'chat';
  let currentMessages = [];
  let lastUserMessage = '';
  let selectedStyle = 'realistis';
  let selectedRatio = '1:1';

  // TODO: Backend /api/generate-image hanya menerima { prompt } (lihat src/routes/chat.js:74).
  // Chip gaya dan rasio di UI saat ini hanya visual; belum dikirim ke API agar logika generate tidak diubah.

  const historyManager = new HistoryManager(ui);
  historyManager.onSessionLoad = (messages) => {
    currentMessages = (messages || []).map((m) => {
      const copy = { role: m.role, content: m.content };
      if (m.role === 'image') {
        copy.url = m.url;
        copy.mimeType = m.mimeType;
        copy.prompt = m.prompt;
      }
      return copy;
    });
  };

  /* ===== Mobile Sidebar Drawer ===== */
  const menuToggle = document.getElementById('mobileMenuToggle');
  const appSidebar = document.getElementById('appSidebar');
  const headerOverlay = document.getElementById('headerOverlay');

  function closeDrawer() {
    if (!menuToggle || !appSidebar || !headerOverlay) return;
    if (!menuToggle.classList.contains('open')) return;
    menuToggle.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
    appSidebar.classList.remove('open');
    headerOverlay.classList.remove('open');
    document.body.classList.remove('body-menu-open');
  }

  if (menuToggle && appSidebar && headerOverlay) {
    function toggleMenu() {
      const open = !menuToggle.classList.contains('open');
      menuToggle.classList.toggle('open', open);
      menuToggle.setAttribute('aria-expanded', String(open));
      appSidebar.classList.toggle('open', open);
      headerOverlay.classList.toggle('open', open);
      document.body.classList.toggle('body-menu-open', open);
    }

    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    headerOverlay.addEventListener('click', closeDrawer);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuToggle.classList.contains('open')) closeDrawer();
    });
  }

  /* ===== Tab Switching ===== */

  function setMode(mode) {
    currentMode = mode;

    if (mode === 'chat') {
      modeChat.classList.add('active');
      modeImage.classList.remove('active');
      elements.tabChat.classList.add('active');
      elements.tabChat.classList.remove('hidden');
      elements.tabImage.classList.remove('active');
      elements.tabImage.classList.add('hidden');
      elements.inputDock.style.display = 'block';
      elements.messageInput.placeholder = 'Ketik pesan Anda...';
      if (elements.messageInput.value.trim() === '') {
        ui.showPromptSuggestions();
      }
    } else {
      modeImage.classList.add('active');
      modeChat.classList.remove('active');
      elements.tabImage.classList.add('active');
      elements.tabImage.classList.remove('hidden');
      elements.tabChat.classList.remove('active');
      elements.tabChat.classList.add('hidden');
      elements.inputDock.style.display = 'none';
      elements.imagePrompt.placeholder = 'Describe the image you want...';
      ui.hidePromptSuggestions();
    }
    closeDrawer();
  }

  modeChat.addEventListener('click', () => setMode('chat'));
  modeImage.addEventListener('click', () => setMode('image'));

  /* ===== Prompt Suggestions ===== */

  elements.promptSuggestions.querySelectorAll('.suggestion-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      if (!prompt) return;
      elements.messageInput.value = prompt;
      ui.updateSendBtn(true);
      setMode('chat');
      elements.messageInput.focus();
    });
  });

  elements.messageInput.addEventListener('input', () => {
    const hasText = elements.messageInput.value.trim().length > 0;
    ui.updateSendBtn(hasText);
    if (hasText) {
      ui.hidePromptSuggestions();
    } else {
      ui.showPromptSuggestions();
    }
    autoResize(elements.messageInput);
  });

  elements.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  /* ===== New Chat ===== */

  function startNewChat() {
    ui.clearSession();
    currentMessages = [];
    historyManager.resetCurrent();
    closeDrawer();
    ui.showPromptSuggestions();
    ui.hideImageError();
    ui.clearImageResults();
    ui.hideImageSkeleton();
  }

  const sidebarNewChat = document.getElementById('sidebarNewChat');
  if (sidebarNewChat) {
    sidebarNewChat.addEventListener('click', () => {
      startNewChat();
    });
  }

  const newChatBtn = document.getElementById('newChatBtn');
  if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
      startNewChat();
    });
  }

  elements.clearSessionBtn.addEventListener('click', () => {
    startNewChat();
  });

  /* ===== Profile / Theme (mobile top bar) ===== */

  const sidebarProfileBtn = document.getElementById('sidebarProfileBtn');
  const sidebarThemeToggle = document.getElementById('sidebarThemeToggle');
  const mobileThemeToggle = document.getElementById('mobileThemeToggle');
  const mobileHistoryToggle = document.getElementById('mobileHistoryToggle');
  const mobileProfileToggle = document.getElementById('mobileProfileToggle');

  if (sidebarProfileBtn) {
    sidebarProfileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.profileManager) window.profileManager.open();
      closeDrawer();
    });
  }

  if (mobileHistoryToggle) {
    mobileHistoryToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      historyManager.togglePanel();
    });
  }

  if (mobileProfileToggle) {
    mobileProfileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.profileManager) window.profileManager.open();
    });
  }

  /* ===== Chat Form Submit ===== */

  elements.chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleSend();
  });

  /* ===== Image Generation ===== */

  elements.imageSendBtn.addEventListener('click', async () => {
    if (currentMode !== 'image') setMode('image');
    await generateImage(elements.imagePrompt.value.trim());
  });

  elements.imagePrompt.addEventListener('input', () => {
    const hasText = elements.imagePrompt.value.trim().length > 0;
    elements.imageSendBtn.disabled = !hasText;
    autoResize(elements.imagePrompt);
  });

  elements.imagePrompt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!elements.imageSendBtn.disabled) {
        generateImage(elements.imagePrompt.value.trim());
      }
    }
  });

  /* ===== Chip Selection (Style / Ratio) ===== */

  document.querySelectorAll('.chip[data-style]').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip[data-style]').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      selectedStyle = chip.getAttribute('data-style') || selectedStyle;
    });
  });

  document.querySelectorAll('.chip[data-ratio]').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip[data-ratio]').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      selectedRatio = chip.getAttribute('data-ratio') || selectedRatio;
    });
  });

  /* ===== handleSend (Chat API) ===== */

  async function handleSend() {
    const text = elements.messageInput.value.trim();
    if (!text) return;

    lastUserMessage = text;

    ui.hideWelcome();
    ui.clearInput();
    ui.appendUserMessage(text);
    currentMessages.push({ role: 'user', content: text });
    ui.showClearBtn();
    ui.showTypingIndicator();
    ui.updateSendBtn(false);

    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, userName: getUserName() }),
        });

        const data = await response.json();

        ui.hideTypingIndicator();

        if (!response.ok) {
          const errorMsg = data.error || 'Gagal mengirim pesan';
          ui.showError(errorMsg);
          return;
        }

        const bubble = ui.appendAssistantMessage('');
        typeOut(bubble, data.response, (fullResponse) => {
          currentMessages.push({ role: 'assistant', content: fullResponse });
          historyManager.addSession(currentMessages, text);
          if (data.finishReason && data.finishReason !== 'STOP') {
            ui.appendFinishNote(bubble, data.finishReason, () => {
              elements.messageInput.value = lastUserMessage;
              ui.updateSendBtn(true);
              handleSend();
            });
          }
        });
        return;
      } catch (err) {
        lastError = err;
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    ui.hideTypingIndicator();
    ui.showError('Koneksi gagal. Periksa koneksi internet Anda.');
  }

  /* ===== generateImage (Image API) ===== */

  async function generateImage(prompt) {
    if (!prompt) return;

    ui.hideWelcome();
    ui.clearImageResults();
    ui.hideImageError();
    ui.showImageSkeleton();
    elements.imageSendBtn.disabled = true;

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        ui.showImageError(data.error || 'Gagal membuat gambar');
        elements.imageSendBtn.disabled = elements.imagePrompt.value.trim().length === 0;
        return;
      }

      const url = data.url;
      if (!url) {
        ui.showImageError('Server tidak mengembalikan gambar');
        elements.imageSendBtn.disabled = elements.imagePrompt.value.trim().length === 0;
        return;
      }

      ui.hideImageSkeleton();
      ui.appendImageResult(url, prompt, data.mimeType || 'image/jpeg');

      // Simpan ke riwayat supaya gambar tetap ada setelah reload
      currentMessages.push({ role: 'user', content: prompt });
      currentMessages.push({
        role: 'image',
        url,
        mimeType: data.mimeType || 'image/jpeg',
        prompt,
      });
      historyManager.addSession(currentMessages, prompt);
    } catch (err) {
      ui.hideImageSkeleton();
      ui.showImageError('Koneksi gagal');
    } finally {
      elements.imageSendBtn.disabled = elements.imagePrompt.value.trim().length === 0;
    }
  }

  function getUserName() {
    return window.profileManager ? window.profileManager.getUserName() : '';
  }

  function typeOut(bubble, text, onComplete) {
    let index = 0;
    const speed = 12;
    let rendered = '';

    function type() {
      if (index < text.length) {
        const chunk = text.slice(index, index + 3);
        index += chunk.length;
        rendered += chunk;
        ui.renderMarkdown(bubble, rendered);
        ui.scrollToBottom();
        setTimeout(type, speed);
      } else {
        ui.renderMarkdown(bubble, rendered);
        if (onComplete) onComplete(rendered);
      }
    }

    type();
  }

  function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 128) + 'px';
  }

  window.handleSend = handleSend;
});
