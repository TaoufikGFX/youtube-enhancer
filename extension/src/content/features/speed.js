/*
 * Playback speed: default speed for new videos, a speed button with presets,
 * and mouse-wheel fine tuning over the button.
 */
(() => {
  let button = null;
  let appliedFor = null;

  const clamp = (v) => Math.min(16, Math.max(0.0625, Math.round(v * 100) / 100));
  const fmt = (v) => `${Number(v.toFixed(2))}×`;

  function set(rate, announce = true) {
    const video = YTE.video;
    if (!video) return;
    video.playbackRate = clamp(rate);
    if (announce) YTE.osd(`Speed ${fmt(video.playbackRate)}`);
  }

  function paint() {
    if (!button) return;
    const rate = YTE.video?.playbackRate ?? 1;
    button.querySelector('.yte-speed-text').textContent = fmt(rate);
    button.classList.toggle('yte-on', rate !== 1);
  }

  let boundVideo = null;
  function bind() {
    const video = YTE.video;
    if (!video || video === boundVideo) return;
    boundVideo = video;
    video.addEventListener('ratechange', paint, { passive: true });
  }

  YTE.controls.register({
    key: 'btnSpeed',
    order: 20,
    build() {
      button = YTE.controls.button({
        title: 'Playback speed (scroll to adjust)',
        cls: 'yte-speed',
        onclick: (e, b) => {
          const current = YTE.video?.playbackRate ?? 1;
          YTE.menu.open(b, {
            title: 'Playback speed',
            items: YTE_SPEEDS.map((s) => ({ label: s === 1 ? 'Normal' : fmt(s), value: s, active: s === current })),
            footer: 'Tip: scroll on the button to fine-tune',
            onSelect: (v) => set(v)
          });
        }
      });
      button.append(YTE.el('span', { class: 'yte-speed-text' }));
      button.addEventListener('wheel', (e) => {
        if (!YTE.settings.speedWheel) return;
        e.preventDefault();
        e.stopPropagation();
        const step = YTE.settings.speedStep;
        set((YTE.video?.playbackRate ?? 1) + (e.deltaY < 0 ? step : -step));
      }, { passive: false });
      button.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        set(1);
      });
      bind();
      paint();
      return button;
    }
  });

  YTE.speed = { set, step: (dir) => set((YTE.video?.playbackRate ?? 1) + dir * YTE.settings.speedStep) };

  YTE.feature({
    name: 'speed',
    async navigate({ videoId, changed }) {
      if (!videoId) return;
      const video = await YTE.waitFor('#movie_player video.html5-main-video');
      if (!video) return;
      bind();
      if (changed && appliedFor !== videoId) {
        appliedFor = videoId;
        const target = YTE.settings.speedDefault;
        if (target !== 1) {
          // YouTube resets the rate while the new video loads; apply once it can play.
          const applyRate = () => set(target, false);
          if (video.readyState >= 2) applyRate();
          else video.addEventListener('canplay', applyRate, { once: true });
        }
      }
      paint();
    },
    command(name, value) {
      if (name === 'speed-set') set(value);
      else if (name === 'speed-up') YTE.speed.step(1);
      else if (name === 'speed-down') YTE.speed.step(-1);
      else if (name === 'speed-reset') set(1);
    }
  });
})();
