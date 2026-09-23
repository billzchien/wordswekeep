/* Words We Keep — main experience. Plain JS, renders from data/quotes.json. */
(() => {
  const DATA_URL = '../data/quotes.json';

  const CATEGORIES = [
    { key: 'perspective', name: 'Perspective', desc: 'The lens we bring to life. Outlooks, values, and the search for meaning.' },
    { key: 'growth',      name: 'Growth',      desc: 'The hardships, changes, and moments that shape who we become.' },
    { key: 'drive',       name: 'Drive',       desc: 'The work, ambition, and craft we pour into building something that matters.' },
    { key: 'community',   name: 'Community',   desc: 'The family, friends, and connections that remind us we’re not alone.' },
    { key: 'romance',     name: 'Romance',     desc: 'The joy and heartbreak of loving and being loved by another person.' },
  ];
  const ALL = {
    key: 'all', name: 'All words',
    desc: 'Words We Keep is a collections of words that contributed by people to who kept them by hearts. This is a side project by brooklyn-based designer Bill, with the help of Rohan. Established since 2026.',
  };
  const CAT_BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));
  // Titles of standalone works are set in italics; shorter pieces (speech, letter, poem…) stay upright.
  const ITALIC_KINDS = new Set(['book', 'film', 'series', 'comic', 'artwork', 'album']);
  const LANG_GLYPH = { zh: '中', ja: '日', ko: '한' };

  const $ = (id) => document.getElementById(id);
  const app = $('app'), deck = $('deck'), track = $('track'), notes = $('notes');
  const mqMobile = window.matchMedia('(max-width: 599px)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mqHoverDesktop = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 1024px)');
  const regionNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;

  const state = {
    all: [], list: [], idx: 0,
    filter: 'all', preview: 'all',
    mode: 'main',
    original: false, // showing the original-language version of the current quote
    animating: false,
  };

  /* ---------- Helpers ---------- */

  const CJK_CHAR = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\uff00-\uffef\u3000-\u303f]/;

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mod = (n, m) => ((n % m) + m) % m;
  const current = () => state.list[state.idx];
  const at = (offset) => state.list[mod(state.idx + offset, state.list.length)];

  // Fewer words → bigger type.
  function tier(text) {
    const cjk = (text.match(/[぀-ヿ㐀-鿿가-힯]/g) || []).length;
    const weight = text.length + cjk * 3; // a CJK character carries about as much as a short word
    if (weight <= 64) return 'l';
    if (weight <= 160) return 'm';
    if (weight <= 260) return 's';
    return 'xs';
  }

  // Chinese/Japanese/Korean set inside running Latin text looks oversized at the same font size,
  // so those runs get the smaller native-script style (same as the author's native name).
  const CJK_RUN = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\uff00-\uffef\u3000-\u303f]+/g;
  const nativeRuns = (escapedHtml) => escapedHtml.replace(CJK_RUN, (run) => `<span class="n-native">${run}</span>`);

  function paragraphs(text) {
    return text.split(/\n\s*\n/).map((p) => p.replace(/[​\s]+$/g, '').trim()).filter(Boolean)
      .map((p) => `<p>${nativeRuns(esc(noOrphans(p))).replace(/\n/g, '<br>')}</p>`).join('');
  }

  function youtubeId(link) {
    if (!link) return null;
    const m = link.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
    return m ? m[1] : null;
  }

  function videoOf(q) {
    const id = youtubeId(q.source && q.source.link);
    if (!id) return null;
    const vertical = q.source.orientation === 'vertical' || /\/shorts\//.test(q.source.link);
    return { id, orientation: vertical ? 'vertical' : 'horizontal' };
  }

  /* ---------- Quote rendering ---------- */

  // No orphans — for every piece of running text on the site (quotes, notes, context, menu
  // descriptions, annotation notes): the last line (and each line of a poem) never holds a single
  // word, and a new sentence never starts with a single word left at the end of a line. Latin: the last two words are tied with a no-break space. CJK: the last four
  // characters are tied with word joiners. Applied at render time; the data stays clean.
  const NBSP = '\u00a0', WJ = '\u2060';
  function noOrphans(text) {
    return text.split('\n').map((line) => {
      const chars = [...line];
      const cjk = chars.filter((ch) => CJK_CHAR.test(ch)).length;
      if (cjk > chars.length / 2) {
        if (chars.length < 8) return line;
        return chars.slice(0, -4).join('') + chars.slice(-4).join(WJ);
      }
      const words = line.trimEnd().split(' ');
      if (words.length < 4) return line;
      const last = words.pop();
      const tied = `${words.join(' ')}${NBSP}${last}`;
      // …and no sentence may leave its first word stranded at the end of a line:
      // "stop. They / keep going." → the opener is tied to the word after it.
      return tied.replace(/([.!?…][”’)\]]*\s+[“‘(\[]*[^\s\u00a0]+) (?=\S)/g, `$1${NBSP}`);
    }).join('\n');
  }


  // Wrap annotated words (first occurrence each) in the English text.
  function annotate(text, annotations) {
    const lower = text.replace(/[\u00a0\n]/g, ' ').toLowerCase(); // tied words and locked line breaks still match (same length)
    const ranges = [];
    annotations.forEach((a, i) => {
      const start = lower.indexOf(a.word.toLowerCase());
      if (start < 0) return;
      const end = start + a.word.length;
      if (ranges.some((r) => start < r.end && end > r.start)) return;
      ranges.push({ start, end, i });
    });
    ranges.sort((a, b) => a.start - b.start);
    let html = '', pos = 0;
    ranges.forEach((r) => {
      html += esc(text.slice(pos, r.start));
      // A span, not a <button>: a button is an inline-block box — it cannot wrap across lines and it
      // changes the height of its line, so the notes quote would not sit like the main one.
      html += `<span class="ann" role="button" tabindex="0" data-ann="${r.i}">${esc(text.slice(r.start, r.end))}</span>`;
      pos = r.end;
    });
    return html + esc(text.slice(pos));
  }

  // The notes quote keeps the main quote's line breaks. Both are set at the same measure (in em),
  // but a fresh paragraph can still wrap differently (Safari's `text-wrap: pretty` in
  // particular re-balances lines), and then a word jumps rows as the modes change. So, before
  // the change, the lines of the quote on screen are recorded, and the notes quote is rendered
  // with those breaks hard-coded (a newline; the quote is `white-space: pre-line`).
  let lockedLines = null; // { text, html-free text with '\n' at the breaks }
  function lockLines(quoteEl) {
    lockedLines = null;
    if (!quoteEl || quoteEl.querySelector('.ann')) return; // one text node expected
    const words = measureWords(quoteEl);
    if (words.length < 2) return;
    const text = quoteEl.textContent;
    let out = text;
    for (let i = words.length - 1; i > 0; i--) {
      if (Math.abs(words[i].top - words[i - 1].top) < 4) continue;
      const at = words[i].start;
      // Replace the whitespace before the break — a space, or a newline the text already had
      // (a poem's own line breaks) — with a newline; after a hyphen or a CJK character there is
      // none, so insert one.
      out = /[ \u00a0\n]/.test(out[at - 1] || '') ? out.slice(0, at - 1) + '\n' + out.slice(at) : out.slice(0, at) + '\n' + out.slice(at);
    }
    lockedLines = { text, broken: out };
  }

  function quoteHTML(q, { original = false, withAnnotations = false, keepLines = false } = {}) {
    const orig = q.originalLanguage;
    const showOrig = original && orig;
    const raw = showOrig ? orig.text : q.text;
    let text = noOrphans(raw);
    const locked = keepLines && lockedLines && lockedLines.text === text;
    if (locked) text = lockedLines.broken;
    const body = withAnnotations && !showOrig && q.annotations && q.annotations.length
      ? annotate(text, q.annotations) : esc(text);
    const langBtn = orig
      ? `<button class="lang" data-lang aria-pressed="${showOrig ? 'true' : 'false'}" aria-label="${showOrig ? 'Show English' : 'Show original language'}">${showOrig ? 'EN' : esc(LANG_GLYPH[orig.lang] || orig.lang.toUpperCase())}</button>`
      : '';
    const nativeAttr = showOrig ? ` data-native lang="${esc(orig.lang)}"` : '';
    return `${langBtn}<blockquote class="quote${locked ? ' quote--locked' : ''}" data-tier="${tier(raw)}"${nativeAttr}>${body}</blockquote>`;
  }

  /* ---------- Deck ---------- */

  function renderDeck() {
    track.style.transition = 'none';
    track.style.transform = '';
    track.innerHTML = [-1, 0, 1].map((pos) =>
      `<div class="slide" data-pos="${pos}"${pos ? ' aria-hidden="true"' : ''}><div class="q-wrap">${
        quoteHTML(at(pos), { original: pos === 0 && state.original })}</div></div>`).join('');
    const q = current();
    $('number').textContent = `No. ${q.id}`;
    const video = videoOf(q);
    if (video) { const warm = new Image(); warm.src = `https://i.ytimg.com/vi/${video.id}/hq720.jpg`; } // so the notes thumbnail never pops in
    history.replaceState(null, '', `#${q.id}`);
  }

  function go(dir) {
    if (state.animating || modeBusy || langBusy || state.mode !== 'main' || state.list.length < 2) return;
    const advance = () => {
      state.idx = mod(state.idx + dir, state.list.length);
      state.original = false;
      renderDeck();
    };
    if (reduceMotion.matches) return advance();

    state.animating = true;
    const currentWrap = () => track.querySelector('.slide[data-pos="0"] .q-wrap');
    const leaving = buildScraps(currentWrap(), false);
    currentWrap().style.visibility = 'hidden';
    let arriving;
    // Beats 0..GROUPS-1 out, beat GROUPS the swap, beats GROUPS+1..2*GROUPS home.
    for (let g = 0; g < GROUPS; g++) {
      if (g === 0) leaving.pose(0, true); else setTimeout(() => leaving.pose(g, true), beatAt(g));   // out
    }
    setTimeout(() => {                                                                                // swap
      advance();
      arriving = buildScraps(currentWrap(), true);
      currentWrap().style.visibility = 'hidden';
      leaving.dissolve();
    }, beatAt(GROUPS));
    for (let g = 0; g < GROUPS; g++) {
      setTimeout(() => arriving.pose(g, false), beatAt(GROUPS + 1 + g));                             // home
    }
    setTimeout(() => {
      // Hand over from the scraps to the real quote with a dissolve, not a swap: the scraps sit
      // on their words to a fraction of a pixel, but Safari snaps the two to whole pixels
      // differently, and a swap showed as a slight jump at the end of every change.
      currentWrap().style.visibility = '';
      arriving.dissolve();
      state.animating = false;
    }, beatAt(2 * GROUPS) + SCRAP_FADE_MS + 60); // slack: Safari runs the last fade a frame or two late
  }

  // Wheel: exactly one step per gesture. A trackpad swipe is not one event but a stream that
  // keeps coming (inertia) for a second or more, fading unevenly. So:
  //  · a pause of WHEEL_GAP_MS ends the gesture — the next event may step again;
  //  · inside an unbroken stream, step again only for a clear new push: well after the last
  //    step, and several times stronger than the weakest event since then (jitter never is).
  const WHEEL_GAP_MS = 180, WHEEL_MIN = 12, WHEEL_COOLDOWN_MS = 500, WHEEL_PUSH_RATIO = 3, WHEEL_PUSH_MIN = 60;
  const wheel = { lastAt: 0, steppedAt: -Infinity, floor: Infinity };
  deck.addEventListener('wheel', (e) => {
    e.preventDefault();
    const now = performance.now(), abs = Math.abs(e.deltaY);
    const newGesture = now - wheel.lastAt > WHEEL_GAP_MS;
    wheel.lastAt = now;
    if (newGesture) wheel.floor = Infinity;

    const stepped = wheel.steppedAt > -Infinity && !newGesture; // already stepped during this stream
    const freshPush = stepped
      && now - wheel.steppedAt > WHEEL_COOLDOWN_MS
      && abs > Math.max(WHEEL_PUSH_MIN, wheel.floor * WHEEL_PUSH_RATIO);
    wheel.floor = Math.min(wheel.floor, abs);

    if (state.animating || abs < WHEEL_MIN || (stepped && !freshPush)) return;
    wheel.steppedAt = now;
    wheel.floor = abs;
    go(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  // Touch: a swipe (distance or flick) steps to the next quote.
  let touch = null;
  deck.addEventListener('touchstart', (e) => {
    if (state.animating || e.touches.length !== 1 || e.target.closest('button')) return;
    touch = { y: e.touches[0].clientY, t: performance.now(), dy: 0 };
  }, { passive: true });
  deck.addEventListener('touchmove', (e) => {
    if (!touch) return;
    touch.dy = e.touches[0].clientY - touch.y; // the quote does not follow the finger: the change itself is the cut-up
  }, { passive: true });
  const endTouch = () => {
    if (!touch) return;
    const { dy, t } = touch;
    touch = null;
    const velocity = Math.abs(dy) / Math.max(1, performance.now() - t);
    const swiped = state.list.length > 1 && (Math.abs(dy) > deck.clientHeight * 0.12 || (Math.abs(dy) > 24 && velocity > 0.5));
    if (swiped) go(dy < 0 ? 1 : -1);
  };
  deck.addEventListener('touchend', endTouch);
  deck.addEventListener('touchcancel', endTouch);

  $('prevBtn').addEventListener('click', () => go(-1));
  $('nextBtn').addEventListener('click', () => go(1));

  // A mouse click leaves focus on the button, so the next arrow-key press would draw a focus
  // ring around it. Drop focus after pointer clicks; Tab navigation keeps its (quiet) ring.
  document.addEventListener('pointerup', () => {
    const el = document.activeElement;
    if (el && el !== document.body && el.matches('button, a')) el.blur();
  });

  /* ---------- Notes mode ---------- */

  function thumbHTML(video) {
    return `<button class="thumb" data-video data-orientation="${video.orientation}" aria-label="Play video">
      <img src="https://i.ytimg.com/vi/${video.id}/hq720.jpg" onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${video.id}/mqdefault.jpg'" alt="" decoding="sync">
      <span class="thumb-play"><img src="../assets/icons/play.svg" alt=""></span>
    </button>`;
  }

  function renderNotes() {
    const q = current();
    const cats = q.categories.length ? q.categories : ['perspective'];
    // The notes layer and its Close link carry the palette themselves, so the layer can be
    // revealed over the still-grey page.
    app.dataset.theme = notes.dataset.theme = $('notesBtn').dataset.theme = cats[0];

    $('nCats').innerHTML = cats.map((k) =>
      `<li><span class="icon icon-mark"></span><span>${esc(CAT_BY_KEY[k].name)}</span></li>`).join('');

    const a = q.author;
    const country = a.country && regionNames ? regionNames.of(a.country) : '';
    const native = a.nativeName ? ` <span class="n-native">${esc(a.nativeName)}</span>` : '';
    // Row 1 author · row 2 source ("Title, Year") · row 3 country
    let from = `${esc(a.name)}${native}`;
    const src = q.source || {};
    if (src.title) {
      let label = ITALIC_KINDS.has(src.kind) ? `<i>${esc(src.title)}</i>` : esc(src.title);
      if (src.year) label += `, ${esc(src.year)}`;
      const linked = src.link && !youtubeId(src.link);
      from += `<span class="n-source">${linked ? `<a href="${esc(src.link)}" target="_blank" rel="noopener">${label}</a>` : label}</span>`;
    } else {
      from += '<br>';
    }
    if (country) from += esc(country);
    $('nFrom').innerHTML = from;

    renderNotesQuote();

    const video = videoOf(q);
    $('nVideoPin').innerHTML = $('nVideoCol').innerHTML = video ? thumbHTML(video) : '';

    $('nKept').textContent = q.keptBy || 'a fellow human';
    let body = q.reflection ? `<div>${paragraphs(q.reflection)}</div>` : '';
    if (q.context) body += `<div class="n-context"><p>/Context/</p><div>${paragraphs(q.context)}</div></div>`;
    $('nBody').innerHTML = body;
  }

  function renderNotesQuote() {
    const wrap = $('nQuoteWrap');
    wrap.innerHTML = quoteHTML(current(), { original: state.original, withAnnotations: true, keepLines: true });
    // Belt and braces: if a locked line does not fit here after all (it would wrap into an
    // orphan), let the quote wrap naturally rather than show a broken line.
    const locked = wrap.querySelector('.quote--locked');
    if (locked) {
      const wanted = locked.textContent.split('\n').length;
      const got = new Set(measureWords(locked).map((w) => Math.round(w.top))).size;
      if (got !== wanted) wrap.innerHTML = quoteHTML(current(), { original: state.original, withAnnotations: true });
    }
    wrap.classList.toggle('has-lang', !!current().originalLanguage);
    layoutNotes();
  }

  // Desktop/tablet: the quote is pinned, so the notes column starts a fixed distance below it.
  function layoutNotes() {
    if (state.mode !== 'notes') return;
    const col = $('nCol');
    if (mqMobile.matches) { col.style.marginTop = ''; return; }
    const wrap = $('nQuoteWrap');
    col.style.marginTop = `${wrap.offsetTop + wrap.offsetHeight}px`; // the gap below is --notes-quote-gap
  }

  let scrollIdle, pinBlur = -1;
  notes.addEventListener('scroll', () => {
    app.classList.toggle('is-scrolled', notes.scrollTop > 2); // the mobile top fade only exists once something can slide under it
    // Blur in half-pixel steps, and only touch the style when the step changes: a blur filter is
    // re-rasterized whenever its value changes, and once the cap is reached (200px down) nothing
    // needs to change at all. Keeps the glide cheap on weaker (integrated) GPUs.
    const blur = Math.round(Math.min(25, notes.scrollTop / 8) * 2) / 2;
    if (blur !== pinBlur) {
      pinBlur = blur;
      $('nPin').style.setProperty('--pin-blur', `${blur}px`);
      $('nPin').classList.toggle('is-blurred', blur > 0);
      $('nPin').style.pointerEvents = blur > 4 && !mqMobile.matches ? 'none' : ''; // phone: nothing is pinned or blurred, and the thumbnail lives in here
    }
    notes.classList.add('is-scrolling');
    clearTimeout(scrollIdle);
    scrollIdle = setTimeout(() => notes.classList.remove('is-scrolling'), 150);
  }, { passive: true });

  /* Dada cut-up (Figma 236:4851) — used when moving from one quote to the next.
     The quote is snipped into 1–2 word scraps. Stop-motion: the scraps are dealt into three
     random groups that jump OUT one beat apart and scatter over the screen (some cropped by the
     edge); one beat later the words swap to the next quote, already scattered; then its groups
     jump HOME one beat apart and the new quote is whole. */
  const GROUPS = 3;
  const CUT_MS = 300;           // the whole cut-up, first jump to last (6 gaps of 50ms at the default)
  const CUT_SLOWMO = 1;         // beat spacing: 1 = even; higher = faster ends, longer hold in the middle
                                // (tried 2.2 over 700ms: a held beat reads as a freeze/lag, not slow-mo, since nothing moves between jumps)
  function beatAt(n) {
    const x = n / (2 * GROUPS), p = CUT_SLOWMO;
    const f = x < 0.5 ? 0.5 * Math.pow(2 * x, p) : 1 - 0.5 * Math.pow(2 * (1 - x), p);
    return Math.round(CUT_MS * f);
  }
  const SCRAP_FADE_MS = 100;    // softness of each jump — characters only; the page still cuts
  const SCRAP_SCALE = 1.15;     // scattered scraps are only slightly larger than the landed quote
  const SCRAP_GAP = 14;         // breathing room kept between scraps (px)
  let modeBusy = false;

  // Measure every word of the rendered quote (each CJK character counts as a word).
  function measureWords(quoteEl) {
    const words = [];
    const walker = document.createTreeWalker(quoteEl, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let node;
    while ((node = walker.nextNode())) {
      const re = /\S+/g;
      let m;
      while ((m = re.exec(node.data))) {
        let parts = CJK_CHAR.test(m[0])
          ? [...m[0]].map((ch, k) => ({ text: ch, start: m.index + k, cjk: true }))
          : [{ text: m[0], start: m.index, cjk: false }];
        // A hyphenated word may be broken across lines at a hyphen ("twenty-" / "first"): then
        // each part is its own word, on its own line. (Measured as one, the word would be put
        // on the first line whole, and every line after would be recorded wrong.)
        parts = parts.flatMap((p) => {
          if (p.cjk || !/-./.test(p.text)) return [p];
          range.setStart(node, p.start);
          range.setEnd(node, p.start + p.text.length);
          if (range.getClientRects().length < 2) return [p];
          let at = 0;
          return p.text.split(/(?<=-)/).map((piece) => { const part = { text: piece, start: p.start + at, cjk: false }; at += piece.length; return part; });
        });
        parts.forEach((p) => {
          range.setStart(node, p.start);
          range.setEnd(node, p.start + p.text.length);
          const r = range.getClientRects()[0];
          if (r) words.push({ text: p.text, cjk: p.cjk, left: r.left, top: r.top, right: r.right, node, start: p.start, end: p.start + p.text.length });
        });
      }
    }
    return words;
  }

  // Snip into scraps of 1–2 words (2–4 CJK characters), never across a line break.
  function cutScraps(words) {
    const scraps = [];
    let i = 0;
    while (i < words.length) {
      const first = words[i];
      const want = first.cjk ? 2 + Math.floor(Math.random() * 3) : 1 + Math.floor(Math.random() * 2);
      const group = [first];
      while (group.length < want && words[i + group.length] && Math.abs(words[i + group.length].top - first.top) < 4) {
        group.push(words[i + group.length]);
      }
      i += group.length;
      scraps.push({ text: group.map((w) => w.text).join(first.cjk ? '' : ' '), left: first.left, top: first.top });
    }
    return scraps;
  }

  // Build the scrap layer for the quote inside `wrap`. Scraps start at home (exactly on their
  // words) or, with startOut, already scattered. pose(group, out) jumps one group.
  function buildScraps(wrap, startOut) {
    const quoteEl = wrap.querySelector('.quote');
    const scraps = cutScraps(measureWords(quoteEl));
    const cs = getComputedStyle(quoteEl);
    const layer = document.createElement('div');
    layer.className = 'dada';
    layer.setAttribute('aria-hidden', 'true');
    Object.assign(layer.style, {
      fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontStyle: cs.fontStyle,
      lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing,
    });
    app.appendChild(layer);

    const vw = window.innerWidth, vh = window.innerHeight, range = document.createRange();
    const pieces = scraps.map((scrap) => {
      const el = document.createElement('span');
      el.className = 'dada-scrap';
      el.textContent = scrap.text;
      el.style.left = `${scrap.left}px`;
      el.style.top = `${scrap.top}px`;
      layer.appendChild(el);
      // Line boxes and glyph boxes differ; nudge so the scrap's glyphs sit exactly on the word.
      range.selectNodeContents(el);
      const own = range.getClientRects()[0];
      if (own) { el.style.left = `${2 * scrap.left - own.left}px`; el.style.top = `${2 * scrap.top - own.top}px`; }
      return { el, scrap, w: el.offsetWidth * SCRAP_SCALE, h: el.offsetHeight * SCRAP_SCALE };
    });

    // Scatter: spread over the whole screen — and a little past its edges, so some scraps get
    // cropped — without landing on each other or on the text already on the page.
    const taken = [...app.querySelectorAll('.chrome, .n-cats li, .n-from, .n-kept, .n-body, .thumb')]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width && r.height && r.top < vh && r.bottom > 0);
    const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left) + SCRAP_GAP)
      * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) + SCRAP_GAP);
    pieces.forEach((p) => {
      let best = null;
      for (let attempt = 0; attempt < 60; attempt++) {
        const left = -0.35 * p.w + Math.random() * (vw - 0.3 * p.w);
        const top = -0.25 * p.h + Math.random() * (vh - 0.5 * p.h);
        const box = { left, top, right: left + p.w, bottom: top + p.h };
        const cost = taken.reduce((sum, r) => sum + overlap(box, r), 0);
        if (!best || cost < best.cost) best = { box, cost };
        if (cost === 0) break;
      }
      taken.push(best.box);
      p.out = `translate(${best.box.left - p.scrap.left}px, ${best.box.top - p.scrap.top}px) scale(${SCRAP_SCALE})`;
    });

    // Deal the scraps into groups at random (as evenly as possible).
    const order = pieces.map((_, i) => i).sort(() => Math.random() - 0.5);
    order.forEach((pieceIndex, n) => { pieces[pieceIndex].group = n % GROUPS; });

    // A jump is still a jump — position changes in one frame — but the characters soften it:
    // the scrap dissolves out of its old spot while it dissolves into the new one.
    const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease').trim() || 'ease';
    const fade = (el, from, to) => el.animate([{ opacity: from }, { opacity: to }], { duration: SCRAP_FADE_MS, easing, fill: 'forwards' });
    // A scrap that has finished fading in goes back to being plain text: while the (filled)
    // animation is attached, Safari keeps the scrap on a composited layer and shows a reused,
    // scaled, clipped raster of it — lighter and softer than the real quote, which then
    // "snapped" crisp at the handover. Cancelling the finished animation drops the layer.
    const settle = (el) => setTimeout(() => { el.getAnimations().forEach((a) => a.cancel()); el.style.opacity = ''; }, SCRAP_FADE_MS + 30);
    const fadeIn = (el) => { fade(el, 0, 1); settle(el); };
    const pose = (group, out) => pieces.forEach((p) => {
      if (p.group !== group) return;
      const ghost = p.el.cloneNode(true);
      ghost.getAnimations?.().forEach((a) => a.cancel());
      layer.appendChild(ghost);
      fade(ghost, 1, 0);
      setTimeout(() => ghost.remove(), SCRAP_FADE_MS + 30); // timers, not onfinish: animations stall in hidden tabs
      p.el.style.transform = out ? p.out : 'none';
      fadeIn(p.el);
    });
    if (startOut) pieces.forEach((p) => { p.el.style.transform = p.out; fadeIn(p.el); });
    const dissolve = () => { fade(layer, 1, 0); setTimeout(() => layer.remove(), SCRAP_FADE_MS + 30); };
    return { layer, pose, dissolve };
  }

  // Put the page in a mode, instantly (the transition around it lives in setMode).
  function applyMode(mode) {
    state.mode = mode;
    app.dataset.mode = mode;
    const inNotes = mode === 'notes';
    $('notesBtn').textContent = inNotes ? 'Close' : 'Notes';
    notes.hidden = !inNotes;
    if (inNotes) {
      renderNotes();
      notes.scrollTop = 0;
      dropGlide();
      app.classList.remove('is-scrolled');
      $('nPin').style.setProperty('--pin-blur', '0px');
      $('nPin').classList.remove('is-blurred');
      pinBlur = 0;
      layoutNotes();
    } else {
      app.classList.remove('is-scrolled');
      delete app.dataset.theme;
      delete notes.dataset.theme;
      delete $('notesBtn').dataset.theme;
      lean.x = lean.y = lean.tx = lean.ty = 0;
      closeOverlays({ instant: true });
      renderDeck(); // keeps the language toggle in sync
    }
  }

  // Progress (0–1) of a cubic-bezier curve at a given time (0–1).
  function easeProgressAt(time, curve) {
    const m = /cubic-bezier\(([^)]+)\)/.exec(curve);
    const [x1, y1, x2, y2] = m ? m[1].split(',').map(Number) : [0.25, 0.1, 0.25, 1];
    const bez = (a, b, t) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
    let lo = 0, hi = 1;
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (bez(x1, x2, mid) < time) lo = mid; else hi = mid; }
    return bez(y1, y2, (lo + hi) / 2);
  }

  // When (0–1 of the duration) does the site's easing curve reach a given progress (0–1)?
  function easeTimeFor(progress, curve) {
    const m = /cubic-bezier\(([^)]+)\)/.exec(curve);
    const [x1, y1, x2, y2] = m ? m[1].split(',').map(Number) : [0.25, 0.1, 0.25, 1];
    const bez = (a, b, t) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
    let lo = 0, hi = 1; // the curve parameter at which y = progress (y rises monotonically here)
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (bez(y1, y2, mid) < progress) lo = mid; else hi = mid; }
    return bez(x1, x2, (lo + hi) / 2);
  }

  /* Entering notes only — "scanning" the page into notes mode as the dropping edge passes.
     One rule for the whole page: the further DOWN the screen an item sits, the harder the scan
     hits it. At the top of the viewport an item is barely stretched and its colors barely part;
     at the bottom it is stretched the most and its colors part the most. Every item:
       · is stretched vertically from its TOP edge (its bottom pulls back up to true size);
       · has its colors split — red trailing below green, blue below red, softly blurred —
         recovering in three hard steps.
       · is left with a soft patch of palette color behind it as the edge passes, fading after.
     The dropping edge itself carries a band that blurs the content it passes over (.scan-edge).
     and the video preview and the notes column also rise RISE_PX into place. */
  const RISE_PX = 80, RISE_MS = 400;
  const SCAN_STRETCH_TOP = 1.1, SCAN_STRETCH_BOTTOM = 2.4, SCAN_STRETCH_MS = 420; // top → bottom of the viewport
  const SCAN_STRETCH_QUOTE = 2;      // the quote is the exception to the ramp: its own, more dramatic, stretch
  const SCAN_RGB_IMAGE_BOOST = 3;    // the video preview's split, relative to text at the same depth
  const SCAN_RGB_TOP = 0.8, SCAN_RGB_BOTTOM = 6;     // red's trail in px (blue trails twice as far)
  const SCAN_GLOW_TOP = 10, SCAN_GLOW_BOTTOM = 34, SCAN_GLOW_MS = 900; // afterglow patch padding (px) and fade
  const SCAN_STEP_MS = 90;                           // each of the three RGB strengths holds this long
  const lerp = (a, b, t) => a + (b - a) * t;

  // RGB split for the IMAGE only: SVG filters, built on demand (native, no library). Text gets its
  // split from colored text-shadows instead — SVG filters are rasterized on the CPU and were the
  // main cause of the scan stuttering.
  const rgbFilterCache = new Map();
  function rgbFilters(redTrail) {
    const key = Math.round(redTrail * 2) / 2; // half-pixel buckets keep the count small
    if (rgbFilterCache.has(key)) return rgbFilterCache.get(key);
    const ids = [1, 0.6, 0.3].map((k, i) => {
      const d = key * k, blur = Math.max(0.3, d * 0.28), id = `rgb-${String(key).replace('.', '_')}-${i}`;
      $('rgbDefs').insertAdjacentHTML('beforeend', `
        <filter id="${id}" x="-2%" y="-2%" width="104%" height="${104 + Math.ceil(key * 1.2)}%" color-interpolation-filters="sRGB">
          <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>
          <feOffset in="r" dy="${d}" result="r1"/><feGaussianBlur in="r1" stdDeviation="${blur}" result="r2"/>
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/>
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/>
          <feOffset in="b" dy="${2 * d}" result="b1"/><feGaussianBlur in="b1" stdDeviation="${blur * 1.4}" result="b2"/>
          <feBlend in="r2" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b2" mode="screen"/>
        </filter>`);
      return id;
    });
    rgbFilterCache.set(key, ids);
    return ids;
  }

  // The quote's stretch is played line by line. A stand-in is laid exactly over the real quote,
  // one block per visual line; the real quote sits out the scan. Every line starts where the
  // stretched quote would put it and travels back up — all setting off together, the first line
  // arriving soonest and each following line a little later, so the quote closes up like a blind.
  const SCAN_LINE_FIRST_MS = 380, SCAN_LINE_LAST_MS = 520;
  function scanQuoteLines(quoteEl, at, wide, tall, easing) {
    const words = measureWords(quoteEl);
    const lines = [];
    words.forEach((w) => {
      const line = lines[lines.length - 1];
      if (line && Math.abs(line.top - w.top) < 4) line.words.push(w); else lines.push({ top: w.top, words: [w] });
    });
    const standIn = quoteEl.cloneNode(false); // same classes/attributes → same type, size, color
    standIn.classList.add('quote-lines');
    Object.assign(standIn.style, {
      left: `${quoteEl.offsetLeft}px`, top: `${quoteEl.offsetTop}px`,
      width: `${quoteEl.offsetWidth}px`, height: `${quoteEl.offsetHeight}px`,
    });
    quoteEl.after(standIn);
    const range = document.createRange();
    const last = Math.max(1, lines.length - 1);
    let longest = 0;
    lines.forEach((line, i) => {
      const el = document.createElement('span');
      el.className = 'quote-line';
      // The line's text is read straight out of the real quote (first word → last word), so its
      // spacing is exact. Re-joining the words with spaces is wrong wherever an underlined phrase
      // meets punctuation — "undertakings" + "." are two text runs with no space between them.
      const firstWord = line.words[0], lastWord = line.words[line.words.length - 1];
      range.setStart(firstWord.node, firstWord.start);
      range.setEnd(lastWord.node, lastWord.end);
      el.textContent = range.toString().replace(/\n/g, '');
      standIn.appendChild(el);
      // Put the line's first glyph exactly on the real line's first glyph (measured both ways),
      // whatever the real line box happens to be.
      range.selectNodeContents(el);
      const own = range.getClientRects()[0] || el.getBoundingClientRect();
      const first = line.words[0];
      el.style.left = `${first.left - own.left}px`;
      el.style.top = `${first.top - own.top}px`;
      const drop = (first.top - lines[0].top) * (tall - 1); // where the stretched quote would put this line
      const duration = Math.round(lerp(SCAN_LINE_FIRST_MS, SCAN_LINE_LAST_MS, i / last));
      longest = Math.max(longest, duration);
      el.animate(
        [{ transform: `translateY(${drop.toFixed(1)}px) scale(${wide}, ${tall})` }, { transform: 'translateY(0) scale(1, 1)' }],
        { duration, delay: at, easing, fill: 'backwards' },
      );
    });
    quoteEl.style.visibility = 'hidden';
    setTimeout(() => {
      standIn.remove();
      quoteEl.style.visibility = '';
      animateDashes(quoteEl, true); // the underlines draw in once the sentence is in position
    }, at + longest + 30);
    return { standIn, ends: at + longest + 30 };
  }

  function scanIn(dropCurve, mainQuoteSize) {
    const vh = window.innerHeight, easing = easeCurve();
    document.querySelectorAll('.scan-glows').forEach((el) => el.remove());
    const glowLayer = document.createElement('div');
    glowLayer.className = 'scan-glows';
    notes.prepend(glowLayer);

    // Measure everything first (final positions), then start moving things.
    const measure = (el) => {
      const top = el.getBoundingClientRect().top;
      if (top >= vh) return null; // below the screen: the edge never reaches it
      const depth = Math.max(0, top) / vh; // 0 at the top of the viewport … 1 at the bottom
      return { el, depth, at: Math.round(easeTimeFor(depth, dropCurve) * REVEAL_MS) };
    };
    const risers = [$('nVideoPin'), $('nCol')].map((el) => {
      const probe = el.id === 'nVideoPin' ? el.querySelector('.thumb') : el;
      const m = probe && measure(probe);
      return m ? { el, at: m.at } : null;
    }).filter(Boolean);
    const items = [
      ...document.querySelectorAll('#nCats li'), notes.querySelector('.n-from'),
      notes.querySelector('#nVideoPin .thumb'), notes.querySelector('#nVideoCol .thumb'),
      notes.querySelector('#nQuoteWrap .quote'),
      notes.querySelector('.n-kept'), ...document.querySelectorAll('#nBody p'),
    ].filter((el) => el && el.offsetParent !== null).map(measure).filter(Boolean);

    risers.forEach(({ el, at }) => el.animate(
      [{ transform: `translateY(${RISE_PX}px)` }, { transform: 'translateY(0)' }],
      { duration: RISE_MS, delay: at, easing, fill: 'backwards' },
    ));

    let ends = Math.max(0, ...risers.map((r) => r.at + RISE_MS));
    items.forEach(({ el, depth, at }) => {
      const isThumb = el.classList.contains('thumb'), isQuote = el.classList.contains('quote');

      // Stretch, always from the item's top edge. (Set as a real style: an origin given only
      // inside the keyframes is not reliably honoured, which made the quote stretch from its middle.)
      let shadowTarget = el; // where the text's color split is drawn
      if (isQuote) {
        // The quote also starts at the width it had on the main screen and draws in to the left.
        const wide = Math.max(1, mainQuoteSize / parseFloat(getComputedStyle(el).fontSize));
        const lines = scanQuoteLines(el, at, wide, SCAN_STRETCH_QUOTE, easing);
        shadowTarget = lines.standIn;
        ends = Math.max(ends, lines.ends);
      } else if (!isThumb) { // the preview keeps its own transforms (hover, pointer-lean)
        const tall = lerp(SCAN_STRETCH_TOP, SCAN_STRETCH_BOTTOM, depth);
        el.style.transformOrigin = '50% 0';
        el.animate([{ transform: `scale(1, ${tall})` }, { transform: 'scale(1, 1)' }],
          { duration: SCAN_STRETCH_MS, delay: at, easing, fill: 'backwards' });
        setTimeout(() => { el.style.transformOrigin = ''; }, at + SCAN_STRETCH_MS + 40);
      }

      // Color split, three hard steps down to clean: red trails below the text, blue below red,
      // both slightly soft. Text: colored shadows (cheap). Image: an SVG channel split.
      const trail = lerp(SCAN_RGB_TOP, SCAN_RGB_BOTTOM, depth);
      if (isThumb) {
        const ids = rgbFilters(trail * SCAN_RGB_IMAGE_BOOST); // an image reads a split far more quietly than type does
        [...ids, null].forEach((id, i) => setTimeout(() => { el.style.filter = id ? `url(#${id})` : ''; }, at + i * SCAN_STEP_MS));
      } else {
        [1, 0.6, 0.3, 0].forEach((k, i) => setTimeout(() => {
          const d = trail * k;
          shadowTarget.style.textShadow = k
            ? `0 ${d.toFixed(2)}px ${(d * 0.3).toFixed(2)}px rgba(255, 45, 70, 0.85), 0 ${(2 * d).toFixed(2)}px ${(d * 0.45).toFixed(2)}px rgba(70, 95, 255, 0.85)`
            : '';
        }, at + i * SCAN_STEP_MS));
      }

      // Afterglow: a soft patch of the palette color behind the item, lit as the edge passes and
      // fading after it. Only its opacity animates, so it costs almost nothing to draw.
      const box = el.getBoundingClientRect();
      const pad = lerp(SCAN_GLOW_TOP, SCAN_GLOW_BOTTOM, depth) * 2;
      const patch = document.createElement('i');
      patch.className = 'scan-glow';
      Object.assign(patch.style, {
        left: `${box.left - pad}px`, top: `${box.top - pad}px`,
        width: `${box.width + 2 * pad}px`, height: `${box.height + 2 * pad}px`,
      });
      glowLayer.appendChild(patch);
      patch.animate([{ opacity: lerp(0.35, 0.7, depth) }, { opacity: 0 }],
        { duration: SCAN_GLOW_MS, delay: at, easing: 'ease-out', fill: 'both' });

      ends = Math.max(ends, at + Math.max(SCAN_STRETCH_MS, 4 * SCAN_STEP_MS, SCAN_GLOW_MS));
    });
    setTimeout(() => glowLayer.remove(), ends + 60);
    return ends;
  }

  /* Changing mode, either way: a backdrop drops from the top edge to the bottom over REVEAL_MS.
     Entering, the finished notes frame is cropped into view over the grey page (and scanned —
     see scanIn). Leaving, the notes frame is cropped away from the top, uncovering the finished
     grey page with no effects; only the quote moves, easing back to its main size and spot. */
  const REVEAL_MS = 600;
  const SCAN_BAND_LAG_MS = 120; // the blur band reaches back to where the edge was this long ago…
  const SCAN_BAND_MAX = 200;    // …but never taller than this (keep in step with .scan-edge in app.css)
  const EXIT_TRAVEL_MS = 400;   // leaving: the quote's ease back to its main size and spot

  function setMode(mode) {
    if (modeBusy || langBusy || state.animating || mode === state.mode) return;
    if (reduceMotion.matches) return applyMode(mode);
    modeBusy = true;
    const toNotes = mode === 'notes';
    const mainWrap = () => track.querySelector('.slide[data-pos="0"] .q-wrap');
    const dropCurve = getComputedStyle(document.documentElement).getPropertyValue('--ease-drop').trim() || easeCurve();

    const fromEl = (toNotes ? mainWrap() : $('nQuoteWrap')).querySelector('.quote');
    const from = fromEl.getBoundingClientRect();
    const fromSize = parseFloat(getComputedStyle(fromEl).fontSize);

    let scanEnds = 0;
    if (toNotes) {
      lockLines(fromEl);
      applyMode('notes');
      scanEnds = scanIn(dropCurve, fromSize);
    } else {
      // The grey page has to be complete before it is uncovered.
      closeOverlays({ instant: true });
      renderDeck();
      $('notesBtn').textContent = 'Notes';
      delete $('notesBtn').dataset.theme;
    }
    document.querySelectorAll('.scan-edge, .quote-float-layer').forEach((el) => el.remove());
    app.classList.add('is-revealing'); // grey page underneath, notes frame (own palette) on top
    // The crop is driven here, frame by frame, as a plain inline style. (A
    // browser-run clip-path animation can show the layer uncropped for a frame when it starts
    // or is handed back — that was the flash.) The start state is in place before first paint.
    const cropAt = (e, t = 0) => {
      const rest = `${((1 - e) * 100).toFixed(3)}%`;
      notes.style.clipPath = toNotes ? `inset(0 0 ${rest} 0)` : `inset(${(e * 100).toFixed(3)}% 0 0 0)`;
      if (layer) layer.style.clipPath = `inset(0 0 ${rest} 0)`; // the travelling quote: only above the edge
      if (scanEdge) {
        scanEdge.style.transform = `translateY(${(e * window.innerHeight).toFixed(1)}px)`;
        // The blur band trails the edge: it spans from where the edge was SCAN_BAND_LAG_MS ago
        // to where it is now. So content stays blurred for that long after the edge passes it —
        // long enough to see, however fast the drop is — and the band closes to nothing by
        // itself as the edge slows into the bottom of the viewport.
        const past = easeProgressAt(Math.max(0, t - SCAN_BAND_LAG_MS / REVEAL_MS), dropCurve);
        const band = Math.min(SCAN_BAND_MAX, (e - past) * window.innerHeight, (1 - e) * window.innerHeight * 4); // fully closed on landing
        scanEdge.style.setProperty('--band', (band / SCAN_BAND_MAX).toFixed(4));
        // (No opacity fade on this element: anything below opacity 1 would switch the blur off.)
        if (e >= 1) scanEdge.style.visibility = 'hidden';
      }
    };
    // Entering: a band of light rides the dropping edge, like a scanner head.
    let scanEdge = null;
    if (toNotes) {
      scanEdge = document.createElement('div');
      scanEdge.className = 'scan-edge';
      scanEdge.dataset.theme = app.dataset.theme;
      app.appendChild(scanEdge);
    }
    let dropFrame = 0, layer = null;
    const dropStart = performance.now();
    const dropTick = (now) => {
      const t = Math.min(1, (now - dropStart) / REVEAL_MS);
      cropAt(easeProgressAt(t, dropCurve), t);
      dropFrame = t < 1 ? requestAnimationFrame(dropTick) : 0;
    };

    // Entering: the quote belongs to the notes frame and is cut in by the crop (and scanned).
    // Leaving: no effects at all — the quote just eases from its notes size and spot to its
    // main ones. It rides a layer above the drop, cropped by the same edge so the black quote
    // only ever shows over the grey page; the real main quote sits out the trip.
    if (!toNotes) {
      const wrap = mainWrap();
      const real = wrap.querySelector('.quote');
      const to = real.getBoundingClientRect(), cs = getComputedStyle(real);
      layer = document.createElement('div');
      layer.className = 'quote-float-layer';
      const float = document.createElement('div');
      float.className = 'quote-float';
      Object.assign(float.style, { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px` });
      const copy = real.cloneNode(true);
      Object.assign(copy.style, { fontSize: cs.fontSize, width: '100%', maxWidth: 'none' });
      float.appendChild(copy);
      layer.appendChild(float);
      app.appendChild(layer);
      wrap.style.visibility = 'hidden';

      // Start posed exactly on the notes quote, set off when the edge reaches it.
      const lift = Math.round(easeTimeFor(Math.min(1, Math.max(0, from.top / window.innerHeight)), dropCurve) * REVEAL_MS);
      float.style.transformOrigin = '0 0';
      float.style.scale = fromSize / parseFloat(cs.fontSize);
      float.style.translate = `${from.left - to.left}px ${from.top - to.top}px`;
      float.getBoundingClientRect(); // commit the start pose
      float.style.transition = `translate ${EXIT_TRAVEL_MS}ms var(--ease) ${lift}ms, scale ${EXIT_TRAVEL_MS}ms var(--ease) ${lift}ms`;
      float.style.translate = '0px 0px';
      float.style.scale = 1;
      scanEnds = lift + EXIT_TRAVEL_MS;
    }
    cropAt(0);
    dropFrame = requestAnimationFrame(dropTick);

    setTimeout(() => {
      if (layer) layer.remove();
      if (!toNotes) applyMode('main'); // re-renders the grey page's quote, visible again
      cancelAnimationFrame(dropFrame);
      if (scanEdge) scanEdge.remove();
      notes.style.clipPath = '';
      app.classList.remove('is-revealing');
      modeBusy = false;
    }, Math.max(REVEAL_MS, scanEnds) + 20);
  }

  $('notesBtn').addEventListener('click', () => setMode(state.mode === 'notes' ? 'main' : 'notes'));

  /* ---------- Notes: smooth (eased) wheel scrolling ----------
     Wheel and trackpad input does not move the notes directly: it moves a target, and the page
     glides after it, covering SCROLL_EASE of the remaining distance every frame. Touch keeps the
     device's own momentum scrolling; keyboard, scrollbar and anything else stay native. */
  const SCROLL_EASE = 0.11;   // lower = longer, silkier glide; higher = tighter
  const glide = { pos: 0, target: 0, raf: 0 };

  function glideStep() {
    const gap = glide.target - glide.pos;
    if (Math.abs(gap) < 0.4) {
      glide.pos = glide.target;
      notes.scrollTop = glide.pos;
      glide.raf = 0;
      return;
    }
    glide.pos += gap * SCROLL_EASE; // kept as a fraction: scrollTop itself rounds to whole pixels
    notes.scrollTop = glide.pos;
    glide.raf = requestAnimationFrame(glideStep);
  }

  notes.addEventListener('wheel', (e) => {
    if (reduceMotion.matches || e.ctrlKey || app.classList.contains('is-dim')) return; // ctrl+wheel = pinch zoom
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? notes.clientHeight : 1; // lines / pages → px
    if (!glide.raf) glide.pos = glide.target = notes.scrollTop;
    const max = notes.scrollHeight - notes.clientHeight;
    glide.target = Math.max(0, Math.min(max, glide.target + e.deltaY * unit));
    if (!glide.raf) glide.raf = requestAnimationFrame(glideStep);
  }, { passive: false });

  // Any other kind of scrolling (keys, scrollbar, touch, entering notes) takes over cleanly.
  const dropGlide = () => { cancelAnimationFrame(glide.raf); glide.raf = 0; glide.pos = glide.target = notes.scrollTop; };
  ['touchstart', 'mousedown'].forEach((type) => notes.addEventListener(type, dropGlide, { passive: true }));
  window.addEventListener('keydown', dropGlide);

  /* ---------- Notes: the video preview leans toward the pointer (desktop only) ---------- */
  const LEAN_X = 14, LEAN_Y = 10;   // furthest the preview drifts, in px
  const LEAN_EASE = 0.07;           // how lazily it follows (lower = floatier)
  const lean = { x: 0, y: 0, tx: 0, ty: 0, raf: 0 };

  function leanStep() {
    lean.x += (lean.tx - lean.x) * LEAN_EASE;
    lean.y += (lean.ty - lean.y) * LEAN_EASE;
    const settled = Math.abs(lean.tx - lean.x) < 0.05 && Math.abs(lean.ty - lean.y) < 0.05;
    const thumb = document.querySelector('#nVideoPin .thumb');
    if (thumb && state.mode === 'notes') thumb.style.translate = `${lean.x.toFixed(2)}px ${lean.y.toFixed(2)}px`;
    lean.raf = settled ? 0 : requestAnimationFrame(leanStep);
  }

  function leanTo(tx, ty) {
    lean.tx = tx; lean.ty = ty;
    if (!lean.raf) lean.raf = requestAnimationFrame(leanStep);
  }

  notes.addEventListener('mousemove', (e) => {
    if (!mqHoverDesktop.matches || reduceMotion.matches || app.classList.contains('is-dim')) return;
    leanTo((e.clientX / window.innerWidth - 0.5) * 2 * LEAN_X, (e.clientY / window.innerHeight - 0.5) * 2 * LEAN_Y);
  });
  notes.addEventListener('mouseleave', () => leanTo(0, 0));

  /* ---------- Annotation dashes ----------
     The dashed underlines draw in left to right — all within the same beat, each one starting
     DASH_STAGGER_MS after the one above it — and wipe away left to right before a translation. */
  const DASH_IN_MS = 300, DASH_OUT_MS = 100, DASH_STAGGER_MS = 50;

  function animateDashes(scope, show) {
    const anns = [...scope.querySelectorAll('.ann')];
    const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease').trim() || 'ease';
    anns.forEach((el, i) => {
      el.getAnimations().forEach((anim) => anim.cancel()); // one dash animation at a time
      const thickness = getComputedStyle(el).backgroundSize.split(' ')[1] || '1px';
      const side = show ? 'left' : 'right'; // wiping away left→right means the line shrinks toward the right
      const pos = `${side} bottom 0.08em`;
      const none = { backgroundPosition: pos, backgroundSize: `0% ${thickness}` };
      const full = { backgroundPosition: pos, backgroundSize: `100% ${thickness}` };
      el.animate(show ? [none, full] : [full, none], {
        duration: show ? DASH_IN_MS : DASH_OUT_MS, delay: show ? i * DASH_STAGGER_MS : 0, easing, fill: 'both',
      });
    });
    return anns.length;
  }

  /* ---------- Language toggle: typewriter ----------
     Both languages move at once, left to right, inside LANG_MS: each character of the current
     text blurs out while each character of the other language blurs in over the same spot.
     The 中 / EN button hides for the duration. */
  const LANG_MS = 400;        // the whole paragraph, start to finish
  const LANG_CHAR_MS = 160;   // one character's blur in / blur out
  const LANG_BLUR = 8;        // px
  let langBusy = false;

  // Wrap every visible character of the quote in a span (keeps annotation buttons intact).
  function spanify(quoteEl) {
    const chars = [];
    const walker = document.createTreeWalker(quoteEl, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const frag = document.createDocumentFragment();
      [...node.data].forEach((ch) => {
        if (/\s/.test(ch)) { frag.appendChild(document.createTextNode(ch)); return; }
        const span = document.createElement('span');
        span.textContent = ch;
        frag.appendChild(span);
        chars.push(span);
      });
      node.replaceWith(frag);
    });
    return chars;
  }

  // Stagger the characters left to right so the last one finishes exactly at LANG_MS.
  function sweep(chars, show) {
    const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease').trim() || 'ease';
    const clear = { opacity: 1, filter: 'blur(0px)' }, gone = { opacity: 0, filter: `blur(${LANG_BLUR}px)` };
    const span = Math.max(0, LANG_MS - LANG_CHAR_MS);
    chars.forEach((c, i) => {
      c.animate(show ? [gone, clear] : [clear, gone], {
        duration: LANG_CHAR_MS, delay: chars.length > 1 ? (i / (chars.length - 1)) * span : 0, easing, fill: 'both',
      });
    });
  }

  function toggleLanguage() {
    if (langBusy || modeBusy || state.animating) return;
    const inNotes = state.mode === 'notes';
    const render = () => (inNotes ? renderNotesQuote() : renderDeck());
    state.original = !state.original;
    if (reduceMotion.matches) return render();

    langBusy = true;
    const wrap = inNotes ? $('nQuoteWrap') : track.querySelector('.slide[data-pos="0"] .q-wrap');
    wrap.classList.add('is-wiping'); // hides the button now; the dashes still need to be seen leaving
    // Underlines leave first (if this language has any), then the paragraph changes.
    const hadDashes = inNotes && animateDashes(wrap, false) > 0;
    setTimeout(() => swapLanguage(wrap, inNotes, render), hadDashes ? DASH_OUT_MS : 0);
  }

  function swapLanguage(wrap, inNotes, render) {
    // The outgoing text becomes a ghost laid exactly over its old spot…
    const old = wrap.querySelector('.quote');
    const before = { top: old.getBoundingClientRect().top, height: wrap.offsetHeight };
    const ghost = old.cloneNode(true);
    ghost.classList.add('quote-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    Object.assign(ghost.style, { left: `${old.offsetLeft}px`, top: `${old.offsetTop}px`, width: `${old.offsetWidth}px` });
    // …while the incoming text takes its real place underneath.
    wrap.innerHTML = quoteHTML(current(), { original: state.original, withAnnotations: inNotes });
    wrap.appendChild(ghost);
    wrap.classList.add('is-typing');

    // The two languages rarely take the same number of lines. Nothing should jump: the block
    // glides to its new resting place and whatever sits below it follows, over the same LANG_MS.
    const glide = `${LANG_MS}ms var(--ease)`;
    const col = $('nCol');
    if (inNotes) {
      if (mqMobile.matches) {
        // Mobile: the quote is in the flow, so ease its height and everything below follows.
        const after = wrap.offsetHeight;
        wrap.style.height = `${before.height}px`;
        wrap.getBoundingClientRect();
        wrap.style.transition = `height ${glide}`;
        wrap.style.height = `${after}px`;
      } else {
        // Desktop/tablet: the quote is pinned; the notes column eases to its new start.
        col.style.transition = `margin-top ${glide}`;
        layoutNotes();
      }
    } else {
      // Main: the quote is centred on its own height, so a new height moves its top edge (FLIP).
      const shift = before.top - wrap.querySelector('.quote:not(.quote-ghost)').getBoundingClientRect().top;
      wrap.style.transition = 'none';
      wrap.style.translate = `0px ${shift}px`;
      wrap.getBoundingClientRect();
      wrap.style.transition = `translate ${glide}`;
      wrap.style.translate = '0px 0px';
    }
    sweep(spanify(ghost), false);
    sweep(spanify(wrap.querySelector('.quote:not(.quote-ghost)')), true);
    setTimeout(() => {
      wrap.classList.remove('is-typing', 'is-wiping');
      wrap.style.transition = wrap.style.translate = wrap.style.height = '';
      col.style.transition = '';
      render(); // back to the plain markup, button included
      if (inNotes) animateDashes($('nQuoteWrap'), true); // underlines return, if this language has any
      langBusy = false;
    }, LANG_MS + 30);
  }

  /* ---------- Language toggle, annotations, video (delegated) ---------- */

  app.addEventListener('click', (e) => {
    if (e.target.closest('[data-lang]')) return toggleLanguage();
    const ann = e.target.closest('[data-ann]');
    if (ann) return openAnnotation(ann);
    const thumb = e.target.closest('[data-video]');
    if (thumb) return openVideo(thumb);
  });

  app.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-ann]')) { e.preventDefault(); openAnnotation(e.target); }
  });

  function dim(on) { app.classList.toggle('is-dim', on); }

  /* Word annotation: the underlined words zoom out of the quote into the enlarged word, and
     zoom back into their place on Back. */
  const ANN_MS = 200;
  let annSource = null, annPose = '', annBusy = false;

  // Pose the enlarged word so its glyphs sit exactly on the source words in the quote.
  function annStartPose(word, source) {
    // Glyph boxes (via ranges), not line boxes. Copy the numbers out before touching another range.
    const glyphBox = (el) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      const b = r.getClientRects()[0] || el.getBoundingClientRect();
      return { left: b.left, top: b.top };
    };
    const src = glyphBox(source);
    const scale = parseFloat(getComputedStyle(source).fontSize) / parseFloat(getComputedStyle(word).fontSize);
    const box = word.getBoundingClientRect();
    const glyph = glyphBox(word);
    const tx = src.left - box.left - (glyph.left - box.left) * scale;
    const ty = src.top - box.top - (glyph.top - box.top) * scale;
    return `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  function openAnnotation(el) {
    if (annBusy) return;
    const a = current().annotations[+el.dataset.ann];
    const rect = el.getClientRects()[0];
    const overlay = $('annOverlay'), word = $('annWord'), text = $('annText'), back = $('annBack');
    word.textContent = el.textContent;
    text.textContent = noOrphans(a.explanation);
    [word, text, back].forEach((n) => { n.style.transition = 'none'; });
    word.style.transform = '';
    overlay.hidden = false;
    dim(true);

    // Final layout: the enlarged word sits near where it was in the quote.
    const vw = window.innerWidth, vh = window.innerHeight, m = 20;
    word.style.whiteSpace = word.scrollWidth > vw - 2 * m ? 'normal' : 'nowrap';
    word.style.maxWidth = `${vw - 2 * m}px`;
    const w = word.offsetWidth, h = word.offsetHeight;
    const backGutter = vw >= 600 ? 49 : 0;
    const left = Math.max(m + backGutter, Math.min(rect.left - 14, vw - m - Math.max(w, text.offsetWidth)));
    const top = Math.max(64, Math.min(rect.top - (h - rect.height) / 2, vh - h - text.offsetHeight - 40));
    word.style.left = text.style.left = `${left}px`;
    word.style.top = `${top}px`;
    text.style.top = `${top + h + 11}px`;
    back.style.left = `${left - (backGutter ? 44 : 9)}px`;   // the X's 32px hit box; its strokes sit ~9px in
    back.style.top = `${top - (backGutter ? 26 : 36)}px`;

    annSource = el;
    if (reduceMotion.matches) return;
    // Zoom in from the quote.
    annBusy = true;
    annPose = annStartPose(word, el); // reused for the way back (a resize closes the overlay)
    word.style.transform = annPose;
    text.style.opacity = back.style.opacity = 0;
    el.style.visibility = 'hidden';
    word.getBoundingClientRect(); // commit the start pose
    word.style.transition = `transform ${ANN_MS}ms var(--ease)`;
    text.style.transition = back.style.transition = `opacity ${ANN_MS}ms var(--ease)`;
    word.style.transform = 'none';
    text.style.opacity = back.style.opacity = 1;
    setTimeout(() => { annBusy = false; }, ANN_MS);
  }

  function closeAnnotation({ instant = false } = {}) {
    const overlay = $('annOverlay'), word = $('annWord'), text = $('annText'), back = $('annBack');
    if (overlay.hidden) return;
    const source = annSource;
    const done = () => {
      overlay.hidden = true;
      if (source) source.style.visibility = '';
      [word, text, back].forEach((n) => { n.style.transition = 'none'; n.style.opacity = ''; });
      word.style.transform = '';
      annSource = null;
      annBusy = false;
    };
    if (annBusy && !instant) return; // still zooming in — ignore until it lands
    dim(false);
    if (instant || reduceMotion.matches || !source || !source.isConnected) return done();
    // Zoom back into the quote.
    annBusy = true;
    word.style.transition = `transform ${ANN_MS}ms var(--ease)`;
    text.style.transition = back.style.transition = `opacity ${ANN_MS}ms var(--ease)`;
    word.style.transform = annPose;
    text.style.opacity = back.style.opacity = 0;
    setTimeout(done, ANN_MS);
  }

  /* Video: the thumbnail itself grows into the player, and shrinks back on close. */
  const MORPH_MS = 400;
  let videoThumb = null, videoBusy = false;

  const setRect = (el, r) => Object.assign(el.style, {
    left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`,
  });

  // A stand-in showing the thumbnail image, animated between two rectangles.
  function morph(poster, from, to, done) {
    const el = document.createElement('div');
    el.className = 'video-morph';
    el.innerHTML = `<img src="${esc(poster)}" alt="">`;
    setRect(el, from);
    app.appendChild(el);
    el.getBoundingClientRect(); // commit the start rect before transitioning
    el.style.transition = ['left', 'top', 'width', 'height'].map((p) => `${p} ${MORPH_MS}ms var(--ease)`).join(', ');
    setRect(el, to);
    let finished = false;
    const finish = () => { if (finished) return; finished = true; done(el); };
    el.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, MORPH_MS + 80);
  }

  function openVideo(thumb) {
    const video = videoOf(current());
    if (!video || videoBusy) return;
    videoBusy = true;
    videoThumb = thumb;
    const poster = thumb.querySelector('img').currentSrc || thumb.querySelector('img').src;
    const box = $('videoBox'), frame = $('videoFrame');
    box.dataset.orientation = video.orientation;
    box.classList.remove('is-ready');
    frame.innerHTML = '';
    frame.style.backgroundImage = `url("${poster}")`;
    $('videoOverlay').hidden = false;
    const from = thumb.getBoundingClientRect(), to = box.getBoundingClientRect();
    thumb.style.visibility = 'hidden';
    dim(true);
    morph(poster, from, to, (el) => {
      frame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&playsinline=1&rel=0" title="Video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
      box.classList.add('is-ready');
      setTimeout(() => el.remove(), 250); // the poster stays underneath while the player loads
      videoBusy = false;
    });
  }

  function closeVideo() {
    if ($('videoOverlay').hidden || videoBusy) return;
    const thumb = videoThumb, box = $('videoBox'), frame = $('videoFrame');
    const poster = thumb && (thumb.querySelector('img').currentSrc || thumb.querySelector('img').src);
    const reset = () => {
      frame.innerHTML = '';
      box.classList.remove('is-ready');
      $('videoOverlay').hidden = true;
      if (thumb) thumb.style.visibility = '';
      videoThumb = null;
      videoBusy = false;
    };
    if (!thumb || !thumb.isConnected) { dim(false); return reset(); }
    videoBusy = true;
    const from = box.getBoundingClientRect(), to = thumb.getBoundingClientRect();
    frame.innerHTML = '';
    box.classList.remove('is-ready');
    dim(false);
    morph(poster, from, to, (el) => { reset(); el.remove(); });
  }

  function closeOverlays({ instant = false } = {}) {
    if (!$('annOverlay').hidden) return closeAnnotation({ instant });
    if (!$('videoOverlay').hidden && !instant) return closeVideo();
    $('videoOverlay').hidden = true;
    $('videoFrame').innerHTML = '';
    $('videoBox').classList.remove('is-ready');
    document.querySelectorAll('.video-morph').forEach((el) => el.remove());
    if (videoThumb) videoThumb.style.visibility = '';
    videoThumb = null;
    videoBusy = false;
    dim(false);
  }

  $('annBack').addEventListener('click', closeOverlays);
  $('videoClose').addEventListener('click', closeOverlays);
  [$('annOverlay'), $('videoOverlay')].forEach((o) =>
    o.addEventListener('click', (e) => { if (e.target === o) closeOverlays(); }));

  /* ---------- Browser chrome colour ----------
     iOS Safari tints its toolbars and the overscroll area from the page's own colour: Safari 15–18
     from theme-color, Safari 26+ from the body background (theme-color is ignored there, and a
     position: fixed element at a viewport edge would take over — so nothing on the page is fixed).
     All three follow the page: the palette in notes mode, paper on the main page and in the menu. */
  const menuEl = $('menu');
  function syncChromeColor() {
    const root = document.documentElement;
    const inNotes = !menuEl.hidden ? false : !!app.dataset.theme;
    const color = inNotes ? getComputedStyle(notes).backgroundColor : getComputedStyle(root).getPropertyValue('--paper').trim();
    root.style.backgroundColor = document.body.style.backgroundColor = color;
    $('themeColor').setAttribute('content', color);
  }
  new MutationObserver(syncChromeColor).observe(app, { attributes: true, attributeFilter: ['data-theme'] });
  new MutationObserver(syncChromeColor).observe(menuEl, { attributes: true, attributeFilter: ['hidden'] });
  syncChromeColor();

  /* ---------- Menu ---------- */

  const countFor = (key) => (key === 'all' ? state.all.length : state.all.filter((q) => q.categories.includes(key)).length);

  function renderMenu() {
    const big = state.preview;
    // The description may be inside a list row (phone); the list is about to be rebuilt.
    menuEl.insertBefore(document.querySelector('.cat-desc'), $('menuApply'));
    $('catList').innerHTML = [ALL, ...CATEGORIES].map((c) => {
      const cls = ['cat-row', c.key === big && 'is-big', c.key === state.filter && 'is-selected',
        c.key === state.preview && 'is-preview'].filter(Boolean).join(' ');
      const empty = countFor(c.key) === 0;
      return `<li><button class="${cls}" data-cat="${c.key}"${empty ? ' data-empty' : ''}>
        <span class="icon icon-mark cat-mark"></span>
        <span class="cat-name">${esc(c.name)}</span><span class="icon cat-ind"></span></button></li>`;
    }).join('');
    updateMenuPreview();
  }

  function updateMenuPreview() {
    const key = state.preview;
    const cat = key === 'all' ? ALL : CAT_BY_KEY[key];
    document.querySelectorAll('.cat-row').forEach((row) => {
      const k = row.dataset.cat;
      row.classList.toggle('is-big', k === key);
      row.classList.toggle('is-preview', k === key);
      row.classList.toggle('is-selected', k === state.filter);
    });
    const n = countFor(key);
    placeDesc(key, () => {
      $('catDescText').textContent = noOrphans(cat.desc);
      $('catCount').textContent = `${n} quote${n === 1 ? '' : 's'} total`;
    });
    const apply = $('menuApply');
    apply.textContent = key === 'all' ? 'See all words' : `See ${cat.name.toLowerCase()} words`;
    apply.disabled = n === 0;
    apply.style.opacity = n === 0 ? 0.3 : '';
  }

  /* Phone: the description lives in the list, under the previewed row, and moves with the
     preview like an accordion, in step with the mark growing and the row changing height (the
     0.45s row transition in app.css): under the old row a copy of the text simply fades out, fast
     (DESC_OUT_MS), while its space closes up; under the new row the space opens and the text's
     lines fade in one after another, top to bottom, LINE_STAGGER_MS apart. The text is never
     clipped. Tablet/desktop: it stays in the menu's own column. */
  const DESC_MS = 450; // matches the row's height/mark transition
  const DESC_OUT_MS = 100; // the old description is gone almost at once
  const LINE_MS = 250, LINE_STAGGER_MS = 50;
  // Wrap each rendered line of the description in a plain inline span (no layout effect).
  function wrapLines(p) {
    const words = measureWords(p);
    const lines = [];
    words.forEach((w) => {
      const line = lines[lines.length - 1];
      if (line && Math.abs(line.top - w.top) < 4) line.last = w; else lines.push({ top: w.top, first: w, last: w });
    });
    const range = document.createRange();
    return lines.reverse().map((line) => { // last line first: earlier offsets stay valid
      range.setStart(line.first.node, line.first.start);
      range.setEnd(line.last.node, line.last.end);
      const span = document.createElement('span');
      try { range.surroundContents(span); } catch (e) { return null; }
      return span;
    }).filter(Boolean).reverse();
  }
  function placeDesc(key, setText) {
    const desc = document.querySelector('.cat-desc');
    const home = mqMobile.matches ? document.querySelector(`.cat-row[data-cat="${key}"]`)?.closest('li') : menuEl;
    const moving = home && desc.parentNode !== home;
    const animate = moving && mqMobile.matches && !reduceMotion.matches && !$('menu').hidden;
    const shut = { height: '0px', marginTop: '0px', marginBottom: '0px' };
    const open = (el) => ({ height: `${el.offsetHeight}px`, marginTop: '24px', marginBottom: '46px' });
    const fold = (el, show) => {
      const easing = easeCurve();
      const from = open(el);                                     // measured at full height, before folding
      if (!show) {
        // Shutting: the whole text fades out at once, quickly; the space closes with the row.
        el.querySelector('p').animate([{ opacity: 1 }, { opacity: 0 }], { duration: DESC_OUT_MS, easing, fill: 'both' });
        el.animate([from, shut], { duration: DESC_MS, easing, fill: 'both' });
        return new Promise((r) => setTimeout(r, DESC_MS + 20));
      }
      // Opening: the space opens with the row; the lines fade in top to bottom as it does.
      const lines = wrapLines(el.querySelector('p'));
      el.animate([shut, from], { duration: DESC_MS, easing, fill: 'both' });
      lines.forEach((span, i) => span.animate([{ opacity: 0 }, { opacity: 1 }],
        { duration: LINE_MS, delay: i * LINE_STAGGER_MS, easing, fill: 'both' }));
      return new Promise((r) => setTimeout(r, Math.max(DESC_MS, LINE_MS + (lines.length - 1) * LINE_STAGGER_MS) + 20));
    };
    if (animate && desc.parentNode !== menuEl) {
      // A copy stays behind and folds shut while the real one moves on.
      const ghost = desc.cloneNode(true);
      ghost.setAttribute('aria-hidden', 'true');
      ghost.querySelectorAll('[id]').forEach((el) => { if (el.id === 'catCount') el.remove(); else el.removeAttribute('id'); }); // the real one keeps the ids; the count is hidden by id on a phone
      desc.after(ghost);
      fold(ghost, false).then(() => ghost.remove());
    }
    if (moving) { if (home === menuEl) menuEl.insertBefore(desc, $('menuApply')); else home.appendChild(desc); }
    setText();
    if (animate && home !== menuEl) {
      desc.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      const p = desc.querySelector('p');
      p.normalize();
      fold(desc, true).then(() => {
        desc.getAnimations({ subtree: true }).forEach((a) => a.cancel());
        p.querySelectorAll('span').forEach((span) => span.replaceWith(...span.childNodes)); // wrappers off
        p.normalize();
      });
    }
  }

  /* Menu motion: the menu icon shrinks to nothing, then the list arrives — each row fades in
     MENU_STAGGER_MS after the one above while its mark scales up from nothing. The descriptor
     (and Back / the apply button) fade in together with the first row. */
  const MENU_ICON_MS = 200, MENU_ITEM_MS = 400, MENU_STAGGER_MS = 50;
  const MENU_OUT_MS = 250, MENU_BG_MS = 250; // leaving: each row's fade, then the background's
  let menuBusy = false;
  const easeCurve = () => getComputedStyle(document.documentElement).getPropertyValue('--ease').trim() || 'ease';

  function openMenu() {
    if (menuBusy || modeBusy || langBusy || state.animating) return;
    const reveal = () => {
      state.preview = state.filter;
      renderMenu();
      $('menu').hidden = false;
      menuBusy = false;
      if (reduceMotion.matches) return;
      const easing = easeCurve();
      const fadeIn = (el, delay) => el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MENU_ITEM_MS, delay, easing, fill: 'backwards' });
      document.querySelectorAll('#catList .cat-row').forEach((row, i) => {
        fadeIn(row, i * MENU_STAGGER_MS);
        row.querySelector('.cat-mark').animate([{ scale: 0 }, { scale: 1 }], { duration: MENU_ITEM_MS, delay: i * MENU_STAGGER_MS, easing, fill: 'backwards' });
      });
      [document.querySelector('.cat-desc'), $('menuBack'), $('menuApply')].forEach((el) => fadeIn(el, 0));
    };
    if (reduceMotion.matches) return reveal();
    menuBusy = true;
    $('menuBtn').querySelector('.icon').animate([{ scale: 1 }, { scale: 0 }], { duration: MENU_ICON_MS, easing: easeCurve(), fill: 'forwards' });
    setTimeout(reveal, MENU_ICON_MS);
  }

  // Leaving mirrors arriving: rows fade out one after another (marks shrink to nothing, the
  // descriptor goes with the first row), the grey background fades last, and the icon grows back.
  function closeMenu() {
    const menu = $('menu');
    if (menu.hidden || menuBusy) return;
    const icon = $('menuBtn').querySelector('.icon');
    const finish = () => {
      menu.hidden = true;
      menu.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      icon.getAnimations().forEach((a) => a.cancel());
      menuBusy = false;
    };
    if (reduceMotion.matches) return finish();

    menuBusy = true;
    const easing = easeCurve();
    const fadeOut = (el, delay) => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: MENU_OUT_MS, delay, easing, fill: 'forwards' });
    const rows = [...document.querySelectorAll('#catList .cat-row')];
    rows.forEach((row, i) => {
      fadeOut(row, i * MENU_STAGGER_MS);
      row.querySelector('.cat-mark').animate([{ scale: 1 }, { scale: 0 }], { duration: MENU_OUT_MS, delay: i * MENU_STAGGER_MS, easing, fill: 'forwards' });
    });
    [document.querySelector('.cat-desc'), $('menuBack'), $('menuApply')].forEach((el) => fadeOut(el, 0));

    const itemsGone = MENU_OUT_MS + Math.max(0, rows.length - 1) * MENU_STAGGER_MS;
    setTimeout(() => {
      fadeOut(menu, 0).effect.updateTiming({ duration: MENU_BG_MS });                     // background last…
      icon.animate([{ scale: 0 }, { scale: 1 }], { duration: MENU_BG_MS, easing });        // …as the icon returns
      setTimeout(finish, MENU_BG_MS);
    }, itemsGone);
  }

  function applyFilter(key) {
    if (menuBusy || countFor(key) === 0) return;
    if (key !== state.filter) {
      state.filter = key;
      state.list = key === 'all' ? state.all : state.all.filter((q) => q.categories.includes(key));
      state.idx = 0;
      state.original = false;
      renderDeck();
    }
    closeMenu();
  }

  $('menuBtn').addEventListener('click', openMenu);
  $('menuBack').addEventListener('click', closeMenu);
  $('menuApply').addEventListener('click', () => applyFilter(state.preview));

  const catList = $('catList');
  catList.addEventListener('click', (e) => {
    const row = e.target.closest('[data-cat]');
    if (!row) return;
    if (mqHoverDesktop.matches) return applyFilter(row.dataset.cat);
    // Touch: the first tap previews (the row grows, its name is underlined, the description
    // shows); a tap on the underlined row applies.
    if (state.preview === row.dataset.cat) return applyFilter(row.dataset.cat);
    state.preview = row.dataset.cat;
    updateMenuPreview();
  });
  catList.addEventListener('mouseover', (e) => {
    const row = e.target.closest('[data-cat]');
    if (!row || !mqHoverDesktop.matches || state.preview === row.dataset.cat) return;
    state.preview = row.dataset.cat;
    updateMenuPreview();
  });
  catList.addEventListener('mouseleave', () => {
    if (!mqHoverDesktop.matches) return;
    state.preview = state.filter;
    updateMenuPreview();
  });

  /* ---------- Keyboard & resize ---------- */

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('menu').hidden) return closeMenu();
      if (!$('annOverlay').hidden || !$('videoOverlay').hidden) return closeOverlays();
      if (state.mode === 'notes') return setMode('main');
    }
    if (state.mode !== 'main' || !$('menu').hidden) return;
    if (['ArrowDown', 'ArrowRight', 'PageDown', ' ', 'j'].includes(e.key)) { e.preventDefault(); go(1); }
    if (['ArrowUp', 'ArrowLeft', 'PageUp', 'k'].includes(e.key)) { e.preventDefault(); go(-1); }
  });

  let relayoutTimer;
  window.addEventListener('resize', () => {
    // Only the annotation overlay is positioned from window metrics. Leave the video alone:
    // entering native fullscreen fires a resize too.
    if (!$('annOverlay').hidden) closeOverlays({ instant: true });
    // The notes quote takes the main quote's new line breaks (the main deck is still laid out
    // under the notes), so the two never disagree after a resize — now, and again once fluid
    // type has settled.
    const relock = () => {
      if (!$('menu').hidden) updateMenuPreview(); // the description's place depends on the breakpoint
      if (state.mode === 'notes' && !modeBusy && !langBusy) {
        lockLines(track.querySelector('.slide[data-pos="0"] .quote'));
        renderNotesQuote();
      }
      layoutNotes();
    };
    relock();
    clearTimeout(relayoutTimer);
    relayoutTimer = setTimeout(relock, 200);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutNotes);
  document.addEventListener('visibilitychange', layoutNotes); // a hidden tab gets no resize events
  // The pinned quote can change height without a window resize (fluid type, fonts, language toggle).
  if (typeof ResizeObserver === 'function') new ResizeObserver(layoutNotes).observe($('nQuoteWrap'));

  /* ---------- Boot ---------- */

  fetch(DATA_URL)
    .then((r) => { if (!r.ok) throw new Error(`quotes.json: ${r.status}`); return r.json(); })
    .then((quotes) => {
      state.all = quotes.filter((q) => q.status === 'live').sort((a, b) => a.id - b.id);
      state.list = state.all;
      const wanted = parseInt(location.hash.slice(1), 10);
      const found = state.all.findIndex((q) => q.id === wanted);
      state.idx = found >= 0 ? found : Math.floor(Math.random() * state.all.length);
      renderDeck();
    })
    .catch((err) => {
      console.error(err);
      track.innerHTML = '<div class="slide" data-pos="0"><div class="q-wrap"><blockquote class="quote" data-tier="m">The words couldn’t be loaded. Please refresh.</blockquote></div></div>';
    });
})();
