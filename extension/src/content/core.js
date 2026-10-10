/*
 * Core runtime for the YouTube page: settings, navigation events, shared helpers.
 * Every feature file registers itself with YTE.feature() and is driven from here.
 */
const YTE = {
  settings: { ...YTE_DEFAULTS },
  features: [],
  videoId: null,

  feature(def) {
    this.features.push(def);
  },

  get player() {
    return document.getElementById('movie_player');
  },

  get video() {
    return document.querySelector('#movie_player video.html5-main-video');
  },

  isWatchPage() {
    return location.pathname === '/watch';
  },

  save(patch) {
    Object.assign(this.settings, patch);
    return yteSaveSettings(patch);
  },

  // Resolves with the first element matching selector, watching the DOM only until it appears.
  waitFor(selector, { root = document, timeout = 15000 } = {}) {
    const found = root.querySelector(selector);
    if (found) return Promise.resolve(found);
    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        const el = root.querySelector(selector);
        if (el) {
          observer.disconnect();
          clearTimeout(timer);
          resolve(el);
        }
      });
      const timer = setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
      observer.observe(root === document ? document.documentElement : root, { childList: true, subtree: true });
    });
  },

  el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (key === 'class') node.className = value;
      else if (key === 'html') node.innerHTML = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value);
    }
    for (const child of children) node.append(child);
    return node;
  },

  // Sends a command to the page-world bridge (see page-bridge.js).
  bridge(cmd, value) {
    document.dispatchEvent(new CustomEvent('yte:bridge', { detail: JSON.stringify({ cmd, value }) }));
  },

  osd(text) {
    if (!this.settings.osd) return;
    const player = this.player;
    if (!player) return;
    let box = player.querySelector('.yte-osd');
    if (!box) {
      box = this.el('div', { class: 'yte-osd' });
      player.append(box);
    }
    box.textContent = text;
    box.classList.add('yte-show');
    clearTimeout(this._osdTimer);
    this._osdTimer = setTimeout(() => box.classList.remove('yte-show'), 1100);
  },

  formatTime(seconds) {
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    const m = Math.floor((seconds / 60) % 60);
    const h = Math.floor(seconds / 3600);
    return h ? `${h}-${String(m).padStart(2, '0')}-${s}` : `${m}-${s}`;
  },

  run(hook, ...args) {
    for (const f of this.features) {
      try {
        f[hook]?.(...args)?.catch?.((err) => console.warn('[YouTube Enhancer]', f.name, hook, err));
      } catch (err) {
        console.warn('[YouTube Enhancer]', f.name, hook, err);
      }
    }
  },

  onNavigate() {
    const id = this.isWatchPage() ? new URLSearchParams(location.search).get('v') : null;
    const changed = id !== this.videoId;
    this.videoId = id;
    this.run('navigate', { videoId: id, changed });
  },

  async start() {
    this.settings = await yteLoadSettings();
    this.run('init');

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      const keys = Object.keys(changes);
      for (const key of keys) this.settings[key] = changes[key].newValue ?? YTE_DEFAULTS[key];
      this.run('settingsChanged', keys);
    });

    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg?.type === 'command') this.run('command', msg.command, msg.value);
      else if (msg?.type === 'getState') {
        const video = this.video;
        sendResponse({ videoId: this.videoId, rate: video ? video.playbackRate : null });
      }
    });

    document.addEventListener('yte:page', (e) => {
      try {
        this.run('page', JSON.parse(e.detail));
      } catch {
        // ignore malformed messages
      }
    });

    document.addEventListener('yt-navigate-finish', () => this.onNavigate());
    window.addEventListener('popstate', () => this.onNavigate());
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.onNavigate(), { once: true });
    } else {
      this.onNavigate();
    }
  }
};
