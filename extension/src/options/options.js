const $ = (id) => document.getElementById(id);

let toastTimer;
function toast(text = 'Saved') {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1400);
}

YTEBind.onSaved = () => toast('Saved');
YTEBind.init();

$('version').textContent = chrome.runtime.getManifest().version;

// Highlight the sidebar entry of the section in view.
const links = new Map([...document.querySelectorAll('[data-nav]')].map((a) => [a.dataset.nav, a]));
const spy = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const a of links.values()) a.classList.remove('active');
      links.get(entry.target.id)?.classList.add('active');
    }
  },
  { rootMargin: '-20% 0px -70% 0px' }
);
document.querySelectorAll('.section').forEach((s) => spy.observe(s));

$('reset-filters').addEventListener('click', async () => {
  const patch = {};
  for (const key of YTE_FILTER_KEYS) patch[key] = YTE_DEFAULTS[key];
  await chrome.storage.local.set(patch);
  toast('Filters reset');
});

$('open-shortcuts').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));

$('export').addEventListener('click', async () => {
  const settings = await yteLoadSettings();
  const blob = new Blob([JSON.stringify({ app: 'youtube-enhancer-plus', version: 1, settings }, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `youtube-enhancer-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('Backup downloaded');
});

$('import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const source = data.settings || data;
    const clean = {};
    for (const [key, value] of Object.entries(source)) {
      if (key in YTE_DEFAULTS && typeof value === typeof YTE_DEFAULTS[key]) clean[key] = value;
    }
    if (!Object.keys(clean).length) throw new Error('empty');
    await chrome.storage.local.set(clean);
    toast(`Imported ${Object.keys(clean).length} settings`);
  } catch {
    toast('That file is not a valid backup');
  }
});

$('reset-all').addEventListener('click', async () => {
  if (!confirm('Reset all settings to their defaults?')) return;
  await chrome.storage.local.clear();
  await chrome.storage.local.set({ ...YTE_DEFAULTS });
  toast('All settings reset');
});
