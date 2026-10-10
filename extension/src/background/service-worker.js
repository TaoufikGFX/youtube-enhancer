importScripts('/src/shared/defaults.js');

const THUMB_SIZES = ['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault', 'default'];
const YT_LINK_PATTERNS = [
  '*://www.youtube.com/watch*',
  '*://m.youtube.com/watch*',
  '*://www.youtube.com/shorts/*',
  '*://youtu.be/*'
];

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  // Fill in any missing keys without touching values the user already chose.
  const stored = await chrome.storage.local.get(null);
  const missing = {};
  for (const [key, value] of Object.entries(YTE_DEFAULTS)) {
    if (!(key in stored)) missing[key] = value;
  }
  if (Object.keys(missing).length) await chrome.storage.local.set(missing);
  const retired = Object.keys(stored).filter((key) => !(key in YTE_DEFAULTS));
  if (retired.length) await chrome.storage.local.remove(retired);

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'yte-thumb-link',
      title: 'Open video thumbnail (best quality)',
      contexts: ['link'],
      targetUrlPatterns: YT_LINK_PATTERNS
    });
    chrome.contextMenus.create({
      id: 'yte-thumb-page',
      title: 'Open this video’s thumbnail (best quality)',
      contexts: ['page', 'video'],
      documentUrlPatterns: YT_LINK_PATTERNS
    });
  });

  if (reason === 'install') chrome.runtime.openOptionsPage();
});

async function bestThumbnailUrl(videoId) {
  for (const size of THUMB_SIZES) {
    const url = `https://i.ytimg.com/vi/${videoId}/${size}.jpg`;
    try {
      const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      if (res.ok) return url;
    } catch {
      // try the next size
    }
  }
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

async function openThumbnail(videoId, sourceTab) {
  if (!videoId) return;
  const url = await bestThumbnailUrl(videoId);
  const props = { url, active: true };
  if (sourceTab) {
    props.index = sourceTab.index + 1;
    props.windowId = sourceTab.windowId;
    props.openerTabId = sourceTab.id;
  }
  await chrome.tabs.create(props);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'openThumbnail') {
    openThumbnail(msg.videoId, sender.tab || msg.tab).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === 'bestThumbnail') {
    bestThumbnailUrl(msg.videoId).then((url) => sendResponse({ url }));
    return true;
  }
  return false;
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const source = info.menuItemId === 'yte-thumb-link' ? info.linkUrl : (info.pageUrl || tab?.url);
  openThumbnail(yteVideoIdFromUrl(source), tab);
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'open-options') {
    chrome.runtime.openOptionsPage();
    return;
  }
  const target = tab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!target?.id || !/^https:\/\/(www|m)\.youtube\.com\//.test(target.url || '')) return;
  chrome.tabs.sendMessage(target.id, { type: 'command', command }).catch(() => {});
});
