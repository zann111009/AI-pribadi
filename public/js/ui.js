class ChatUI {
  constructor(elements) {
    this.els = elements;
    if (typeof marked !== 'undefined') {
      marked.setOptions({
        gfm: true,
        breaks: true,
      });
    }
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
  }

  scrollToBottom() {
    this.els.messagesArea.scrollTo({
      top: this.els.messagesArea.scrollHeight,
      behavior: 'smooth',
    });
  }

  appendUserMessage(text) {
    const div = document.createElement('div');
    div.className = 'message-enter message-row message-row-user';
    div.innerHTML = `
      <div class="avatar-user">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      </div>
      <div class="bubble-user">
        <p class="bubble-text">${this.escapeHTML(text)}</p>
      </div>
    `;
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

  showTypingIndicator() {
    this.els.typingIndicator.classList.remove('hidden');
    this.scrollToBottom();
  }

  hideTypingIndicator() {
    this.els.typingIndicator.classList.add('hidden');
  }

  hideWelcome() {
    this.els.welcomeMessage.classList.add('hidden');
  }

  showError(message) {
    this.els.errorToast.classList.remove('hidden');
    this.els.errorText.textContent = message;
    setTimeout(() => {
      this.els.errorToast.classList.add('hidden');
    }, 5000);
  }

  updateSendBtn(enabled) {
    this.els.sendBtn.disabled = !enabled;
  }

  clearInput() {
    this.els.messageInput.value = '';
    this.els.messageInput.style.height = 'auto';
    this.updateSendBtn(false);
    this.els.messageInput.focus();
  }

  clearSession() {
    this.els.messagesArea.innerHTML = '';
    this.hideWelcome();
    this.els.clearSessionBtn.classList.add('hidden');
    this.appendWelcome();
  }

  appendWelcome() {
    const div = document.createElement('div');
    div.className = 'message-row';
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
  }

  showClearBtn() {
    this.els.clearSessionBtn.classList.remove('hidden');
  }

  escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  showImage(url, prompt) {
    const div = document.createElement('div');
    div.className = 'message-enter message-row';
    div.innerHTML = `
      <div class="avatar-image">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <div class="bubble-image">
        <img src="${url}" alt="Generated Image" class="bubble-image-el">
        <p class="bubble-image-caption">${this.escapeHTML(prompt)}</p>
      </div>
    `;
    this.els.messagesArea.appendChild(div);
    this.scrollToBottom();
  }
}
