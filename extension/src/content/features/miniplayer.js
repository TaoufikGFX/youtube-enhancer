/*
 * Mini player: when you scroll past the video (e.g. to read comments) the player floats
 * in a corner. It can switch to its own quality and goes back when the mini player closes.
 */
(() => {
  const root = document.documentElement;
  const SIZES = { small: 320, medium: 480, large: 640 };
  let observer = null;
  let slot = null;
  let active = false;
  let dismissed = false;
  let bar = null;

  function setActive(on) {
    if (on === active) return;
    active = on;
    root.classList.toggle('yte-mini', on);
    if (on) ensureBar();
    YTE.bridge('mini', on);
    // Let YouTube recompute the video size for the new box.
    requestAnimationFrame(() => YTE.bridge('resize'));
  }

  function paintConfig() {
    const s = YTE.settings;
    root.style.setProperty('--yte-mini-w', `${SIZES[s.miniSize] || SIZES.medium}px`);
    root.dataset.yteMiniPos = s.miniPosition;
  }

  function ensureBar() {
    const host = document.querySelector('ytd-watch-flexy ytd-player#ytd-player');
    if (!host || bar?.parentElement === host) return;
    bar = YTE.el('div', { class: 'yte-mini-bar' });
    const top = YTE.el('button', {
      class: 'yte-mini-btn',
      title: 'Back to the video',
      html: YTE.svg('M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z')
    });
    top.addEventListener('click', (e) => {
      e.stopPropagation();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    const close = YTE.el('button', {
      class: 'yte-mini-btn',
      title: 'Close mini player',
      html: YTE.svg('M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z')
    });
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissed = true;
      setActive(false);
    });
    bar.append(top, close);
    host.append(bar);
  }

  function onIntersect([entry]) {
    const video = YTE.video;
    const scrolledPast = entry.intersectionRatio < 0.5 && entry.boundingClientRect.top < 0;
    if (!scrolledPast) dismissed = false;
    const want = YTE.settings.miniPlayer && scrolledPast && !dismissed && !document.fullscreenElement &&
      !!video && !video.ended && (video.currentTime > 0 || !video.paused);
    setActive(want);
  }

  // Watch the space the player normally occupies (it stays in the layout while floating).
  function observe() {
    const player = document.querySelector('ytd-watch-flexy ytd-player#ytd-player');
    const target = player?.parentElement;
    if (!target || target === slot) return;
    observer?.disconnect();
    slot = target;
    observer = new IntersectionObserver(onIntersect, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    observer.observe(slot);
  }

  function stop() {
    observer?.disconnect();
    observer = null;
    slot = null;
    setActive(false);
  }

  let theaterWatch = null;
  async function start() {
    const flexy = await YTE.waitFor('ytd-watch-flexy');
    await YTE.waitFor('ytd-watch-flexy ytd-player#ytd-player');
    if (!YTE.settings.miniPlayer || !YTE.isWatchPage()) return;
    observe();
    // The player moves to another container when theater mode toggles.
    if (flexy && !theaterWatch) {
      theaterWatch = new MutationObserver(() => requestAnimationFrame(observe));
      theaterWatch.observe(flexy, { attributes: true, attributeFilter: ['theater', 'fullscreen'] });
    }
  }

  YTE.feature({
    name: 'miniplayer',
    init: paintConfig,
    navigate({ videoId, changed }) {
      if (!videoId) return stop();
      if (changed) {
        dismissed = false;
        setActive(false);
      }
      return start();
    },
    settingsChanged(keys) {
      if (keys.includes('miniSize') || keys.includes('miniPosition')) {
        paintConfig();
        if (active) YTE.bridge('resize');
      }
      if (keys.includes('miniPlayer')) {
        if (YTE.settings.miniPlayer && YTE.videoId) start();
        else stop();
      }
    }
  });

  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) setActive(false);
  });
})();
