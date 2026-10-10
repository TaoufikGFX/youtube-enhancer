/*
 * Repeat: replay the current video 1–5 more times or forever.
 * Uses the video element's native loop so playback never stops between runs and
 * YouTube's autoplay does not kick in while repeats are left.
 */
(() => {
  const state = {
    remaining: 0, // repeats left for counted modes
    video: null,
    lastTime: 0,
    button: null
  };

  const mode = () => YTE.settings.repeatMode;
  const shouldLoop = () => mode() === -1 || (mode() > 0 && state.remaining > 0);
  const label = (m) => (m === -1 ? 'Unlimited' : m === 0 ? 'Off' : `${m} time${m > 1 ? 's' : ''}`);

  function apply() {
    const video = YTE.video;
    if (!video) return;
    if (video !== state.video) bind(video);
    video.loop = shouldLoop();
    paint();
  }

  function reset() {
    state.remaining = mode() > 0 ? mode() : 0;
    apply();
  }

  // A native loop shows up as the playhead jumping from the very end back to the start.
  function onTimeUpdate() {
    const video = state.video;
    const t = video.currentTime;
    const wrapped = state.lastTime > video.duration - 1.5 && t < 1.5 && state.lastTime - t > 1;
    state.lastTime = t;
    if (wrapped && mode() > 0 && state.remaining > 0) {
      state.remaining -= 1;
      paint();
      YTE.osd(state.remaining ? `Repeat · ${state.remaining} left` : 'Repeat · last play');
    }
    // YouTube sometimes clears the loop flag while loading; keep it in sync.
    if (shouldLoop() !== video.loop) video.loop = shouldLoop();
  }

  function bind(video) {
    state.video?.removeEventListener('timeupdate', onTimeUpdate);
    state.video = video;
    state.lastTime = video.currentTime;
    video.addEventListener('timeupdate', onTimeUpdate, { passive: true });
  }

  function setMode(value) {
    YTE.save({ repeatMode: value });
    reset();
    YTE.osd(value === 0 ? 'Repeat off' : `Repeat · ${label(value)}`);
  }

  function paint() {
    const btn = state.button;
    if (!btn) return;
    const m = mode();
    btn.classList.toggle('yte-on', m !== 0);
    btn.title = `Repeat: ${label(m)}`;
    const badge = btn.querySelector('.yte-badge');
    badge.textContent = m === -1 ? '∞' : m > 0 ? String(state.remaining) : '';
    badge.hidden = m === 0;
  }

  function openMenu(btn) {
    YTE.menu.open(btn, {
      title: 'Repeat video',
      items: YTE_REPEAT_MODES.map((m) => ({
        label: m.value === -1 ? 'Unlimited ∞' : m.value === 0 ? 'Off' : label(m.value),
        value: m.value,
        active: m.value === mode()
      })),
      onSelect: setMode
    });
  }

  YTE.controls.register({
    key: 'btnRepeat',
    order: 10,
    build() {
      const btn = YTE.controls.button({
        icon: YTE.icons.repeat,
        title: 'Repeat',
        cls: 'yte-repeat',
        onclick: (e, b) => openMenu(b)
      });
      btn.append(YTE.el('span', { class: 'yte-badge' }));
      // Right-click quickly toggles between off and unlimited.
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setMode(mode() === 0 ? -1 : 0);
      });
      state.button = btn;
      paint();
      return btn;
    }
  });

  YTE.feature({
    name: 'repeat',
    async navigate({ videoId, changed }) {
      if (!videoId) return;
      await YTE.waitFor('#movie_player video.html5-main-video');
      if (changed && !YTE.settings.repeatRemember && mode() !== 0) YTE.save({ repeatMode: 0 });
      if (changed) reset();
      else apply();
    },
    settingsChanged(keys) {
      if (keys.includes('repeatMode')) reset();
    },
    command(name) {
      if (name === 'toggle-repeat') setMode(mode() === 0 ? -1 : 0);
    }
  });
})();
