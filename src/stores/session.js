class SessionStore {
  constructor() {
    this.messages = [];
  }

  add(role, content) {
    this.messages.push({ role, content, timestamp: new Date().toISOString() });
  }

  getAll() {
    return [...this.messages];
  }

  getHistory(limit = 20) {
    return this.messages.slice(-limit);
  }

  getUserMessages() {
    return this.messages.filter((m) => m.role === 'user');
  }

  clear() {
    this.messages = [];
  }

  size() {
    return this.messages.length;
  }
}

module.exports = SessionStore;
