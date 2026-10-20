const HISTORY_KEY = 'ai-pribadi-history';
const HISTORY_TITLE_MAX = 60;

class HistoryManager {
  constructor(ui) {
    this.ui = ui;
    this.history = [];
    this.currentSessionId = null;
    this.onSessionLoad = null;

    this.els = {
      historyToggle: document.getElementById('historyToggle'),
      historyPanel: document.getElementById('historyPanel'),
      historyOverlay: document.getElementById('historyOverlay'),
      historyClose: document.getElementById('historyClose'),
      historyList: document.getElementById('historyList'),
      historyEmpty: document.getElementById('historyEmpty'),
    };

    this.load();
    this.render();
    this.setupEventListeners();
  }

  load() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      this.history = raw ? JSON.parse(raw) : [];
    } catch (e) {
      this.history = [];
    }
  }

  save() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history));
    } catch (e) {
      // abaikan error kuota / mode privat
    }
  }

  render() {
    if (!this.els.historyList) return;
    this.els.historyList.innerHTML = '';

    const hasItems = this.history.length > 0;

    if (this.els.historyList) this.els.historyList.classList.toggle('is-hidden', !hasItems);
    if (this.els.historyEmpty) this.els.historyEmpty.classList.toggle('is-hidden', hasItems);

    if (!hasItems) return;

    const sorted = [...this.history].sort((a, b) => b.updatedAt - a.updatedAt);

    sorted.forEach((session) => {
      const item = document.createElement('div');
      item.className = `history-item${this.currentSessionId === session.id ? ' active' : ''}`;
      item.dataset.id = session.id;

      const title = session.title || 'Tanpa judul';
      const time = new Date(session.updatedAt).toLocaleString('id-ID', {
        date: 'short',
        time: 'short',
      });

      item.innerHTML = `
        <div class="history-item-preview">
          <div class="history-item-title">${this.escapeHTML(title)}</div>
          <div class="history-item-time">${time}</div>
        </div>
        <button class="history-item-delete" aria-label="Hapus riwayat" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      `;

      const preview = item.querySelector('.history-item-preview');
      preview.addEventListener('click', () => {
        this.loadSession(session.id);
      });

      const deleteBtn = item.querySelector('.history-item-delete');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteSession(session.id);
      });

      this.els.historyList.appendChild(item);
    });
  }

  addSession(messages, title) {
    const now = Date.now();
    const snapshot = messages.map((m) => {
      const copy = { role: m.role, content: m.content };
      if (m.role === 'image') {
        copy.url = m.url;
        copy.mimeType = m.mimeType;
        copy.prompt = m.prompt;
      }
      return copy;
    });

    if (this.currentSessionId) {
      const idx = this.history.findIndex((s) => s.id === this.currentSessionId);
      if (idx !== -1) {
        this.history[idx] = {
          ...this.history[idx],
          messages: snapshot,
          title: this.history[idx].title || this.buildTitle(title),
          updatedAt: now,
        };
        this.save();
        this.render();
        return;
      }
    }

    const id = String(now);
    this.history.unshift({
      id,
      title: this.buildTitle(title),
      messages: snapshot,
      createdAt: now,
      updatedAt: now,
    });
    this.currentSessionId = id;
    this.save();
    this.render();
  }

  buildTitle(text) {
    const clean = (text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return 'Tanpa judul';
    return clean.length > HISTORY_TITLE_MAX ? clean.slice(0, HISTORY_TITLE_MAX) + '…' : clean;
  }

  loadSession(id) {
    const session = this.history.find((s) => s.id === id);
    if (!session) return;

    this.currentSessionId = id;

    this.ui.els.messagesArea.innerHTML = '';
    this.ui.hideWelcome();
    this.ui.showClearBtn();

    session.messages.forEach((msg) => {
      if (msg.role === 'user') {
        this.ui.appendUserMessage(msg.content);
      } else if (msg.role === 'assistant') {
        this.ui.appendAssistantMessage(msg.content);
      } else if (msg.role === 'image') {
        this.ui.showImage(msg.url, msg.prompt || '', msg.mimeType || 'image/jpeg');
      }
    });

    if (this.onSessionLoad) this.onSessionLoad(session.messages);

    this.render();
    this.closePanel();
  }

  deleteSession(id) {
    const removed = this.history.find((s) => s.id === id);
    this.history = this.history.filter((s) => s.id !== id);
    if (removed) this.cleanupImages(removed.messages);
    if (this.currentSessionId === id) {
      this.currentSessionId = null;
      this.ui.clearSession();
      if (this.onSessionLoad) this.onSessionLoad([]);
    }
    this.save();
    this.render();
  }

  resetCurrent() {
    this.currentSessionId = null;
  }

  // Hapus gambar yang tersimpan di server saat entri riwayat dihapus.
  // Kegagalan tidak boleh mengganggu penghapusan riwayat.
  cleanupImages(messages) {
    if (!Array.isArray(messages)) return;
    const urls = messages
      .filter((m) => m && m.role === 'image' && typeof m.url === 'string' && m.url.startsWith('http'))
      .map((m) => m.url);

    urls.forEach((url) => {
      fetch('/api/image', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      }).catch((err) => console.error('[History] Gagal hapus gambar di server:', err));
    });
  }

  openPanel() {
    if (!this.els.historyPanel) return;

    const menuToggle = document.getElementById('menuToggle');
    const headerDrawer = document.getElementById('headerDrawer');
    const headerOverlay = document.getElementById('headerOverlay');
    if (menuToggle && menuToggle.classList.contains('open')) {
      menuToggle.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
      headerDrawer.classList.remove('open');
      headerOverlay.classList.remove('open');
      document.body.classList.remove('body-menu-open');
    }

    this.els.historyPanel.classList.add('open');
    this.els.historyOverlay.classList.add('open');
    document.body.classList.add('body-menu-open');
    this.els.historyToggle.setAttribute('aria-pressed', 'true');
    this.render();
  }

  closePanel() {
    if (!this.els.historyPanel) return;
    this.els.historyPanel.classList.remove('open');
    this.els.historyOverlay.classList.remove('open');
    document.body.classList.remove('body-menu-open');
    this.els.historyToggle.setAttribute('aria-pressed', 'false');
  }

  togglePanel() {
    const isOpen = this.els.historyPanel && this.els.historyPanel.classList.contains('open');
    if (isOpen) this.closePanel();
    else this.openPanel();
  }

  setupEventListeners() {
    if (this.els.historyToggle) {
      this.els.historyToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePanel();
      });
    }
    if (this.els.historyOverlay) {
      this.els.historyOverlay.addEventListener('click', () => this.closePanel());
    }
    if (this.els.historyClose) {
      this.els.historyClose.addEventListener('click', () => this.closePanel());
    }
    const modeChat = document.getElementById('modeChat');
    const modeImage = document.getElementById('modeImage');
    if (modeChat) modeChat.addEventListener('click', () => this.closePanel());
    if (modeImage) modeImage.addEventListener('click', () => this.closePanel());
  }

  escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
