class ChatUI {
  constructor(elements) {
    this.els = elements;
    this.objectUrls = [];
    if (typeof marked !== 'undefined') {
      marked.setOptions({
        gfm: true,
        breaks: true,
      });
    }
  }

  trackObjectUrl(url) {
    if (url) this.objectUrls.push(url);
  }

  revokeObjectUrls() {
    this.objectUrls.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        // ignore
      }
    });
    this.objectUrls = [];
  }

  wrapTables(root) {
    root.querySelectorAll('table').forEach((table) => {
      if (table.parentElement && table.parentElement.classList.contains('table-wrap')) return;
      const wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
  }

  renderMarkdown(target, text) {
    if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
      target.textContent = text;
      return;
    }
    const html = marked.parse(text || '');
    target.innerHTML = DOMPurify.sanitize(html, {
      ADD_ATTR: ['target', 'rel'],
    });
    this.wrapTables(target);
    target.querySelectorAll('a').forEach((a) => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
    this.addCopyButtons(target);
  }

  addCopyButtons(root) {
    root.querySelectorAll('pre code').forEach((code) => {
      const pre = code.parentElement;
      if (pre.querySelector('.copy-btn')) return;

      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.title = 'Salin kode';
      btn.innerHTML = '<svg class="copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
      btn.style.cssText = `
        position: absolute;
        top: 6px;
        right: 6px;
        z-index: 10;
        width: 28px;
        height: 28px;
        padding: 0;
        border: none;
        border-radius: 6px;
        background: rgba(0,0,0,0.5);
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        opacity: 0;
        transition: opacity 0.2s ease, background-color 0.2s ease;
      `;

      pre.style.position = 'relative';
      pre.addEventListener('mouseenter', () => { btn.style.opacity = '1'; });
      pre.addEventListener('mouseleave', () => { btn.style.opacity = '0'; });

      btn.addEventListener('click', () => this.copyCode(code));

      pre.appendChild(btn);
    });
  }

  async copyCode(code) {
    const text = code.innerText;
    try {
      await navigator.clipboard.writeText(text);
      this.showCopyToast(code);
    } catch (err) {
      console.error('[Copy]', err);
    }
  }

  showCopyToast(code) {
    const pre = code.parentElement;
    const btn = pre.querySelector('.copy-btn');
    const original = btn.innerHTML;
    btn.innerHTML = '<svg class="copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    btn.style.backgroundColor = '#10b981';

    setTimeout(() => {
      btn.innerHTML = original;
      btn.style.backgroundColor = '';
    }, 1500);
  }

  scrollToBottom() {
    if (!this.els.messagesArea) return;
    this.els.messagesArea.scrollTo({
      top: this.els.messagesArea.scrollHeight,
      behavior: 'smooth',
    });
  }

  appendUserMessage(text) {
    const profile = window.profileManager;
    const username = profile ? profile.getUserName() : '';
    const photo = profile ? profile.getPhoto() : '';

    const div = document.createElement('div');
    div.className = 'message-enter message-row message-row-user';
    div.innerHTML = `
      <div class="avatar-user">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      </div>
      <div class="bubble-user">
        ${username ? `<span class="bubble-username">${this.escapeHTML(username)}</span>` : ''}
        <p class="bubble-text">${this.escapeHTML(text)}</p>
      </div>
    `;

    if (photo) {
      const avatar = div.querySelector('.avatar-user');
      if (avatar) {
        avatar.style.backgroundImage = `url("${photo}")`;
        avatar.classList.add('has-photo');
      }
    }

    this.els.messagesArea.appendChild(div);
    this.scrollToBottom();
  }

  appendAssistantMessage(text) {
    const div = document.createElement('div');
    div.className = 'message-enter message-row';
    div.innerHTML = `
      <div class="avatar-ai">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      </div>
      <div class="bubble-ai markdown-body" data-ai-content></div>
    `;
    this.els.messagesArea.appendChild(div);
    this.scrollToBottom();
    const bubble = div.querySelector('[data-ai-content]');
    if (text) {
      this.renderMarkdown(bubble, text);
    }
    return bubble;
  }

  appendFinishNote(bubble, reason) {
    const labels = {
      MAX_TOKENS: 'Respons terpotong karena batas panjang (token). Ketik "lanjutkan" untuk melanjutkan.',
      SAFETY: 'Respons dibatasi karena filter keamanan.',
      RECITATION: 'Respons dibatasi karena kebijakan hak cipta.',
      OTHER: 'Respons tidak lengkap.',
    };
    const label = labels[reason] || labels.OTHER;

    const note = document.createElement('div');
    note.className = 'finish-note';
    note.textContent = label;

    const target = bubble.closest('.message-row') || bubble.closest('.bubble-ai') || bubble;
    target.appendChild(note);
    this.scrollToBottom();
  }

  showTypingIndicator() {
    if (this.els.typingIndicator) this.els.typingIndicator.classList.remove('hidden');
    this.scrollToBottom();
  }

  hideTypingIndicator() {
    if (this.els.typingIndicator) this.els.typingIndicator.classList.add('hidden');
  }

  hideWelcome() {
    if (this.els.welcomeMessage) this.els.welcomeMessage.classList.add('hidden');
    if (this.els.promptSuggestions) this.els.promptSuggestions.classList.add('hidden');
  }

  showPromptSuggestions() {
    if (this.els.promptSuggestions) this.els.promptSuggestions.classList.remove('hidden');
  }

  hidePromptSuggestions() {
    if (this.els.promptSuggestions) this.els.promptSuggestions.classList.add('hidden');
  }

  showError(message) {
    if (this.els.errorToast && this.els.errorText) {
      this.els.errorToast.classList.remove('hidden');
      this.els.errorText.textContent = message;
      setTimeout(() => {
        this.els.errorToast.classList.add('hidden');
      }, 5000);
    }
  }

  updateSendBtn(enabled) {
    if (this.els.sendBtn) this.els.sendBtn.disabled = !enabled;
  }

  clearInput() {
    if (this.els.messageInput) {
      this.els.messageInput.value = '';
      this.els.messageInput.style.height = 'auto';
      this.updateSendBtn(false);
      this.els.messageInput.focus();
    }
  }

  clearSession() {
    this.els.messagesArea.innerHTML = '';
    this.hideWelcome();
    if (this.els.clearSessionBtn) this.els.clearSessionBtn.classList.add('hidden');
    this.revokeObjectUrls();
    this.appendWelcome();
  }

  appendWelcome() {
    const div = document.createElement('div');
    div.className = 'message-row welcome-row';
    div.innerHTML = `
      <div class="avatar-ai">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      </div>
      <div class="bubble-ai">
        <p class="bubble-text">Halo! Saya <strong>Zann-AI</strong>. Tanyakan apa saja, saya siap membantu Anda.</p>
      </div>
    `;
    this.els.messagesArea.appendChild(div);
    this.scrollToBottom();
    this.showPromptSuggestions();
  }

  showClearBtn() {
    if (this.els.clearSessionBtn) this.els.clearSessionBtn.classList.remove('hidden');
  }

  escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ===== Legacy image display (used by history loading) ===== */

  showImage(url, prompt, mimeType = 'image/jpeg') {
    const div = document.createElement('div');
    div.className = 'message-enter message-row';
    div.innerHTML = `
      <div class="avatar-image">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <div class="bubble-image">
        <div class="bubble-image-frame">
          <img src="${url}" alt="Generated Image" class="bubble-image-el">
          <button class="download-btn" type="button" title="Unduh gambar" aria-label="Unduh gambar">
            <svg class="download-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
          </button>
        </div>
        <p class="bubble-image-caption">${this.escapeHTML(prompt)}</p>
      </div>
    `;

    const btn = div.querySelector('.download-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        this.downloadImage(url, prompt, mimeType, btn);
      });
    }

    this.els.messagesArea.appendChild(div);
    this.scrollToBottom();
  }

  /* ===== Image Tab: Result Grid ===== */

  appendImageResult(url, prompt, mimeType = 'image/jpeg') {
    if (!this.els.imageResults) return;

    const div = document.createElement('div');
    div.className = 'image-result';
    div.innerHTML = `
      <div class="image-result-frame">
        <img src="${url}" alt="Generated Image" class="image-result-img">
        <div class="image-result-actions">
          <button class="image-result-btn" type="button" title="Unduh gambar" aria-label="Unduh gambar">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
          </button>
          <button class="image-result-btn" type="button" title="Buat ulang" aria-label="Buat ulang gambar">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="1 4 1 10 7 10"/><polyline points="23 4 23 10 17 10"/><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/><path d="M10 16h4v-4h-4z"/>
            </svg>
          </button>
        </div>
      </div>
      <p class="image-result-caption">${this.escapeHTML(prompt)}</p>
    `;

    const dlBtn = div.querySelector('.image-result-btn:first-child');
    const reBtn = div.querySelector('.image-result-btn:nth-child(2)');
    const img = div.querySelector('.image-result-img');

    if (dlBtn) {
      dlBtn.addEventListener('click', () => {
        this.downloadImage(url, prompt, mimeType, dlBtn);
      });
    }

    if (reBtn && img) {
      reBtn.addEventListener('click', () => {
        const src = img.src;
        this.downloadImage(src, prompt, mimeType, reBtn);
      });
    }

    this.els.imageResults.appendChild(div);
    if (this.els.imageSkeleton) this.els.imageSkeleton.classList.add('hidden');
    if (this.els.imageError) this.els.imageError.classList.add('hidden');
  }

  clearImageResults() {
    if (this.els.imageResults) this.els.imageResults.innerHTML = '';
  }

  showImageSkeleton() {
    if (this.els.imageSkeleton) this.els.imageSkeleton.classList.remove('hidden');
    if (this.els.imageError) this.els.imageError.classList.add('hidden');
    this.clearImageResults();
  }

  hideImageSkeleton() {
    if (this.els.imageSkeleton) this.els.imageSkeleton.classList.add('hidden');
  }

  showImageError(message) {
    if (this.els.imageError && this.els.imageErrorText) {
      this.els.imageErrorText.textContent = message;
      this.els.imageError.classList.remove('hidden');
    }
    this.hideImageSkeleton();
  }

  hideImageError() {
    if (this.els.imageError) this.els.imageError.classList.add('hidden');
  }

  /* ===== Download (kept from original) ===== */

  async downloadImage(url, prompt, mimeType, btn) {
    if (!url) return;

    let href = url;
    let revokeAfter = false;

    const isRemote = url.startsWith('http') && !url.startsWith(window.location.origin);
    if (isRemote) {
      try {
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        href = URL.createObjectURL(blob);
        revokeAfter = true;
      } catch (err) {
        console.error('[Download] Gagal mengambil gambar, membuka di tab baru:', err);
        window.open(url, '_blank', 'noopener');
        return;
      }
    }

    const link = document.createElement('a');
    link.href = href;
    link.download = this.buildImageFilename(prompt, mimeType);
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (revokeAfter) {
      setTimeout(() => {
        try {
          URL.revokeObjectURL(href);
        } catch (e) {
          // ignore
        }
      }, 10000);
    }

    this.showDownloadToast(btn);
  }

  buildImageFilename(prompt, mimeType) {
    let slug = (prompt || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (slug.length > 40) slug = slug.slice(0, 40).replace(/-+$/, '');
    if (!slug) slug = 'gambar';

    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    return `zann-ai-${slug}-${stamp}.${ext}`;
  }

  showDownloadToast(btn) {
    if (!btn) return;
    const original = btn.innerHTML;
    btn.innerHTML = '<svg class="download-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    btn.classList.add('done');

    setTimeout(() => {
      btn.innerHTML = original;
      btn.classList.remove('done');
    }, 1500);
  }
}
