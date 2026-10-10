/*
 * Default settings shared by every part of the extension.
 * Loaded as a classic script in the service worker, popup, options page and content scripts.
 */
const YTE_DEFAULTS = Object.freeze({
  // Repeat: 0 = off, 1..5 = repeat N more times, -1 = unlimited
  repeatMode: 0,
  repeatRemember: true,

  // Thumbnail button next to the channel avatar
  thumbnailEnabled: true,

  // Player buttons
  btnQuality: true,
  btnRepeat: true,
  btnSpeed: true,
  btnScreenshot: true,
  btnBoost: true,
  btnCinema: true,
  btnExpand: true,
  btnPip: true,

  // Playback speed
  speedDefault: 1,
  speedStep: 0.25,
  speedWheel: true,

  // Quality: '' = let YouTube decide
  quality: '',
  qualityPlaylist: '', // '' = same as videos
  qualityFullscreenOn: false,
  qualityFullscreen: 'hd1080',
  qualityFullscreenRestore: true,

  // Video codecs and formats (take effect on the next page load)
  forceFps30: false,
  forceAvc: false,

  // Mini player while scrolling
  miniPlayer: false,
  miniSize: 'medium', // small | medium | large
  miniPosition: 'bottom-right', // bottom-right | bottom-left | top-right | top-left
  miniQuality: '', // '' = keep the current quality

  // Picture-in-Picture
  pipQuality: '', // '' = keep the current quality

  // Audio
  boostOn: false,
  boostLevel: 2,
  volumeWheel: false,
  volumeWheelStep: 5,

  // Layout
  hideShorts: false,
  hideComments: false,
  hideRelated: false,
  hideEndscreen: false,
  hideChat: false,
  videosPerRow: 0,
  expandPlayer: false,
  disableAutoplay: false,
  expandDescription: false,

  // Cinema mode
  cinemaAuto: false,
  cinemaOpacity: 90,

  // Video filters
  filterBrightness: 100,
  filterContrast: 100,
  filterSaturate: 100,
  filterHue: 0,
  filterGrayscale: 0,
  filterSepia: 0,
  filterInvert: 0,
  filterBlur: 0,
  flipH: false,
  flipV: false,

  // Screenshot: 'download' | 'copy' | 'both'
  screenshotFormat: 'png',
  screenshotAction: 'download',

  // Small on-screen messages for speed/volume/repeat changes
  osd: true
});

const YTE_FILTER_KEYS = ['filterBrightness', 'filterContrast', 'filterSaturate', 'filterHue',
  'filterGrayscale', 'filterSepia', 'filterInvert', 'filterBlur', 'flipH', 'flipV'];

const YTE_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];

const YTE_REPEAT_MODES = [
  { value: 0, label: 'Off' },
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
  { value: 3, label: '3×' },
  { value: 4, label: '4×' },
  { value: 5, label: '5×' },
  { value: -1, label: '∞' }
];

function yteLoadSettings() {
  return chrome.storage.local.get(null).then((stored) => ({ ...YTE_DEFAULTS, ...stored }));
}

function yteSaveSettings(patch) {
  return chrome.storage.local.set(patch);
}

function yteVideoIdFromUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (u.pathname === '/watch') return u.searchParams.get('v');
    const m = u.pathname.match(/^\/(?:shorts|live|embed|v)\/([\w-]{11})/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}
