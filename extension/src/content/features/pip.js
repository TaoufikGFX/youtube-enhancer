/*
 * Picture-in-Picture button.
 */
(() => {
  async function toggle() {
    const video = YTE.video;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else {
        video.removeAttribute('disablepictureinpicture');
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('[YouTube Enhancer] pip', err);
    }
  }

  YTE.controls.register({
    key: 'btnPip',
    order: 60,
    build() {
      return YTE.controls.button({ icon: YTE.icons.pip, title: 'Picture-in-Picture', cls: 'yte-pip', onclick: toggle });
    }
  });

  YTE.feature({
    name: 'pip',
    command(name) {
      if (name === 'toggle-pip') toggle();
    }
  });
})();
