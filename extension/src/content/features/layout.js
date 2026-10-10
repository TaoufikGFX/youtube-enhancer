/*
 * Layout & appearance: hide page sections, grid density, video filters, cinema dim level,
 * plus one-shot tweaks on watch pages (expanded player, autoplay off, expanded description).
 * Everything visual goes through CSS classes and a single dynamic <style>, so there is no polling.
 */
(() => {
  const root = document.documentElement;
  const CLASS_FLAGS = {
    hideShorts: 'yte-hide-shorts',
    hideComments: 'yte-hide-comments',
    hideRelated: 'yte-hide-related',
    hideEndscreen: 'yte-hide-endscreen',
    hideChat: 'yte-hide-chat',
    expandPlayer: 'yte-expand'
  };
  let style = null;

  YTE.filters = {
    css() {
      const s = YTE.settings;
      const parts = [];
      if (s.filterBrightness !== 100) parts.push(`brightness(${s.filterBrightness}%)`);
      if (s.filterContrast !== 100) parts.push(`contrast(${s.filterContrast}%)`);
      if (s.filterSaturate !== 100) parts.push(`saturate(${s.filterSaturate}%)`);
      if (s.filterHue) parts.push(`hue-rotate(${s.filterHue}deg)`);
      if (s.filterGrayscale) parts.push(`grayscale(${s.filterGrayscale}%)`);
      if (s.filterSepia) parts.push(`sepia(${s.filterSepia}%)`);
      if (s.filterInvert) parts.push(`invert(${s.filterInvert}%)`);
      if (s.filterBlur) parts.push(`blur(${s.filterBlur}px)`);
      return parts.join(' ');
    }
  };

  function applyStyles() {
    const s = YTE.settings;
    for (const [key, cls] of Object.entries(CLASS_FLAGS)) root.classList.toggle(cls, !!s[key]);

    const rules = [];
    if (s.videosPerRow > 0) {
      rules.push(`ytd-rich-grid-renderer{--ytd-rich-grid-items-per-row:${s.videosPerRow}!important;--ytd-rich-grid-posts-per-row:${s.videosPerRow}!important}`);
    }
    const filter = YTE.filters.css();
    const flip = s.flipH || s.flipV ? `scale(${s.flipH ? -1 : 1},${s.flipV ? -1 : 1})` : '';
    if (filter) rules.push(`#movie_player video.html5-main-video{filter:${filter}}`);
    if (flip) rules.push(`#movie_player .html5-video-container{transform:${flip}}`);
    rules.push(`:root{--yte-cinema-opacity:${s.cinemaOpacity / 100}}`);

    if (!style) {
      style = document.createElement('style');
      style.id = 'yte-dynamic';
      (document.head || root).append(style);
    }
    style.textContent = rules.join('\n');
  }

  // The size button ignores clicks until the player has fully started, so retry a few times.
  async function ensureTheater() {
    const flexy = await YTE.waitFor('ytd-watch-flexy');
    const button = await YTE.waitFor('#movie_player .ytp-size-button');
    for (let i = 0; i < 8 && flexy && button; i++) {
      if (flexy.hasAttribute('theater') || flexy.hasAttribute('fullscreen') || !YTE.isWatchPage()) return;
      button.click();
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  // Leaving the expanded player goes back to the normal (default) layout.
  function exitTheater() {
    const flexy = document.querySelector('ytd-watch-flexy');
    if (flexy?.hasAttribute('theater')) document.querySelector('#movie_player .ytp-size-button')?.click();
  }

  let expandButton = null;
  function paintExpand() {
    if (!expandButton) return;
    const on = !!YTE.settings.expandPlayer;
    expandButton.classList.toggle('yte-on', on);
    expandButton.title = on ? 'Normal size' : 'Expand player';
    expandButton.setAttribute('aria-label', expandButton.title);
    expandButton.innerHTML = YTE.svg(on ? YTE.icons.shrink : YTE.icons.expand);
  }

  function toggleExpand() {
    const on = !YTE.settings.expandPlayer;
    YTE.save({ expandPlayer: on });
    YTE.osd(on ? 'Expanded player' : 'Normal size');
  }

  YTE.controls.register({
    key: 'btnExpand',
    order: 55,
    build() {
      expandButton = YTE.controls.button({ icon: YTE.icons.expand, title: 'Expand player', cls: 'yte-expand-btn', onclick: toggleExpand });
      paintExpand();
      return expandButton;
    }
  });

  async function watchTweaks() {
    const s = YTE.settings;
    // The expanded player is built on top of theater mode.
    if (s.expandPlayer) await ensureTheater();
    if (s.disableAutoplay) {
      const toggle = await YTE.waitFor('#movie_player .ytp-autonav-toggle-button');
      if (toggle?.getAttribute('aria-checked') === 'true') toggle.closest('button, .ytp-button')?.click();
    }
    if (s.expandDescription) {
      (await YTE.waitFor('ytd-watch-metadata #description-inline-expander #expand'))?.click();
    }
  }

  YTE.feature({
    name: 'layout',
    init: applyStyles,
    navigate({ videoId, changed }) {
      if (style && !style.isConnected) (document.head || root).append(style);
      if (videoId && changed) {
        setTimeout(() => YTE.bridge('resize'), 1500);
        return watchTweaks();
      }
    },
    command(name) {
      if (name === 'toggle-expand' && YTE.videoId) toggleExpand();
    },
    settingsChanged(keys) {
      applyStyles();
      if (keys.includes('expandPlayer')) {
        paintExpand();
        if (YTE.settings.expandPlayer && YTE.videoId) ensureTheater();
        else if (!YTE.settings.expandPlayer) exitTheater();
        requestAnimationFrame(() => YTE.bridge('resize'));
      }
      if (keys.includes('hideChat')) requestAnimationFrame(() => YTE.bridge('resize'));
    }
  });
})();
