/*
 * Playback quality (videos, playlists, full screen, mini player) and video codec/format limits.
 * The page bridge does the actual switching through YouTube's player API.
 */
(() => {
  const QUALITY_KEYS = ['quality', 'qualityPlaylist', 'qualityFullscreenOn', 'qualityFullscreen',
    'qualityFullscreenRestore', 'miniQuality', 'pipQuality'];
  const CODEC_KEYS = ['forceFps30', 'forceAvc'];

  const config = () => Object.fromEntries(QUALITY_KEYS.map((k) => [k, YTE.settings[k]]));

  function sendConfig(force = false) {
    document.dispatchEvent(new CustomEvent('yte:bridge', {
      detail: JSON.stringify({ cmd: 'config', value: config(), force })
    }));
  }

  // The format filter runs before YouTube loads, so it reads these flags from localStorage.
  function syncCodecs() {
    const flags = { fps30: !!YTE.settings.forceFps30, avc: !!YTE.settings.forceAvc };
    try {
      localStorage.setItem('yte-codecs', JSON.stringify(flags));
    } catch {
      // storage blocked; the filter will stay off
    }
    YTE.bridge('codecs', flags);
  }

  // ---------- Quality button ----------
  const LEVELS = [
    { value: 'auto', label: 'Auto' },
    { value: 'large', label: '480p' },
    { value: 'hd720', label: '720p' },
    { value: 'hd1080', label: '1080p' },
    { value: 'hd1440', label: '2K' },
    { value: 'hd2160', label: '4K' },
    { value: 'highres', label: '8K' }
  ];
  const SHORT = {
    tiny: '144', small: '240', medium: '360', large: '480', hd720: '720',
    hd1080: '1080', hd1440: '2K', hd2160: '4K', hd2880: '5K', highres: '8K'
  };
  const info = { current: '', available: [], auto: true };
  let button = null;

  function paint() {
    if (!button) return;
    button.querySelector('.yte-speed-text').textContent = SHORT[info.current] || 'HD';
    button.classList.toggle('yte-on', !info.auto);
    button.title = `Quality: ${info.auto ? 'Auto' : SHORT[info.current] || '—'}`;
  }

  function openMenu(btn) {
    YTE.menu.open(btn, {
      title: 'Quality',
      items: LEVELS.map((l) => ({
        label: l.label,
        value: l.value,
        active: l.value === 'auto' ? info.auto : !info.auto && l.value === info.current,
        disabled: l.value !== 'auto' && info.available.length > 0 && !info.available.includes(l.value)
      })),
      onSelect: (value) => {
        YTE.bridge('quality-set', value);
        YTE.osd(`Quality ${LEVELS.find((l) => l.value === value).label}`);
      }
    });
    YTE.bridge('quality-info');
  }

  YTE.controls.register({
    key: 'btnQuality',
    order: 5,
    build() {
      button = YTE.controls.button({
        title: 'Quality',
        cls: 'yte-speed yte-quality',
        onclick: (e, b) => openMenu(b)
      });
      button.append(YTE.el('span', { class: 'yte-speed-text' }));
      // Right-click goes back to Auto.
      button.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        YTE.bridge('quality-set', 'auto');
        YTE.osd('Quality Auto');
      });
      paint();
      YTE.bridge('quality-info');
      return button;
    }
  });

  YTE.feature({
    name: 'quality',
    init: syncCodecs,
    async navigate({ videoId }) {
      if (!videoId) return;
      await YTE.waitFor('#movie_player');
      sendConfig();
      YTE.bridge('quality-info');
    },
    settingsChanged(keys) {
      if (keys.some((k) => QUALITY_KEYS.includes(k))) sendConfig(keys.includes('quality') || keys.includes('qualityPlaylist'));
      if (keys.some((k) => CODEC_KEYS.includes(k))) syncCodecs();
    },
    page(data) {
      if (data.type === 'volume') YTE.osd(`Volume ${data.value}%`);
      else if (data.type === 'quality') {
        Object.assign(info, data);
        paint();
      }
    }
  });
})();
