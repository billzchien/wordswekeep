/* Words We Keep — the privacy page (privacy.html). The All symbol draws in (as the 404 and the
   form's thank-you), the links answer as everywhere on the site, and the wheel scrolls the page
   on the same eased glide as the notes (js/app.js → "Notes: smooth (eased) wheel scrolling"). */
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

/* ---------- Links: buttons and spans with a data-href, not <a href> (js/app.js → follow) ---------- */
function follow(el, e) {
  const href = el.dataset.href;
  if (href.startsWith('mailto:')) { location.href = href; return; }
  if (e && (e.metaKey || e.ctrlKey || e.button === 1)) window.open(href, '_blank', 'noopener');
  else location.href = href;
}
document.addEventListener('click', (e) => { const el = e.target.closest('[data-href]'); if (el) follow(el, e); });
document.addEventListener('auxclick', (e) => { const el = e.target.closest('[data-href]'); if (el && e.button === 1) follow(el, e); });
document.addEventListener('keydown', (e) => { // a span with role="link" answers Enter like a link
  if (e.key === 'Enter' && e.target.matches && e.target.matches('span[data-href]')) follow(e.target, e);
});

/* ---------- Smooth (eased) wheel scrolling ----------
   Wheel and trackpad input moves a target; the page glides after it, covering SCROLL_EASE of the
   remaining distance every frame. Touch keeps the device's own momentum; keys, the scrollbar and
   anything else stay native. Same numbers as the notes: change both. */
const SCROLL_EASE = 0.11;
const page = document.scrollingElement || document.documentElement;
const glide = { pos: 0, target: 0, raf: 0 };
function glideStep() {
  const gap = glide.target - glide.pos;
  if (Math.abs(gap) < 0.4) {
    glide.pos = glide.target;
    page.scrollTop = glide.pos;
    glide.raf = 0;
    return;
  }
  glide.pos += gap * SCROLL_EASE; // kept as a fraction: scrollTop itself rounds to whole pixels
  page.scrollTop = glide.pos;
  glide.raf = requestAnimationFrame(glideStep);
}
window.addEventListener('wheel', (e) => {
  if (reduceMotion.matches || e.ctrlKey) return; // ctrl+wheel = pinch zoom
  e.preventDefault();
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1; // lines / pages → px
  if (!glide.raf) glide.pos = glide.target = page.scrollTop;
  const max = page.scrollHeight - innerHeight;
  glide.target = Math.max(0, Math.min(max, glide.target + e.deltaY * unit));
  if (!glide.raf) glide.raf = requestAnimationFrame(glideStep);
}, { passive: false });
// Any other kind of scrolling takes over cleanly.
const dropGlide = () => { cancelAnimationFrame(glide.raf); glide.raf = 0; glide.pos = glide.target = page.scrollTop; };
['touchstart', 'mousedown', 'keydown'].forEach((type) => window.addEventListener(type, dropGlide, { passive: true }));

/* ---------- The symbol draws in; without the symbols' files the still image stands ----------
   (last: it waits for its files, and nothing above should wait with it) */
const home = document.querySelector('.pv-home');
try {
  const [lib, data] = await Promise.all([
    import('../assets/symbols/ribbon-draw.js'),
    fetch('https://fonts.wordswekeep.org/s/symbol-draw-in.json').then((r) => { if (!r.ok) throw new Error(`symbols: ${r.status}`); return r.json(); }),
  ]);
  const model = lib.createModel(data);
  const r = lib.createRenderer(document.getElementById('pvSym'), model);
  if (reduceMotion.matches) r.drawIn('All', 1); else lib.play(model, (t) => r.drawIn('All', t));
} catch (err) {
  console.error(err);
  home.classList.add('is-static');
}
