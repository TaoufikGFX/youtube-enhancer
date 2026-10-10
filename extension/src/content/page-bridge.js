/*
 * Runs in the page's own JavaScript world so it can use YouTube's player API
 * (quality selection, volume with YouTube's UI kept in sync) and filter video formats.
 * Talks to the extension through DOM events only.
 */
(() => {
  // ---------- Video codecs and formats ----------
  // Must be patched before YouTube's player starts; flags come from the previous visit.
  let codecs = {};
  try {
    codecs = JSON.parse(localStorage.getItem('yte-codecs') || '{}');
  } catch {
    // keep defaults
  }

  function blockedType(type) {
    if (typeof type !== 'string') return false;
    if (codecs.fps30) {
      const fps = /framerate=(\d+)/.exec(type);
      if (fps && Number(fps[1]) > 30) return true;
    }
    if (codecs.avc && /^video\//.test(type) && /(vp0?9|vp8|av01)/i.test(type)) return true;
    return false;
  }

  if (window.MediaSource?.isTypeSupported) {
    const original = MediaSource.isTypeSupported.bind(MediaSource);
    MediaSource.isTypeSupported = (type) => (blockedType(type) ? false : original(type));
  }
  if (navigator.mediaCapabilities?.decodingInfo) {
    const original = navigator.mediaCapabilities.decodingInfo.bind(navigator.mediaCapabilities);
    navigator.mediaCapabilities.decodingInfo = (config) => {
      const video = config?.video;
      const tooFast = codecs.fps30 && video && Number(video.framerate) > 30;
      const badCodec = video && blockedType(video.contentType);
      if (tooFast || badCodec) {
        return Promise.resolve({ supported: false, smooth: false, powerEfficient: false });
      }
      return original(config);
    };
  }

  // ---------- Quality ----------
  const QUALITY_ORDER = ['highres', 'hd2880', 'hd2160', 'hd1440', 'hd1080', 'hd720', 'large', 'medium', 'small', 'tiny'];
  let cfg = {};
  let fullscreen = false;
  let mini = false;
  let pip = false;
  let doneFor = null; // video id whose starting quality was already applied
  let saved = null; // quality to go back to after a temporary override

  const player = () => document.getElementById('movie_player');
  const reply = (data) => document.dispatchEvent(new CustomEvent('yte:page', { detail: JSON.stringify(data) }));
  const inPlaylist = () => new URLSearchParams(location.search).has('list');

  const baseQuality = () => (inPlaylist() && cfg.qualityPlaylist) || cfg.quality || '';
  const override = () => {
    if (pip && cfg.pipQuality) return cfg.pipQuality;
    if (mini && cfg.miniQuality) return cfg.miniQuality;
    if (fullscreen && cfg.qualityFullscreenOn && cfg.qualityFullscreen) return cfg.qualityFullscreen;
    return '';
  };

  function setQuality(quality) {
    const p = player();
    if (!p?.getAvailableQualityLevels) return false;
    if (!quality || quality === 'auto') {
      p.setPlaybackQualityRange?.('auto', 'auto');
      p.setPlaybackQuality?.('auto');
      return true;
    }
    const available = p.getAvailableQualityLevels().filter((q) => q !== 'auto');
    if (!available.length) return false;
    const wanted = QUALITY_ORDER.indexOf(quality);
    const pick = available.find((q) => QUALITY_ORDER.indexOf(q) >= wanted) || available[available.length - 1];
    p.setPlaybackQualityRange?.(pick, pick);
    p.setPlaybackQuality?.(pick);
    return true;
  }

  function applyForVideo(force = false) {
    const p = player();
    const videoId = p?.getVideoData?.().video_id;
    if (!videoId || (!force && doneFor === videoId)) return;
    const target = override() || baseQuality();
    if (!target && !force) {
      doneFor = videoId;
      return;
    }
    if (setQuality(target)) doneFor = videoId;
  }

  // Switching quality makes YouTube reload the stream, which can leave the video paused
  // (especially inside Picture-in-Picture). If it was playing, keep it playing through the switch.
  let guardCleanup = null;
  function switchKeepingPlayback(quality) {
    const p = player();
    const video = document.querySelector('#movie_player video.html5-main-video');
    const wasPlaying = !!video && !video.paused && !video.ended;
    guardCleanup?.();
    setQuality(quality);
    if (!wasPlaying) return;

    let reloaded = false;
    let settle = null;
    const resume = () => {
      if (video.paused) {
        p?.playVideo?.();
        video.play().catch(() => {});
      }
    };
    const onEmptied = () => { reloaded = true; };
    const onPause = () => {
      clearTimeout(settle);
      resume();
    };
    const onReady = () => { if (reloaded) resume(); };
    // Stop guarding once playback has run smoothly for a moment, so a later pause by the user is respected.
    const onPlaying = () => {
      if (!reloaded) return;
      clearTimeout(settle);
      settle = setTimeout(cleanup, 2000);
    };
    const cleanup = () => {
      clearTimeout(timer);
      clearTimeout(settle);
      video.removeEventListener('emptied', onEmptied);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('playing', onPlaying);
      guardCleanup = null;
    };
    const timer = setTimeout(() => { resume(); cleanup(); }, 8000);
    // Same quality as before: nothing reloads, so stop guarding quickly.
    setTimeout(() => { if (!reloaded) cleanup(); }, 1000);
    video.addEventListener('emptied', onEmptied);
    video.addEventListener('pause', onPause);
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('canplay', onReady);
    video.addEventListener('playing', onPlaying);
    guardCleanup = cleanup;
  }

  // Called whenever full screen, the mini player or Picture-in-Picture turns on/off.
  function overrideChanged(wasOverriding, restore = true) {
    const target = override();
    if (target) {
      if (!wasOverriding) saved = player()?.getPlaybackQuality?.() || null;
      switchKeepingPlayback(target);
    } else if (wasOverriding && restore) {
      switchKeepingPlayback(baseQuality() || saved || 'auto');
      saved = null;
    }
  }

  // Tells the extension which quality is playing and which ones this video offers.
  function sendQualityInfo() {
    const p = player();
    if (!p?.getAvailableQualityLevels) return;
    reply({
      type: 'quality',
      current: p.getPlaybackQuality?.() || '',
      available: p.getAvailableQualityLevels().filter((q) => q !== 'auto'),
      auto: !p.getPreferredQuality || p.getPreferredQuality() === 'auto'
    });
  }

  let hookedPlayer = null;
  function hookPlayer() {
    const p = player();
    if (!p || p === hookedPlayer || !p.addEventListener) return;
    hookedPlayer = p;
    p.addEventListener('onStateChange', (state) => {
      if (state === 1 || state === 3 || state === 5 || state === -1) applyForVideo();
      if (state === 1 || state === 5) sendQualityInfo();
    });
    p.addEventListener('onPlaybackQualityChange', sendQualityInfo);
  }

  document.addEventListener('fullscreenchange', () => {
    const was = override();
    fullscreen = !!document.fullscreenElement;
    const leaving = !fullscreen;
    overrideChanged(!!was, !leaving || cfg.qualityFullscreenRestore !== false);
  });

  // Picture-in-Picture from any source (our button, YouTube's menu, Chrome's own control).
  // These events don't bubble, so listen in the capture phase.
  for (const [type, on] of [['enterpictureinpicture', true], ['leavepictureinpicture', false]]) {
    document.addEventListener(type, (e) => {
      if (!e.target?.classList?.contains('html5-main-video')) return;
      const was = override();
      pip = on;
      overrideChanged(!!was);
    }, true);
  }

  document.addEventListener('yte:bridge', (e) => {
    let msg;
    try {
      msg = JSON.parse(e.detail);
    } catch {
      return;
    }
    const p = player();
    if (msg.cmd === 'config') {
      const changed = !!msg.force;
      cfg = msg.value || {};
      hookPlayer();
      applyForVideo(changed);
    } else if (msg.cmd === 'mini') {
      const was = override();
      mini = !!msg.value;
      overrideChanged(!!was);
    } else if (msg.cmd === 'quality-set') {
      hookPlayer();
      switchKeepingPlayback(msg.value);
      setTimeout(sendQualityInfo, 300);
    } else if (msg.cmd === 'quality-info') {
      hookPlayer();
      sendQualityInfo();
    } else if (msg.cmd === 'codecs') {
      codecs = msg.value || {};
    } else if (msg.cmd === 'resize') {
      window.dispatchEvent(new Event('resize'));
    } else if (msg.cmd === 'volume' && p?.getVolume) {
      const volume = Math.max(0, Math.min(100, Math.round(p.getVolume() + msg.value)));
      if (volume > 0 && p.isMuted?.()) p.unMute();
      p.setVolume(volume);
      reply({ type: 'volume', value: volume });
    }
  });

  document.addEventListener('yt-navigate-finish', () => {
    hookPlayer();
    applyForVideo();
  });
  document.addEventListener('yt-player-updated', hookPlayer);
})();
