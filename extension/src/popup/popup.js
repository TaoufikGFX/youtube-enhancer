const $ = (id) => document.getElementById(id);
let tab = null;
let videoId = null;

function openOptions() {
  chrome.runtime.openOptionsPage();
  window.close();
}

async function showVideo() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  videoId = tab?.url ? yteVideoIdFromUrl(tab.url) : null;
  const onYouTube = /^https:\/\/(www|m)\.youtube\.com\//.test(tab?.url || '');

  $('now').hidden = !videoId;
  $('empty').hidden = !!videoId;
  $('status').textContent = videoId ? 'Watching on YouTube' : onYouTube ? 'On YouTube' : 'Not on YouTube';

  if (!videoId) {
    $('speed-block').hidden = true;
    return;
  }
  $('now-title').textContent = (tab.title || '').replace(/ - YouTube$/, '');

  const img = $('thumb');
  img.onload = () => {
    $('thumb-res').textContent = `${img.naturalWidth}×${img.naturalHeight}`;
  };
  img.src = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
  chrome.runtime.sendMessage({ type: 'bestThumbnail', videoId }).then((res) => {
    if (res?.url) img.src = res.url;
  });

  // Live speed of the video in the tab (only on watch pages with the content script running).
  try {
    const state = await chrome.tabs.sendMessage(tab.id, { type: 'getState' });
    paintSpeed(state?.rate);
  } catch {
    $('speed-block').hidden = true;
  }
}

function paintSpeed(rate) {
  for (const btn of $('speed-seg').querySelectorAll('button')) {
    btn.classList.toggle('on', Number(btn.dataset.speed) === rate);
  }
  if (rate) $('speed-now').textContent = `Current video · ${rate}×`;
}

$('speed-seg').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-speed]');
  if (!btn || !tab) return;
  const rate = Number(btn.dataset.speed);
  chrome.tabs.sendMessage(tab.id, { type: 'command', command: 'speed-set', value: rate }).catch(() => {});
  paintSpeed(rate);
});

$('thumb-btn').addEventListener('click', () => {
  if (!videoId) return;
  chrome.runtime.sendMessage({ type: 'openThumbnail', videoId, tab }).then(() => window.close());
});

$('reset-filters').addEventListener('click', () => {
  const patch = {};
  for (const key of YTE_FILTER_KEYS) patch[key] = YTE_DEFAULTS[key];
  chrome.storage.local.set(patch);
});

$('open-options').addEventListener('click', openOptions);

YTEBind.init();
showVideo();
