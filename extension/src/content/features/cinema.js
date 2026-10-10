/*
 * Cinema mode: dims everything on the page except the video player.
 */
(() => {
  let button = null;
  let overlay = null;
  let on = false;

  function set(value) {
    on = value;
    document.documentElement.classList.toggle('yte-cinema', on);
    if (on && !overlay) {
      overlay = YTE.el('div', { class: 'yte-cinema-overlay', title: 'Click to exit cinema mode' });
      overlay.addEventListener('click', () => set(false));
    }
    if (on) document.body.append(overlay);
    else overlay?.remove();
    button?.classList.toggle('yte-on', on);
  }

  YTE.controls.register({
    key: 'btnCinema',
    order: 50,
    build() {
      button = YTE.controls.button({
        icon: YTE.icons.cinema,
        title: 'Cinema mode',
        cls: 'yte-cinema-btn',
        onclick: () => set(!on)
      });
      button.classList.toggle('yte-on', on);
      return button;
    }
  });

  YTE.feature({
    name: 'cinema',
    navigate({ videoId, changed }) {
      if (!videoId) set(false);
      else if (changed && YTE.settings.cinemaAuto && !on) set(true);
    },
    command(name) {
      if (name === 'toggle-cinema' && YTE.videoId) set(!on);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (on && e.key === 'Escape') set(false);
  });
})();
