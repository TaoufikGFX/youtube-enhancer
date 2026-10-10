/*
 * Thumbnail preview beside the channel avatar on watch pages.
 * Clicking it opens the highest quality thumbnail available in a new tab.
 */
(() => {
  let node = null;

  function build() {
    node = YTE.el('button', {
      class: 'yte-thumb',
      title: 'Open thumbnail in best quality',
      'aria-label': 'Open thumbnail in best quality',
      html: '<img alt="" decoding="async"><span class="yte-thumb-hint">HD</span>'
    });
    node.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (YTE.videoId) chrome.runtime.sendMessage({ type: 'openThumbnail', videoId: YTE.videoId });
    });
    return node;
  }

  async function place(videoId) {
    if (!YTE.settings.thumbnailEnabled || !videoId) {
      node?.remove();
      return;
    }
    const owner = await YTE.waitFor('ytd-watch-metadata #owner');
    if (!owner || YTE.videoId !== videoId) return;
    if (!node) build();
    if (node.parentElement !== owner) owner.prepend(node);
    const img = node.querySelector('img');
    const src = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
    if (img.getAttribute('src') !== src) img.src = src;
  }

  YTE.feature({
    name: 'thumbnail',
    navigate({ videoId }) {
      return place(videoId);
    },
    settingsChanged(keys) {
      if (keys.includes('thumbnailEnabled')) place(YTE.videoId);
    },
    command(name) {
      if (name === 'open-thumbnail' && YTE.videoId) {
        chrome.runtime.sendMessage({ type: 'openThumbnail', videoId: YTE.videoId });
      }
    }
  });
})();
