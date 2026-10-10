/*
 * Audio: volume booster (Web Audio gain + limiter) and optional mouse-wheel volume over the video.
 * The audio graph is created lazily, only the first time the booster is switched on.
 */
(() => {
  const graphs = new WeakMap(); // video -> { ctx, gain }
  let button = null;
  let waitingForGesture = false;

  async function graphFor(video) {
    if (graphs.has(video)) return graphs.get(video);
    const ctx = new AudioContext();
    if (ctx.state !== 'running') {
      await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 300))]);
    }
    // Routing a video into a suspended context would mute it, so wait for a click or key press.
    if (ctx.state !== 'running') {
      ctx.close();
      if (!waitingForGesture) {
        waitingForGesture = true;
        const retry = () => {
          waitingForGesture = false;
          window.removeEventListener('pointerdown', retry, true);
          window.removeEventListener('keydown', retry, true);
          update();
        };
        window.addEventListener('pointerdown', retry, true);
        window.addEventListener('keydown', retry, true);
      }
      return null;
    }
    const source = ctx.createMediaElementSource(video);
    const gain = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    source.connect(gain).connect(limiter).connect(ctx.destination);
    const graph = { ctx, gain };
    graphs.set(video, graph);
    return graph;
  }

  async function update() {
    paint();
    const video = YTE.video;
    if (!video) return;
    const on = YTE.settings.boostOn;
    if (!on && !graphs.has(video)) return;
    const graph = await graphFor(video);
    if (!graph) return;
    if (graph.ctx.state !== 'running') graph.ctx.resume();
    graph.gain.gain.setTargetAtTime(on ? YTE.settings.boostLevel : 1, graph.ctx.currentTime, 0.05);
  }

  function toggle() {
    const on = !YTE.settings.boostOn;
    YTE.save({ boostOn: on });
    YTE.osd(on ? `Volume boost ${YTE.settings.boostLevel}×` : 'Volume boost off');
  }

  function paint() {
    if (!button) return;
    button.classList.toggle('yte-on', YTE.settings.boostOn);
    button.title = YTE.settings.boostOn ? `Volume boost: ${YTE.settings.boostLevel}× (click to turn off)` : 'Volume boost';
  }

  YTE.controls.register({
    key: 'btnBoost',
    order: 30,
    build() {
      button = YTE.controls.button({ icon: YTE.icons.boost, title: 'Volume boost', cls: 'yte-boost', onclick: toggle });
      paint();
      return button;
    }
  });

  let wheelBound = null;
  function onWheel(e) {
    if (!YTE.settings.volumeWheel) return;
    if (e.target.closest('.ytp-chrome-bottom, .yte-menu, .ytp-settings-menu, .ytp-popup')) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? YTE.settings.volumeWheelStep : -YTE.settings.volumeWheelStep;
    YTE.bridge('volume', delta);
  }

  YTE.feature({
    name: 'audio',
    async navigate({ videoId }) {
      if (!videoId) return;
      const player = await YTE.waitFor('#movie_player');
      if (player && wheelBound !== player) {
        wheelBound = player;
        player.addEventListener('wheel', onWheel, { passive: false });
      }
      if (YTE.settings.boostOn) {
        await YTE.waitFor('#movie_player video.html5-main-video');
        update();
      }
    },
    settingsChanged(keys) {
      if (keys.includes('boostOn') || keys.includes('boostLevel')) update();
    },
    command(name) {
      if (name === 'toggle-boost') toggle();
    }
  });
})();
