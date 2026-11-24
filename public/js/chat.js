document.addEventListener('DOMContentLoaded', () => {
  let elements;
  try {
    elements = {
      chatForm: document.getElementById('chatForm'),
      messageInput: document.getElementById('messageInput'),
      sendBtn: document.getElementById('sendBtn'),
      messagesArea: document.getElementById('messagesArea'),
      welcomeMessage: document.getElementById('welcomeMessage'),
      typingIndicator: document.getElementById('typingIndicator'),
      errorToast: document.getElementById('errorToast'),
      errorText: document.getElementById('errorText'),
      clearSessionBtn: document.getElementById('sidebarClearHistoryBtn'),
      imagePrompt: document.getElementById('imagePrompt'),
      imageSendBtn: document.getElementById('imageSendBtn'),
      imageResults: document.getElementById('imageResults'),
      imageSkeleton: document.getElementById('imageSkeleton'),
      imageError: document.getElementById('imageError'),
      imageErrorText: document.getElementById('imageErrorText'),
      imageEmpty: document.getElementById('imageEmpty'),
      promptSuggestions: document.getElementById('promptSuggestions'),
      tabChat: document.getElementById('tabChat'),
      tabImage: document.getElementById('tabImage'),
      inputDock: document.querySelector('.input-dock'),
      scrollToBottomBtn: document.getElementById('scrollToBottomBtn'),
    };
  } catch (e) {
    console.error('[DOMContentLoaded] Fatal error:', e);
    if (elements && elements.chatForm) {
      elements.chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (typeof handleSend === 'function') await handleSend();
      });
    }
    return;
  }

  const ui = new ChatUI(elements);
  const modeChat = document.getElementById('modeChat');
  const modeImage = document.getElementById('modeImage');
  const segmentedControl = document.querySelector('.segmented-control');
  const segmentedThumb = document.querySelector('.segmented-thumb');
  let currentMode = 'chat';
  let currentMessages = [];
  let lastUserMessage = '';
  let selectedStyle = 'realistis';
  let selectedRatio = '1:1';
  let imageCooldownUntil = 0;
  let draftDebounceTimer = null;

  const DRAFT_KEY = 'zann.chatDraft';
  const IMAGE_DRAFT_KEY = 'zann.imageDraft';
  const TAB_MODE_KEY = 'zann.tabMode';

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

  /* ===== Segmented Control: thumb + keyboard ===== */
  function updateSegmentedThumb() {
    if (!segmentedControl || !segmentedThumb) return;
    const activeBtn = segmentedControl.querySelector('[aria-selected="true"]');
    if (!activeBtn) return;
    const rect = activeBtn.getBoundingClientRect();
    const parentRect = segmentedControl.getBoundingClientRect();
    segmentedThumb.style.transform = 'translateX(' + (rect.left - parentRect.left) + 'px)';
    segmentedThumb.style.width = rect.width + 'px';
  }

  function setTabActive(activeId) {
    const buttons = segmentedControl ? segmentedControl.querySelectorAll('button') : [];
    buttons.forEach((btn) => {
      const isActive = btn.id === activeId;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
      btn.tabIndex = isActive ? 0 : -1;
    });
    updateSegmentedThumb();
  }

  function setMode(mode) {
    currentMode = mode;
    try {
      localStorage.setItem(TAB_MODE_KEY, mode);
    } catch (e) {
      // abaikan error kuota / mode privat
    }

    if (mode === 'chat') {
      setTabActive('modeChat');
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
      setTabActive('modeImage');
      elements.tabImage.classList.add('active');
      elements.tabImage.classList.remove('hidden');
      elements.tabChat.classList.remove('active');
      elements.tabChat.classList.add('hidden');
      elements.inputDock.style.display = 'none';
      elements.imagePrompt.placeholder = 'Deskripsikan gambar yang ingin Anda buat...';
      ui.hidePromptSuggestions();
    }
    closeDrawer();
  }

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
    document.body.classList.remove('menu-open');
    menuToggle.focus();
  }

  if (menuToggle && appSidebar && headerOverlay) {
    function toggleMenu() {
      const open = !menuToggle.classList.contains('open');
      menuToggle.classList.toggle('open', open);
      menuToggle.setAttribute('aria-expanded', String(open));
      appSidebar.classList.toggle('open', open);
      headerOverlay.classList.toggle('open', open);
      document.body.classList.toggle('menu-open', open);
      if (open) {
        const firstFocusable = appSidebar.querySelector('button, [href], input, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) firstFocusable.focus();
      } else {
        menuToggle.focus();
      }
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

  /* ===== Scroll to Bottom Button ===== */
  function updateScrollBtnVisibility() {
    if (!elements.scrollToBottomBtn || !elements.messagesArea) return;
    const isNearBottom =
      elements.messagesArea.scrollHeight - elements.messagesArea.scrollTop - elements.messagesArea.clientHeight < 100;
    elements.scrollToBottomBtn.classList.toggle('visible', !isNearBottom);
  }

  if (elements.scrollToBottomBtn) {
    elements.scrollToBottomBtn.addEventListener('click', () => {
      ui.scrollToBottom();
      elements.scrollToBottomBtn.classList.remove('visible');
    });
    elements.messagesArea.addEventListener('scroll', updateScrollBtnVisibility);
  }

  /* ===== Sidebar Collapse (Desktop) ===== */
  const sidebarCollapseToggle = document.getElementById('sidebarCollapseToggle');

  if (sidebarCollapseToggle && appSidebar) {
    sidebarCollapseToggle.addEventListener('click', () => {
      const isCollapsed = appSidebar.classList.toggle('collapsed');
      sidebarCollapseToggle.setAttribute('aria-expanded', String(!isCollapsed));
      sidebarCollapseToggle.setAttribute('aria-label', isCollapsed ? 'Perlebar sidebar' : 'Kecilkan sidebar');
    });
  }

  /* ===== Prompt Suggestions ===== */
  if (elements.promptSuggestions) {
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
  }

  if (elements.messageInput) {
    elements.messageInput.addEventListener('input', () => {
      const hasText = elements.messageInput.value.trim().length > 0;
      ui.updateSendBtn(hasText);
      if (hasText) {
        ui.hidePromptSuggestions();
      } else {
        ui.showPromptSuggestions();
      }
      autoResize(elements.messageInput);

      clearTimeout(draftDebounceTimer);
      draftDebounceTimer = setTimeout(() => {
        try {
          localStorage.setItem(DRAFT_KEY, elements.messageInput.value);
        } catch (e) {
          // abaikan error kuota / mode privat
        }
      }, 300);
    });

    elements.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
  }

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

  elements.clearSessionBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (historyManager.history.length === 0) return;
    await showDeleteConfirm();
    const confirmed = await new Promise((resolve) => {
      deleteConfirmResolve = resolve;
      if (btnDeleteConfirm) btnDeleteConfirm.onclick = () => resolve(true);
      if (btnDeleteCancel) btnDeleteCancel.onclick = () => resolve(false);
    });
    hideDeleteConfirm();
    if (confirmed) {
      historyManager.history = [];
      historyManager.save();
      historyManager.render();
      if (historyManager.currentSessionId) {
        historyManager.currentSessionId = null;
        ui.clearSession();
      }
    }
  });

  const sidebarClearHistoryBtn = document.getElementById('sidebarClearHistoryBtn');
  const deleteConfirm = document.getElementById('historyDeleteConfirm');
  const btnDeleteConfirm = document.getElementById('btnDeleteConfirm');
  const btnDeleteCancel = document.getElementById('btnDeleteCancel');

  let deleteConfirmResolve = null;

  function showDeleteConfirm() {
    if (!deleteConfirm) return;
    deleteConfirm.classList.add('open');
    return new Promise((resolve) => {
      deleteConfirmResolve = resolve;
    });
  }

  function hideDeleteConfirm() {
    if (!deleteConfirm) return;
    deleteConfirm.classList.remove('open');
  }

  if (sidebarClearHistoryBtn) {
    sidebarClearHistoryBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (historyManager.history.length === 0) return;
      await showDeleteConfirm();
      const confirmed = await new Promise((resolve) => {
        deleteConfirmResolve = resolve;
        if (btnDeleteConfirm) btnDeleteConfirm.onclick = () => resolve(true);
        if (btnDeleteCancel) btnDeleteCancel.onclick = () => resolve(false);
      });
      hideDeleteConfirm();
      if (confirmed) {
        historyManager.history = [];
        historyManager.save();
        historyManager.render();
        if (historyManager.currentSessionId) {
          historyManager.currentSessionId = null;
          ui.clearSession();
        }
      }
    });
  }

  if (btnDeleteCancel) {
    btnDeleteCancel.addEventListener('click', () => {
      hideDeleteConfirm();
      if (deleteConfirmResolve) deleteConfirmResolve(false);
    });
  }

  if (btnDeleteConfirm) {
    btnDeleteConfirm.addEventListener('click', () => {
      hideDeleteConfirm();
      if (deleteConfirmResolve) deleteConfirmResolve(true);
    });
  }

  /* ===== Profile / Theme (mobile top bar) ===== */
  const sidebarProfileTrigger = document.getElementById('sidebarProfileTrigger');
  const sidebarThemeToggle = document.getElementById('sidebarThemeToggle');
  const mobileThemeToggle = document.getElementById('mobileThemeToggle');
  const mobileHistoryToggle = document.getElementById('mobileHistoryToggle');
  const mobileProfileToggle = document.getElementById('mobileProfileToggle');

  if (sidebarProfileTrigger) {
    sidebarProfileTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.profileManager) window.profileManager.open();
    });
    sidebarProfileTrigger.addEventListener('keydown', (e) => {
      if (e.target !== sidebarProfileTrigger) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (window.profileManager) window.profileManager.open();
      }
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
  if (elements.chatForm) {
    elements.chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSend();
    });
  }

  /* ===== Image Generation ===== */
  if (elements.imageSendBtn) {
    elements.imageSendBtn.addEventListener('click', async () => {
      if (currentMode !== 'image') setMode('image');
      await generateImage(elements.imagePrompt.value.trim());
    });
  }

  if (elements.imagePrompt) {
    elements.imagePrompt.addEventListener('input', () => {
      const hasText = elements.imagePrompt.value.trim().length > 0;
      elements.imageSendBtn.disabled = !hasText;
      autoResize(elements.imagePrompt);

      try {
        localStorage.setItem(IMAGE_DRAFT_KEY, elements.imagePrompt.value);
      } catch (e) {
        // abaikan error kuota / mode privat
      }
    });

    elements.imagePrompt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!elements.imageSendBtn.disabled) {
          generateImage(elements.imagePrompt.value.trim());
        }
      }
    });
  }

  /* ===== Chip Selection (Style / Ratio) ===== */
  document.querySelectorAll('.style-chip[data-style]').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.style-chip[data-style]').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      selectedStyle = chip.getAttribute('data-style') || selectedStyle;
    });
  });

  document.querySelectorAll('.ratio-chip[data-ratio]').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.ratio-chip[data-ratio]').forEach((c) => c.classList.remove('active'));
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
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {
      // abaikan error kuota / mode privat
    }
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
    ui.hideImageEmpty();
    document.getElementById('imageSkeleton')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    elements.imageSendBtn.disabled = true;
    const btnText = elements.imageSendBtn.querySelector('.btn-image-text');
    const btnSpinner = elements.imageSendBtn.querySelector('.btn-image-spinner');
    if (btnText) btnText.textContent = 'Membuat…';
    if (btnSpinner) btnSpinner.classList.remove('is-hidden');

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const isRateLimit = /402|kredit tidak cukup|membatasi 1 gambar per 45 detik|rateLimited/i.test(data.error || '');
        ui.showImageError(data.error || 'Gagal membuat gambar', isRateLimit);
        if (isRateLimit) {
          imageCooldownUntil = Date.now() + 45000;
        }
        elements.imageSendBtn.disabled = true;
        const btnText = elements.imageSendBtn.querySelector('.btn-image-text');
        const btnSpinner = elements.imageSendBtn.querySelector('.btn-image-spinner');
        if (btnText) btnText.textContent = 'Buat Gambar';
        if (btnSpinner) btnSpinner.classList.add('is-hidden');
        ui.showImageEmpty();
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
      ui.hideImageEmpty();
      const results = document.querySelectorAll('#imageResults .image-result');
      if (results.length) {
        results[results.length - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      const btnText = elements.imageSendBtn.querySelector('.btn-image-text');
      const btnSpinner = elements.imageSendBtn.querySelector('.btn-image-spinner');
      if (btnText) btnText.textContent = 'Buat Gambar';
      if (btnSpinner) btnSpinner.classList.add('is-hidden');

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
      const btnText = elements.imageSendBtn.querySelector('.btn-image-text');
      const btnSpinner = elements.imageSendBtn.querySelector('.btn-image-spinner');
      if (btnText) btnText.textContent = 'Buat Gambar';
      if (btnSpinner) btnSpinner.classList.add('is-hidden');
      ui.showImageEmpty();
    } finally {
      const now = Date.now();
      if (now < imageCooldownUntil) {
        elements.imageSendBtn.disabled = true;
        startImageCooldown();
      } else {
        elements.imageSendBtn.disabled = elements.imagePrompt.value.trim().length === 0;
        // Show empty state if no results yet
        if (elements.imageResults && !elements.imageResults.querySelector('.image-result')) {
          ui.showImageEmpty();
        }
      }
    }
  }

  function startImageCooldown() {
    const update = () => {
      const now = Date.now();
      const remaining = Math.ceil((imageCooldownUntil - now) / 1000);
      if (remaining > 0) {
        elements.imageSendBtn.disabled = true;
        elements.imageSendBtn.textContent = 'Tunggu ' + remaining + ' detik';
        setTimeout(update, 1000);
      } else {
        elements.imageSendBtn.disabled = elements.imagePrompt.value.trim().length === 0;
        elements.imageSendBtn.textContent = 'Buat Gambar';
      }
    };
    update();
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

  /* ===== Copy Code (Event Delegation) ===== */
  if (elements.messagesArea) {
    elements.messagesArea.addEventListener('click', (e) => {
      const btn = e.target.closest('.copy-btn');
      if (!btn) return;
      const pre = btn.closest('.code-block')?.querySelector('pre code');
      if (!pre) return;
      ui.copyCode(pre);
    });
  }

  /* ===== Restore Session, Tab, Draft ===== */
  try {
    const savedSessionId = historyManager.getActiveSessionId();
    if (savedSessionId && historyManager.history.find(s => s.id === savedSessionId)) {
      historyManager.loadSession(savedSessionId);
    }
  } catch (e) {
    console.error('[Session] Gagal memulihkan sesi:', e);
  }

  try {
    const savedTab = localStorage.getItem(TAB_MODE_KEY);
    if (savedTab === 'image') {
      setMode('image');
    } else {
      setMode('chat');
    }
  } catch (e) {
    setMode('chat');
  }

  try {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      elements.messageInput.value = savedDraft;
      ui.updateSendBtn(savedDraft.trim().length > 0);
      autoResize(elements.messageInput);
    }
  } catch (e) {
    // abaikan error kuota / mode privat
  }

  try {
    const savedImageDraft = localStorage.getItem(IMAGE_DRAFT_KEY);
    if (savedImageDraft) {
      elements.imagePrompt.value = savedImageDraft;
      elements.imageSendBtn.disabled = savedImageDraft.trim().length === 0;
      autoResize(elements.imagePrompt);
    }
  } catch (e) {
    // abaikan error kuota / mode privat
  }

  window.handleSend = handleSend;
});
