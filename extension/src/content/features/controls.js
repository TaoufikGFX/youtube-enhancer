/*
 * Player control bar: hosts the extension's buttons inside YouTube's right-hand controls
 * and provides a small popup menu used by the repeat and speed buttons.
 */
YTE.icons = {
  repeat: 'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z',
  camera: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM9 2 7.17 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3.17L15 2H9z',
  boost: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05A4.47 4.47 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06A9 9 0 0 0 14 3.23z',
  cinema: 'M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z',
  expand: 'M21 11V3h-8l3.29 3.29-10 10L3 13v8h8l-3.29-3.29 10-10z',
  shrink: 'M22 3.41 16.71 8.7 20 12h-8V4l3.29 3.29L20.59 2 22 3.41zM3.41 22l5.29-5.29L12 20v-8H4l3.29 3.29L2 20.59 3.41 22z',
  pip: 'M19 11h-8v6h8v-6zm4 8V5c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 0H3V5h18v14z',
  check: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'
};

YTE.svg = (path) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="${path}"/></svg>`;

YTE.controls = {
  defs: [],
  bar: null,

  // def: { key: settings flag, order, build(): HTMLElement }
  register(def) {
    this.defs.push(def);
    this.defs.sort((a, b) => a.order - b.order);
  },

  button({ icon, title, onclick, cls = '' }) {
    const btn = YTE.el('button', {
      class: `ytp-button yte-btn ${cls}`,
      title,
      'aria-label': title,
      html: icon ? YTE.svg(icon) : ''
    });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onclick?.(e, btn);
    });
    return btn;
  },

  async mount() {
    const right = await YTE.waitFor('#movie_player .ytp-right-controls');
    if (!right) return;
    if (this.bar?.isConnected && this.bar.parentElement === right) return;
    this.bar?.remove();
    this.bar = YTE.el('div', { class: 'yte-bar' });
    this.render();
    right.prepend(this.bar);
  },

  render() {
    if (!this.bar) return;
    this.bar.replaceChildren();
    for (const def of this.defs) {
      if (YTE.settings[def.key]) this.bar.append(def.build());
    }
    YTE.run('controlsRendered');
  }
};

YTE.menu = {
  node: null,

  // items: [{ label, value, active, disabled }]
  open(anchor, { title, items, footer, onSelect }) {
    const reopen = this.node && this.anchor === anchor;
    this.close();
    if (reopen) return;
    const player = YTE.player;
    if (!player) return;

    this.anchor = anchor;
    this.node = YTE.el('div', { class: 'yte-menu', role: 'menu' });
    if (title) this.node.append(YTE.el('div', { class: 'yte-menu-title', text: title }));
    for (const item of items) {
      const row = YTE.el('button', {
        class: `yte-menu-item${item.active ? ' yte-active' : ''}${item.disabled ? ' yte-disabled' : ''}`,
        role: 'menuitemradio',
        'aria-checked': String(!!item.active),
        html: `<span>${item.label}</span>${item.active ? YTE.svg(YTE.icons.check) : ''}`
      });
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.disabled) return;
        onSelect(item.value);
        this.close();
      });
      this.node.append(row);
    }
    if (footer) this.node.append(YTE.el('div', { class: 'yte-menu-footer', text: footer }));
    this.node.addEventListener('click', (e) => e.stopPropagation());
    player.append(this.node);

    const p = player.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    const width = this.node.offsetWidth;
    const left = Math.min(Math.max(8, a.left - p.left + a.width / 2 - width / 2), p.width - width - 8);
    this.node.style.left = `${left}px`;
    this.node.style.bottom = `${p.bottom - a.top + 6}px`;
    requestAnimationFrame(() => this.node?.classList.add('yte-show'));

    this.outside = (e) => {
      if (!this.node?.contains(e.target) && !anchor.contains(e.target)) this.close();
    };
    document.addEventListener('pointerdown', this.outside, true);
  },

  close() {
    this.node?.remove();
    this.node = null;
    this.anchor = null;
    if (this.outside) document.removeEventListener('pointerdown', this.outside, true);
    this.outside = null;
  }
};

YTE.feature({
  name: 'controls',
  navigate() {
    if (YTE.isWatchPage()) YTE.controls.mount();
  },
  settingsChanged(keys) {
    if (keys.some((k) => k.startsWith('btn'))) YTE.controls.render();
  }
});
