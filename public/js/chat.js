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
    clearSessionBtn: document.getElementById('clearSessionBtn'),
  };

  const ui = new ChatUI(elements);
  const modeChat = document.getElementById('modeChat');
  const modeImage = document.getElementById('modeImage');
  let currentMode = 'chat';
  let currentMessages = [];

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

  /* ===== Mobile Header Drawer ===== */
  const menuToggle = document.getElementById('menuToggle');
  const headerDrawer = document.getElementById('headerDrawer');
  const headerOverlay = document.getElementById('headerOverlay');

  function closeDrawer() {
    if (!menuToggle || !headerDrawer || !headerOverlay) return;
    if (!menuToggle.classList.contains('open')) return;
    menuToggle.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
    headerDrawer.classList.remove('open');
    headerOverlay.classList.remove('open');
    document.body.classList.remove('body-menu-open');
  }

  if (menuToggle && headerDrawer && headerOverlay) {
    function toggleMenu() {
      const open = !menuToggle.classList.contains('open');
      menuToggle.classList.toggle('open', open);
      menuToggle.setAttribute('aria-expanded', String(open));
      headerDrawer.classList.toggle('open', open);
      headerOverlay.classList.toggle('open', open);
      document.body.classList.toggle('body-menu-open', open);
    }

    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    headerOverlay.addEventListener('click', toggleMenu);

    // Tutup drawer saat menukar mode chat/image
    modeChat.addEventListener('click', () => {
      if (menuToggle.classList.contains('open')) toggleMenu();
    });
    modeImage.addEventListener('click', () => {
      if (menuToggle.classList.contains('open')) toggleMenu();
    });
  }

  elements.chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleSend();
  });

  elements.messageInput.addEventListener('input', () => {
    autoResize(elements.messageInput);
    ui.updateSendBtn(elements.messageInput.value.trim().length > 0);
  });

  elements.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  elements.clearSessionBtn.addEventListener('click', () => {
    startNewChat();
  });

  const newChatBtn = document.getElementById('newChatBtn');
  if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
      startNewChat();
    });
  }

  function startNewChat() {
    ui.clearSession();
    currentMessages = [];
    historyManager.resetCurrent();
    closeDrawer();
  }

  function getUserName() {
    return window.profileManager ? window.profileManager.getUserName() : '';
  }

  async function handleSend() {
    const text = elements.messageInput.value.trim();
    if (!text) return;

    if (currentMode === 'image') {
      await generateImage(text);
      return;
    }

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

  async function generateImage(prompt) {
    ui.hideWelcome();
    ui.clearInput();
    ui.appendUserMessage(prompt);
    ui.showClearBtn();
    ui.showTypingIndicator();
    ui.updateSendBtn(false);

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      ui.hideTypingIndicator();

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        ui.showError(data.error || 'Gagal membuat gambar');
        return;
      }

      const url = data.url;
      if (!url) {
        ui.showError('Server tidak mengembalikan gambar');
        return;
      }

      ui.showImage(url, prompt, data.mimeType || 'image/jpeg');

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
      ui.hideTypingIndicator();
      ui.showError('Koneksi gagal');
    }
  }

  window.handleSend = handleSend;

  modeChat.addEventListener('click', () => {
    currentMode = 'chat';
    modeChat.classList.add('active');
    modeImage.classList.remove('active');
    elements.messageInput.placeholder = 'Ketik pesan Anda...';
  });

  modeImage.addEventListener('click', () => {
    currentMode = 'image';
    modeImage.classList.add('active');
    modeChat.classList.remove('active');
    elements.messageInput.placeholder = 'Describe the image you want...';
  });
});
