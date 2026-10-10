/*
 * Two-way binding between form controls and settings.
 * Any element with data-key="settingName" is kept in sync with chrome.storage.local:
 *   <input type="checkbox" class="switch">, <input type="range"> (+ <output data-for>),
 *   <select>, and <div class="seg"> with <button data-value> children.
 * Optional data-unit on a range sets the text suffix of its output.
 */
const YTEBind = {
  settings: {},
  onSaved: null,

  async init(scope = document) {
    this.scope = scope;
    this.settings = await yteLoadSettings();
    for (const el of scope.querySelectorAll('[data-key]')) this.wire(el);
    this.paintAll();
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      for (const [key, { newValue }] of Object.entries(changes)) this.settings[key] = newValue ?? YTE_DEFAULTS[key];
      this.paintAll();
    });
  },

  coerce(key, raw) {
    const def = YTE_DEFAULTS[key];
    if (typeof def === 'number') return Number(raw);
    if (typeof def === 'boolean') return raw === true || raw === 'true';
    return raw;
  },

  set(key, value) {
    this.settings[key] = value;
    this.paintAll();
    chrome.storage.local.set({ [key]: value }).then(() => this.onSaved?.(key, value));
  },

  wire(el) {
    const key = el.dataset.key;
    if (el.classList.contains('seg')) {
      el.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-value]');
        if (btn) this.set(key, this.coerce(key, btn.dataset.value));
      });
    } else if (el.type === 'checkbox') {
      el.addEventListener('change', () => this.set(key, el.checked));
    } else if (el.type === 'range') {
      el.addEventListener('input', () => {
        this.paintRange(el, Number(el.value));
        clearTimeout(el._t);
        el._t = setTimeout(() => this.set(key, Number(el.value)), 120);
      });
    } else {
      el.addEventListener('change', () => this.set(key, this.coerce(key, el.value)));
    }
  },

  paintRange(el, value) {
    const min = Number(el.min || 0);
    const max = Number(el.max || 100);
    el.style.setProperty('--fill', `${((value - min) / (max - min)) * 100}%`);
    const out = this.scope.querySelector(`output[data-for="${el.dataset.key}"]`);
    if (out) out.textContent = `${value}${el.dataset.unit ?? ''}`;
  },

  paintAll() {
    for (const el of this.scope.querySelectorAll('[data-key]')) {
      const value = this.settings[el.dataset.key];
      if (el.classList.contains('seg')) {
        for (const btn of el.querySelectorAll('button[data-value]')) {
          btn.classList.toggle('on', this.coerce(el.dataset.key, btn.dataset.value) === value);
        }
      } else if (el.type === 'checkbox') {
        el.checked = !!value;
      } else if (el.type === 'range') {
        if (document.activeElement !== el) el.value = value;
        this.paintRange(el, Number(el.value));
      } else if (document.activeElement !== el) {
        el.value = value;
      }
    }
    for (const el of this.scope.querySelectorAll('[data-show-if]')) {
      el.hidden = !this.settings[el.dataset.showIf];
    }
  }
};
