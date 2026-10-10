/*
 * Screenshot: captures the current frame at the video's native resolution
 * (with active filters and flips) and downloads it and/or copies it to the clipboard.
 */
(() => {
  function fileName(ext) {
    const title = (document.title || 'YouTube').replace(/ - YouTube$/, '').replace(/[\\/:*?"<>|]+/g, ' ').trim();
    const time = YTE.formatTime(YTE.video?.currentTime || 0);
    return `${title.slice(0, 120)} [${time}].${ext}`;
  }

  async function capture() {
    const video = YTE.video;
    if (!video || !video.videoWidth) return;
    const s = YTE.settings;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.filter = YTE.filters?.css() || 'none';
    ctx.translate(s.flipH ? canvas.width : 0, s.flipV ? canvas.height : 0);
    ctx.scale(s.flipH ? -1 : 1, s.flipV ? -1 : 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const toBlob = (type) => new Promise((r) => canvas.toBlob(r, type, 0.95));
    const jpeg = s.screenshotFormat === 'jpeg';
    let pngBlob = null;

    if (s.screenshotAction !== 'copy') {
      const blob = await toBlob(jpeg ? 'image/jpeg' : 'image/png');
      if (!blob) return;
      if (!jpeg) pngBlob = blob;
      const url = URL.createObjectURL(blob);
      YTE.el('a', { href: url, download: fileName(jpeg ? 'jpg' : 'png') }).click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
    if (s.screenshotAction !== 'download') {
      try {
        pngBlob ??= await toBlob('image/png');
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
      } catch (err) {
        console.warn('[YouTube Enhancer] clipboard', err);
      }
    }
    YTE.player?.classList.add('yte-flash');
    setTimeout(() => YTE.player?.classList.remove('yte-flash'), 250);
    YTE.osd(s.screenshotAction === 'copy' ? 'Screenshot copied' : 'Screenshot saved');
  }

  YTE.controls.register({
    key: 'btnScreenshot',
    order: 40,
    build() {
      const btn = YTE.controls.button({ title: 'Screenshot', cls: 'yte-shot', onclick: capture });
      // Outline camera with a small spark, same drawing as the Video Screenshot extension.
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <path class="yte-cam" d="M8.1 6.1 9.25 4.5h5.5l1.15 1.6h2.35A2.75 2.75 0 0 1 21 8.85v8.4A2.75 2.75 0 0 1 18.25 20H5.75A2.75 2.75 0 0 1 3 17.25v-8.4A2.75 2.75 0 0 1 5.75 6.1H8.1Z"/>
        <circle class="yte-cam" cx="12" cy="13" r="3.45"/>
        <path class="yte-spark" d="M18.2 3v2.4M17 4.2h2.4"/>
      </svg>`;
      return btn;
    }
  });

  YTE.feature({
    name: 'screenshot',
    command(name) {
      if (name === 'screenshot') capture();
    }
  });
})();
