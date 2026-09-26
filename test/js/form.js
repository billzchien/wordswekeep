/* Words We Keep — "Add words" submission form. Plain JS.
   Five steps + a thank-you screen, one screen each, slid like Typeform: Next, the arrows, the
   wheel, a swipe, ↑/↓ keys. Going back is always free; going forward is gated by the step's
   required fields (Next is disabled until they are filled; an arrow/wheel/key attempt marks the
   empty ones with the warning state).

   The payload matches data/quotes.json + md/words-we-keep-submission-system-spec.md. There is
   no backend yet: submit() logs the entry and keeps it in localStorage (`wwk-pending`) — wire
   SUBMIT_URL to Worker #1 when it exists. */
(() => {
  const SUBMIT_URL = ''; // Cloudflare Worker #1 endpoint — empty = offline (localStorage + console)

  const CATEGORIES = [
    { key: 'perspective', name: 'Perspective', desc: 'The lens we bring to life. Outlooks, values, and the search for meaning.' },
    { key: 'growth',      name: 'Growth',      desc: 'The hardships, changes, and moments that shape who we become.' },
    { key: 'drive',       name: 'Drive',       desc: 'The work, ambition, and craft we pour into building something that matters.' },
    { key: 'community',   name: 'Community',   desc: 'The family, friends, and connections that remind us we’re not alone.' },
    { key: 'romance',     name: 'Romance',     desc: 'The joy and heartbreak of loving and being loved by another person.' },
  ];
  // Source kinds. The site sets a title in italics only for book and film (js/app.js → ITALIC_KINDS).
  // "Personal" (something said to the submitter), or no kind chosen yet: no source name or link.
  const KINDS = [
    { value: 'book', label: 'Book' },
    { value: 'film', label: 'Film / TV' },
    { value: 'song', label: 'Song' },
    { value: 'poem', label: 'Poem' },
    { value: 'speech', label: 'Speech / Interview' },
    { value: 'writing', label: 'Writing' },
    { value: 'personal', label: 'Personal' },
    { value: 'other', label: 'Other' },
  ];
  // ISO 3166-1 alpha-2; names from the browser (English), sorted.
  const REGION_CODES = ('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' ');
  const regionNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
  const REGIONS = REGION_CODES.map((c) => ({ value: c, label: regionNames ? regionNames.of(c) : c }))
    .sort((a, b) => a.label.localeCompare(b.label));
  // Regions whose everyday script is not Latin: only there does "Name in original language" show
  // (elsewhere the Latin name is the original). Edit freely.
  const NON_LATIN = new Set(('CN TW HK MO JP KR KP MN RU UA BY KZ KG TJ BG MK RS ME BA GE AM GR CY IL IR IQ SA AE KW QA BH OM YE JO SY LB EG LY TN DZ MA MR SD PS AF PK IN BD NP LK BT MM TH LA KH ET ER').split(' '));
  const THIS_YEAR = new Date().getFullYear();
  const YEARS = Array.from({ length: THIS_YEAR - 999 }, (_, i) => ({ value: String(THIS_YEAR - i), label: String(THIS_YEAR - i) }));

  // The last two words of a sentence are tied, so a line never ends on a single stranded word
  // (same rule as the archive, js/app.js → noOrphans).
  const noOrphans = (t) => t.replace(/ (\S+)$/, '\u00a0$1');
  const $ = (id) => document.getElementById(id);
  const form = $('form'), stepsEl = $('steps'), sheet = $('annSheet');
  const steps = [...document.querySelectorAll('.step')];
  const STEPS = 5; // the sixth screen is "done"
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Data ---------- */

  const blank = () => ({
    text: '', original: '', categories: [],
    author: { name: '', nativeName: '', country: '' },
    source: { kind: '', year: '', title: '', link: '' },
    context: '', annotations: [], reflection: '', keptBy: '',
  });
  let data = blank();
  let cur = 0;

  // A rough script sniff for the original-language code; the admin can correct it.
  function detectLang(text) {
    if (/[぀-ヿ]/.test(text)) return 'ja';
    if (/[가-힯]/.test(text)) return 'ko';
    if (/[一-鿿]/.test(text)) return 'zh';
    if (/[Ѐ-ӿ]/.test(text)) return 'ru';
    if (/[؀-ۿ]/.test(text)) return 'ar';
    if (/[֐-׿]/.test(text)) return 'he';
    if (/[฀-๿]/.test(text)) return 'th';
    if (/[Ͱ-Ͽ]/.test(text)) return 'el';
    return 'other';
  }

  // House style: every paragraph of a note starts with a capital letter.
  const capParas = (s) => s.replace(/(^|\n\s*\n)(\s*)(\p{Ll})/gu, (m, br, sp, ch) => br + sp + ch.toUpperCase());
  function payload() {
    const t = (s) => s.trim();
    const original = t(data.original);
    const hasSource = !!data.source.kind && data.source.kind !== 'personal';
    return {
      status: 'pending',
      text: t(data.text),
      originalLanguage: original ? { lang: detectLang(original), text: original } : null,
      categories: CATEGORIES.map((c) => c.key).filter((k) => data.categories.includes(k)),
      author: { name: t(data.author.name), nativeName: NON_LATIN.has(data.author.country) ? (t(data.author.nativeName) || null) : null, country: data.author.country || null },
      // One link: the site plays it if it is a video (YouTube), otherwise links the source title to it.
      source: (data.source.title || data.source.kind || data.source.year || data.source.link)
        ? { title: hasSource ? (t(data.source.title) || null) : null, year: data.source.year ? Number(data.source.year) : null, kind: data.source.kind || null, link: hasSource ? (t(data.source.link) || null) : null }
        : null,
      context: capParas(t(data.context)) || null,
      annotations: data.annotations.filter((a) => a.word.trim()).map((a) => ({ word: a.word.trim(), explanation: a.explanation.trim() })),
      reflection: capParas(t(data.reflection)),
      keptBy: t(data.keptBy) || null,
      submittedAt: new Date().toISOString(),
      approvedAt: null,
      website: $('fWebsite').value, // honeypot: must be empty
    };
  }

  /* ---------- Steps: validity, Next buttons, the counter ---------- */

  const valid = [
    () => data.text.trim().length > 0,
    () => data.categories.length > 0,
    () => data.author.name.trim().length > 0 && !!data.author.country,
    () => true,
    () => data.reflection.trim().length > 0,
  ];
  // The required fields of each step (for the warning state).
  const required = [
    () => [$('fText')],
    () => [],
    () => [$('fName'), $('fCountry').querySelector('.field')],
    () => [],
    () => [$('fReflection')],
  ];

  function refresh() {
    steps.forEach((s, i) => {
      const next = s.querySelector('[data-next]');
      if (next) next.disabled = !valid[i]();
    });
    $('submitBtn').disabled = !valid[4]();
    // Step 4's button reads "Skip" until there is something to keep.
    $('ctxNext').textContent = (data.context.trim() || data.annotations.length) ? 'Next' : 'Skip';
    const n = data.annotations.length;
    $('annLabel').textContent = n ? `${n} word${n === 1 ? '' : 's'} annotated` : 'Annotate specific words';
    $('prevBtn').disabled = cur === 0;
    $('nextBtn').disabled = cur >= STEPS - 1 || !valid[cur]();
    setPage(Math.min(cur, STEPS - 1) + 1);
    form.classList.toggle('is-done', cur >= STEPS);
  }

  // The pager: the fill grows with the step, and the current number counts up (or down). The
  // roll holds every step's digit, stacked, all rendered from the start; the box shows one line
  // and the roll slides by whole lines — nothing is swapped in or out, so nothing can blink.
  let page = 1;
  $('pageCur').innerHTML = Array.from({ length: STEPS }, (_, i) => `<span>${i + 1}</span>`).join('');
  function setPage(n) {
    $('pageTotal').textContent = STEPS;
    $('pageFill').style.width = `${(n / STEPS) * 100}%`;
    $('count').setAttribute('aria-label', `Step ${n} of ${STEPS}`);
    if (n === page) return;
    page = n;
    $('pageCur').style.setProperty('--p', n - 1); // css slides the roll by that many lines
  }

  function warn(step) {
    const fields = required[step]().filter((f) => f && !f.value.trim());
    fields.forEach((f) => f.closest('.fw').classList.add('is-warn'));
    if (fields[0]) fields[0].focus({ preventScroll: true });
  }
  document.addEventListener('input', (e) => {
    const fw = e.target.closest('.fw');
    if (fw && e.target.value.trim()) fw.classList.remove('is-warn');
  });

  let sliding = false;
  function go(i, { force = false } = {}) {
    if (i < 0 || i > STEPS || i === cur || sliding) return;
    if (i > cur && !force) {
      if (!valid[cur]()) { warn(cur); return; }
      i = cur + 1; // one step at a time going forward: each gate in turn
    }
    if (i >= STEPS && !force) return; // the done screen is reached by submit() only
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    cur = i;
    stepsEl.style.transform = `translateY(${-cur * 100}%)`;
    steps[cur].scrollTop = 0;
    sliding = !reduceMotion.matches;
    setTimeout(() => { sliding = false; }, reduceMotion.matches ? 0 : 600);
    refresh();
  }

  /* ---------- Navigation: buttons, keys, wheel, swipe ---------- */

  document.querySelectorAll('[data-next]').forEach((b) => b.addEventListener('click', () => go(cur + 1)));
  $('prevBtn').addEventListener('click', () => go(cur - 1));
  $('nextBtn').addEventListener('click', () => go(cur + 1));

  const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  document.addEventListener('keydown', (e) => {
    if (!sheet.hidden) { if (e.key === 'Escape') closeSheet(); return; }
    if (cur >= STEPS) return;
    const el = document.activeElement;
    if (el && el.closest('.combo.is-open')) return; // the list owns the keys
    if (e.key === 'Enter' && el && el.tagName === 'INPUT') { e.preventDefault(); go(cur + 1); return; }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && el && el.tagName === 'TEXTAREA') { e.preventDefault(); go(cur + 1); return; }
    if (isTyping(el)) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); go(cur + 1); }
    if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); go(cur - 1); }
  });

  // A step that can still scroll in the wheel's direction scrolls; otherwise the wheel turns the
  // page — one step per gesture (same de-bounce idea as the archive: js/app.js).
  const WHEEL_MIN = 40, WHEEL_COOLDOWN_MS = 700;
  let wheelAcc = 0, wheelLock = 0, wheelTimer = 0;
  function canScroll(el, dir) {
    if (!el) return false;
    return dir > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0;
  }
  // A tall step scrolls itself first; the page turns only from a fresh gesture once the content
  // has rested at its edge for SCROLL_REST_MS (trackpad inertia otherwise runs straight through).
  const SCROLL_REST_MS = 400;
  let lastScrollAt = 0;
  steps.forEach((st) => st.addEventListener('scroll', () => { lastScrollAt = performance.now(); }, { passive: true }));
  document.addEventListener('wheel', (e) => {
    if (!sheet.hidden || cur >= STEPS || e.ctrlKey) return;
    if (e.target.closest('.combo.is-open')) return; // an open dropdown owns the wheel, even at the end of its list (a page turn would close it)
    const dir = Math.sign(e.deltaY);
    if (!dir) return;
    // Anything scrollable under the pointer (a full textarea, the dropdown list, the step itself)
    // scrolls first; the page turns only when none of them can move that way.
    for (let el = e.target; el && el !== document.body; el = el.parentElement) {
      if (el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY) && canScroll(el, dir)) return; // (not clip/hidden: .form holds the whole stack)
    }
    e.preventDefault();
    const now = performance.now();
    if (now - lastScrollAt < SCROLL_REST_MS) return;
    if (now < wheelLock) return;
    wheelAcc += e.deltaY;
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { wheelAcc = 0; }, 180);
    if (Math.abs(wheelAcc) >= WHEEL_MIN) {
      wheelAcc = 0;
      wheelLock = now + WHEEL_COOLDOWN_MS;
      go(cur + dir);
    }
  }, { passive: false });

  let touchY = null, touchT = 0;
  document.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; touchT = performance.now(); }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (touchY === null || !sheet.hidden || cur >= STEPS) return;
    const dy = touchY - e.changedTouches[0].clientY;
    touchY = null;
    const dir = Math.sign(dy);
    if (Math.abs(dy) < 60 || performance.now() - touchT > 600) return;
    if (canScroll(steps[cur], dir) || isTyping(document.activeElement)) return;
    go(cur + dir);
  }, { passive: true });

  /* ---------- Textareas: the dropdown's 2px overlay scrollbar ---------- */
  // Same bar as the combobox list: the native one is hidden (css), a 2px black bar over the
  // right edge shows the visible fraction, never shorter than 24px, gone when nothing scrolls.
  document.querySelectorAll('textarea.field').forEach((ta) => {
    const bar = document.createElement('div');
    bar.className = 'fw-bar';
    bar.hidden = true;
    ta.parentElement.appendChild(bar);
    const draw = () => {
      const { scrollHeight: sh, clientHeight: ch, offsetTop: top } = ta;
      const st = Math.min(Math.max(0, ta.scrollTop), sh - ch);
      if (sh <= ch + 1) { bar.hidden = true; return; }
      bar.hidden = false;
      const h = Math.max(24, (ch / sh) * ch);
      bar.style.top = `${top + (st / (sh - ch)) * (ch - h)}px`;
      bar.style.height = `${h}px`;
    };
    ta.addEventListener('scroll', draw, { passive: true });
    ta.addEventListener('input', draw);
    window.addEventListener('resize', draw);
    ta.addEventListener('focus', draw);
  });

  /* ---------- Fields that appear and go (css .fold) ---------- */
  const FOLD_MS = 200;
  const foldTimers = new WeakMap();
  function fold(el, open) {
    clearTimeout(foldTimers.get(el));
    if (open) {
      if (!el.hidden && el.classList.contains('is-open')) return;
      el.hidden = false;
      void el.offsetHeight; // commit the folded state, then unfold
      el.classList.add('is-open');
    } else {
      if (el.hidden) return;
      el.classList.remove('is-open');
      foldTimers.set(el, setTimeout(() => { el.hidden = true; }, reduceMotion.matches ? 0 : FOLD_MS));
    }
  }

  /* ---------- Step 1 ---------- */

  $('fText').addEventListener('input', (e) => { data.text = e.target.value; refresh(); });
  $('fOriginal').addEventListener('input', (e) => { data.original = e.target.value; });
  // Figma frame 1-2: the toggle row goes away and the second field appears under the first.
  // The toggle and the field fold in opposite directions at the same time, so the column's
  // height only ever changes smoothly and nothing below it jumps.
  $('origToggle').addEventListener('click', () => {
    fold($('origToggleWrap'), false);
    fold($('fOriginalWrap'), true);
    setTimeout(() => $('fOriginal').focus({ preventScroll: true }), FOLD_MS);
  });
  // The × in its corner: the field folds shut, its words are dropped, the toggle comes back.
  $('origClose').addEventListener('click', () => {
    fold($('fOriginalWrap'), false);
    fold($('origToggleWrap'), true);
    $('fOriginal').value = '';
    data.original = '';
  });

  /* ---------- Step 2 ---------- */

  $('catList').innerHTML = CATEGORIES.map((c) => `
    <button type="button" class="cat" role="checkbox" aria-checked="false" data-key="${c.key}">
      <span class="icon icon-mark" aria-hidden="true"></span>
      <span class="cat-title">${c.name}</span>
      <span class="cat-blurb">${noOrphans(c.desc)}</span>
      <span class="cat-box" aria-hidden="true"><span class="icon icon-check"></span></span>
    </button>`).join('');
  $('catList').addEventListener('click', (e) => {
    const b = e.target.closest('.cat');
    if (!b) return;
    const k = b.dataset.key, on = !data.categories.includes(k);
    data.categories = on ? [...data.categories, k] : data.categories.filter((x) => x !== k);
    b.setAttribute('aria-checked', String(on));
    refresh();
  });

  /* ---------- Combobox ---------- */

  // A text field that filters a list. Typing narrows it; Enter / click picks; the × clears.
  // `free` lets a typed value that is on no row stand (the year).
  function combo(host, { options, placeholder, free = false, onChange, label }) {
    host.classList.add('combo');
    host.innerHTML = `<input class="field" type="text" placeholder="${placeholder}" autocomplete="off" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-label="${label || placeholder}">
      <button type="button" class="combo-btn" tabindex="-1" aria-label="Open"><span class="icon icon-chevron"></span></button>`;
    const input = host.querySelector('input'), btn = host.querySelector('.combo-btn'), icon = btn.querySelector('.icon');
    let list = null, bar = null, value = '', hover = -1, shown = [];
    // iOS: a tap on a row can blur the input before the tap's click arrives; blur closes the
    // list, and the click (and the focus that comes with it) then lands on whatever field sits
    // under the finger. So a list closed within a moment of a touch stays in place, invisible,
    // for SHIELD_MS and takes those events itself.
    const SHIELD_MS = 400;
    let lastTouch = 0;
    host.addEventListener('touchstart', () => { lastTouch = performance.now(); }, { passive: true });
    // Overlay scrollbar: a 2px bar over the list's right edge, sized to the visible fraction.
    const drawBar = () => {
      if (!list || !bar) return;
      const { scrollHeight: sh, clientHeight: ch, offsetTop: top } = list;
      const st = Math.min(Math.max(0, list.scrollTop), sh - ch); // iOS rubber-bands past both ends
      if (sh <= ch + 1) { bar.hidden = true; return; }
      bar.hidden = false;
      const h = Math.max(24, (ch / sh) * ch); // never shorter than 24px, like a real scrollbar
      bar.style.top = `${top + (st / (sh - ch)) * (ch - h)}px`;
      bar.style.height = `${h}px`;
    };

    const setValue = (v, lbl) => {
      value = v; input.value = lbl || '';
      host.classList.toggle('has-value', !!v);
      if (v) host.classList.remove('is-warn');
      icon.className = 'icon ' + (v ? 'icon-x' : 'icon-chevron');
      btn.setAttribute('aria-label', v ? 'Clear' : 'Open');
      onChange(v);
    };
    const close = () => {
      if (!list) return;
      const l = list, b = bar;
      list = null; bar = null; hover = -1;
      if (performance.now() - lastTouch < 1000) { l.style.opacity = '0'; if (b) b.hidden = true; setTimeout(() => { l.remove(); if (b) b.remove(); }, SHIELD_MS); }
      else { l.remove(); if (b) b.remove(); }
      host.classList.remove('is-open'); input.setAttribute('aria-expanded', 'false');
    };
    const render = (q) => {
      const s = q.trim().toLowerCase();
      shown = s
        ? [...options.filter((o) => o.label.toLowerCase().startsWith(s)), ...options.filter((o) => !o.label.toLowerCase().startsWith(s) && o.label.toLowerCase().includes(s))]
        : options;
      if (!list) {
        list = document.createElement('div');
        list.className = 'combo-list'; list.setAttribute('role', 'listbox');
        // Keep the input focused (no blur while choosing). Cancelling pointerdown also cancels the
        // click a touch would produce (iOS), so a row is picked on pointerup instead — a tap, not
        // a scroll: the finger must not have travelled.
        let down = null;
        list.addEventListener('pointerdown', (e) => { e.preventDefault(); down = { x: e.clientX, y: e.clientY, t: e.pointerType }; });
        list.addEventListener('pointerup', (e) => {
          const it = e.target.closest('.combo-item');
          const moved = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8;
          down = null;
          if (it && !moved) { e.preventDefault(); pick(Number(it.dataset.i)); }
        });
        list.addEventListener('click', (e) => { const it = e.target.closest('.combo-item'); if (it && list) pick(Number(it.dataset.i)); }); // keyboard / assistive tech
        host.appendChild(list);
        bar = document.createElement('div'); bar.className = 'combo-bar'; host.appendChild(bar);
        list.addEventListener('scroll', drawBar, { passive: true });
        host.classList.add('is-open'); input.setAttribute('aria-expanded', 'true');
      }
      list.innerHTML = shown.length
        ? shown.slice(0, 400).map((o, i) => `<button type="button" class="combo-item" role="option" data-i="${i}" aria-selected="${o.value === value}">${o.label}${o.value === value ? '<span class="icon icon-asterisk"></span>' : ''}</button>`).join('')
        : `<div class="combo-empty">${free ? 'Press Enter to keep it' : 'Nothing found'}</div>`;
      hover = -1;
      if (value) { const i = shown.findIndex((o) => o.value === value); if (i >= 0) { hover = i; list.children[i]?.scrollIntoView({ block: 'nearest' }); } }
      drawBar();
    };
    const pick = (i) => { const o = shown[i]; if (!o) return; setValue(o.value, o.label); close(); };
    const setHover = (i) => {
      if (!list || !shown.length) return;
      hover = (i + shown.length) % shown.length;
      [...list.children].forEach((c, k) => c.classList.toggle('is-hover', k === hover));
      list.children[hover]?.scrollIntoView({ block: 'nearest' });
    };
    const settle = () => { // on blur: keep an exact match, a free value, or fall back
      const t = input.value.trim();
      const exact = options.find((o) => o.label.toLowerCase() === t.toLowerCase());
      if (exact) setValue(exact.value, exact.label);
      else if (free && t) setValue(t, t);
      else if (!t) setValue('', '');
      else setValue(value, options.find((o) => o.value === value)?.label || (free ? value : ''));
      close();
    };

    input.addEventListener('focus', () => { host.classList.remove('is-warn'); render(value ? '' : input.value); });
    input.addEventListener('click', () => { if (!list) render(value ? '' : input.value); });
    input.addEventListener('input', () => { if (value) { value = ''; host.classList.remove('has-value'); icon.className = 'icon icon-chevron'; onChange(''); } render(input.value); });
    input.addEventListener('blur', settle);
    input.addEventListener('keydown', (e) => {
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) e.stopPropagation(); // the list's keys never turn the page
      if (e.key === 'ArrowDown') { e.preventDefault(); if (!list) render(input.value); setHover(hover + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHover(hover - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); if (list && hover >= 0) pick(hover); else if (list && shown.length === 1) pick(0); else settle(); }
      else if (e.key === 'Escape') { e.preventDefault(); settle(); }
      else if (e.key === 'Tab') settle();
    });
    btn.addEventListener('pointerdown', (e) => e.preventDefault());
    btn.addEventListener('click', () => {
      if (value) { setValue('', ''); input.focus(); render(''); }
      else if (list) close();
      else { input.focus(); }
    });
    return { input, set: (v) => { const o = options.find((x) => x.value === v); setValue(v, o ? o.label : (free ? v : '')); } };
  }

  /* ---------- Step 3 ---------- */

  $('fName').addEventListener('input', (e) => { data.author.name = e.target.value; refresh(); });
  $('fNative').addEventListener('input', (e) => { data.author.nativeName = e.target.value; });
  $('fTitle').addEventListener('input', (e) => { data.source.title = e.target.value; });
  $('fSourceLink').addEventListener('input', (e) => { data.source.link = e.target.value; });
  const country = combo($('fCountry'), { options: REGIONS, placeholder: 'Country or region', label: 'Country or region', onChange: (v) => { data.author.country = v; fold($('fNativeWrap'), NON_LATIN.has(v)); refresh(); } });
  // Source name and link appear once a kind other than Personal is chosen, one after the other.
  const SOURCE_STAGGER_MS = 50;
  function showSourceFields(on) {
    const name = $('fTitleWrap'), link = $('fSourceLinkWrap');
    clearTimeout(showSourceFields.t);
    if (on) { fold(name, true); showSourceFields.t = setTimeout(() => fold(link, true), SOURCE_STAGGER_MS); }
    else { fold(link, false); showSourceFields.t = setTimeout(() => fold(name, false), SOURCE_STAGGER_MS); }
  }
  const kind = combo($('fKind'), { options: KINDS, placeholder: 'Source category', label: 'Source category', onChange: (v) => { data.source.kind = v; showSourceFields(!!v && v !== 'personal'); } });
  const year = combo($('fYear'), { options: YEARS, placeholder: 'Year', free: true, onChange: (v) => { data.source.year = /^\d{1,4}$/.test(v) ? v : ''; } });
  year.input.inputMode = 'numeric';

  /* ---------- Step 4: context + the annotation sheet ---------- */

  $('fContext').addEventListener('input', (e) => { data.context = e.target.value; refresh(); });

  /* Word annotation (Figma: Annotation 304:2148). A row starts with just the Word field; once
     something is typed an arrow appears (Enter does the same) and the word is checked against the
     quote. A match: the words are underlined in the quote, the field locks, the explanation
     unfolds, and "Another" + "Save annotation" appear. No match: the field empties into the
     warning state, "Word must match". The × in the field: on the first row it unlocks a matched
     word; on an added row it removes the row (whatever its state). */
  let draft = []; // the sheet edits a copy; Save keeps it, Cancel drops it. {word, explanation, matched}
  const normalise = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  // Where `word` sits in the quote (case-insensitive, any whitespace), skipping stretches already
  // taken by other rows — so a second "love" lands on the second love. -1 when it does not fit.
  function findInQuote(word, taken = []) {
    const q = data.text.trim(), w = normalise(word);
    if (!w) return { at: -1 };
    const hay = q.toLowerCase();
    // whole words when the phrase starts/ends with a Latin letter or digit; CJK etc. as a plain substring
    const re = new RegExp((/^[\p{L}\p{N}]/u.test(w) && /[a-z0-9]$/i.test(w) ? '(?<![\\p{L}\\p{N}])' : '') + w.split(' ').map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+') + (/[a-z0-9]$/i.test(w) ? '(?![\\p{L}\\p{N}])' : ''), 'gu');
    const free = (a, b) => !taken.some(([s0, s1]) => a < s1 && b > s0);
    let m;
    while ((m = re.exec(hay))) { if (free(m.index, m.index + m[0].length)) return { at: m.index, text: q.slice(m.index, m.index + m[0].length) }; }
    for (let i = hay.indexOf(w); i >= 0; i = hay.indexOf(w, i + 1)) { if (free(i, i + w.length)) return { at: i, text: q.slice(i, i + w.length) }; }
    return { at: -1 };
  }
  const takenBy = (rows) => rows.filter((a) => a.matched && a.at >= 0).map((a) => [a.at, a.at + a.word.length]);
  function rowHTML(a, i, cls = '') {
    const matched = !!a.matched;
    return `
      <div class="ann-row${cls}${matched ? ' is-matched' : ''}" data-i="${i}"><div>
        <div class="ann-row-head"><p>${i + 1}.</p></div>
        <div class="stack">
          <div class="fw ann-field">
            <input class="field" type="text" data-f="word" placeholder="Word" value="${esc(a.word)}" autocomplete="off" aria-label="Word ${i + 1}"${matched ? ' readonly' : ''}>
            <button type="button" class="ann-confirm" aria-label="Check the word"${a.word.trim() && !matched ? '' : ' hidden'}><span class="icon icon-arrow icon-arrow--right"></span></button>
            ${i > 0
              ? `<button type="button" class="ann-unlock ann-remove" aria-label="Remove this word"${a.word.trim() && !matched ? ' hidden' : ''}><span class="icon icon-x"></span></button>`
              : `<button type="button" class="ann-unlock" aria-label="Change the word"${matched ? '' : ' hidden'}><span class="icon icon-x"></span></button>`}
          </div>
          <div class="fold${matched ? ' is-open' : ''}"${matched ? '' : ' hidden'}><div class="fw"><input class="field" type="text" data-f="explanation" placeholder="Explain the word" value="${esc(a.explanation)}" autocomplete="off" aria-label="Explain word ${i + 1}"></div></div>
        </div>
      </div></div>`;
  }
  function renderRows() { $('annRows').innerHTML = draft.map((a, i) => rowHTML(a, i)).join(''); renderQuote(); syncTail(); }
  // The quote with every matched word highlighted. A new highlight wipes in left→right
  // (MARK_MS); one being taken away wipes out left→right, then the span goes (`leaving`).
  const MARK_MS = 300;
  function renderQuote(leaving = []) {
    const q = data.text.trim();
    const spans = takenBy(draft).concat(leaving.map(([s0, s1]) => [s0, s1, 'off'])).sort((x, y) => x[0] - y[0]);
    const shown = new Set([...$('annQuote').querySelectorAll('.ann-mark')].map((m) => m.dataset.at));
    let html = '', at = 0;
    spans.forEach(([s0, s1, off]) => {
      if (s0 < at) return;
      // A leaving span is rebuilt still full (is-on), and switched to is-off a frame later, so the
      // wipe-out runs from 100% instead of starting at nothing.
      const cls = off || shown.has(String(s0)) ? 'ann-mark is-on' : 'ann-mark';
      html += esc(q.slice(at, s0)) + `<span class="${cls}" data-at="${s0}"${off ? ' data-leaving' : ''}>${esc(q.slice(s0, s1))}</span>`;
      at = s1;
    });
    $('annQuote').innerHTML = html + esc(q.slice(at));
    requestAnimationFrame(() => {
      $('annQuote').querySelectorAll('.ann-mark:not(.is-on)').forEach((m) => m.classList.add('is-on'));
      $('annQuote').querySelectorAll('.ann-mark[data-leaving]').forEach((m) => { m.classList.remove('is-on'); m.classList.add('is-off'); });
    });
    if (leaving.length) setTimeout(() => renderQuote(), reduceMotion.matches ? 0 : MARK_MS);
  }
  // "Another" and "Save annotation" show once every row is matched (and there is one).
  // "Another" once every row is matched; "Save annotation" as soon as one row is complete —
  // it keeps the complete rows and drops an unfinished one (enabled only when every matched
  // word has its explanation).
  function syncTail() {
    const matched = draft.filter((a) => a.matched), complete = matched.filter((a) => a.explanation.trim());
    fold($('annAnotherWrap'), draft.length > 0 && matched.length === draft.length);
    fold($('annSaveWrap'), matched.length > 0);
    $('annSave').disabled = complete.length === 0; // saves the complete rows; a word without its explanation is dropped
  }
  const annMs = () => (reduceMotion.matches ? 0 : 200);
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const rowOf = (el) => { const row = el.closest('.ann-row'); return row ? { row, a: draft[Number(row.dataset.i)] } : null; };
  function confirmWord(row, a) {
    const wrap = row.querySelector('.ann-field'), input = wrap.querySelector('input');
    const m = findInQuote(input.value, takenBy(draft.filter((x) => x !== a)));
    if (m.at < 0) { // no match (or every occurrence already taken): empty, warning state, "Word must match"
      a.word = ''; input.value = ''; input.placeholder = 'Word must match';
      wrap.classList.add('is-warn'); wrap.querySelector('.ann-confirm').hidden = true;
      const rm = wrap.querySelector('.ann-remove'); if (rm) rm.hidden = false; // empty again: the extra row can be removed
      return;
    }
    a.word = m.text; a.at = m.at; a.matched = true; input.value = m.text; input.readOnly = true;
    wrap.classList.remove('is-warn'); wrap.querySelector('.ann-confirm').hidden = true; wrap.querySelector('.ann-unlock').hidden = false; // row 1: unlock ×; an added row: its remove ×
    row.classList.add('is-matched');
    const exp = row.querySelector('.fold');
    fold(exp, true);
    renderQuote(); syncTail();
    setTimeout(() => exp.querySelector('input').focus({ preventScroll: true }), FOLD_MS);
  }
  function unlockWord(row, a) {
    const wrap = row.querySelector('.ann-field'), input = wrap.querySelector('input');
    const gone = a.at >= 0 ? [[a.at, a.at + a.word.length]] : [];
    a.matched = false; a.at = -1;
    input.readOnly = false; input.placeholder = 'Word';
    wrap.querySelector('.ann-unlock').hidden = true; wrap.querySelector('.ann-confirm').hidden = !input.value.trim();
    const rm = wrap.querySelector('.ann-remove'); if (rm) rm.hidden = !!input.value.trim();
    row.classList.remove('is-matched');
    fold(row.querySelector('.fold'), false);
    renderQuote(gone); syncTail();
    input.focus({ preventScroll: true }); input.select();
  }
  $('annRows').addEventListener('input', (e) => {
    const r = rowOf(e.target); if (!r) return;
    r.a[e.target.dataset.f] = e.target.value;
    if (e.target.dataset.f === 'explanation') syncTail();
    if (e.target.dataset.f === 'word') {
      const wrap = e.target.closest('.ann-field');
      wrap.classList.remove('is-warn'); e.target.placeholder = 'Word';
      wrap.querySelector('.ann-confirm').hidden = !e.target.value.trim();
      const rm = wrap.querySelector('.ann-remove'); if (rm) rm.hidden = !!e.target.value.trim();
    }
  });
  $('annRows').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.target.dataset.f !== 'word' || e.target.readOnly) return;
    e.preventDefault(); const r = rowOf(e.target); if (r) confirmWord(r.row, r.a);
  });
  $('annRows').addEventListener('click', (e) => {
    const confirm = e.target.closest('.ann-confirm'), remove = e.target.closest('.ann-remove'), unlock = !remove && e.target.closest('.ann-unlock');
    const r = rowOf(e.target); if (!r) return;
    if (confirm) return confirmWord(r.row, r.a);
    if (unlock) return unlockWord(r.row, r.a);
    if (!remove) return;
    if (r.row.classList.contains('is-leaving')) return;
    r.row.classList.add('is-leaving'); // fades up and folds shut, the rows below move up with it
    const gone = r.a.matched && r.a.at >= 0 ? [[r.a.at, r.a.at + r.a.word.length]] : [];
    r.a.matched = false; r.a.at = -1;
    renderQuote(gone);
    setTimeout(() => { draft.splice(Number(r.row.dataset.i), 1); renderRows(); }, annMs());
  });
  $('annAnother').addEventListener('click', () => {
    draft.push({ word: '', explanation: '', matched: false, at: -1 });
    $('annRows').insertAdjacentHTML('beforeend', rowHTML(draft[draft.length - 1], draft.length - 1, ' is-new')); // fades in and unfolds
    const row = $('annRows').lastElementChild;
    syncTail();
    setTimeout(() => { row.classList.remove('is-new'); row.querySelector('input').focus({ preventScroll: true }); }, annMs());
  });

  function openSheet() {
    draft = [];
    data.annotations.forEach((a) => { const m = findInQuote(a.word, takenBy(draft)); draft.push({ ...a, matched: m.at >= 0, at: m.at }); });
    if (!draft.length) draft.push({ word: '', explanation: '', matched: false, at: -1 });
    renderRows();
    sheet.classList.remove('is-out');
    sheet.hidden = false;
    sheet.querySelector('.ann-scroll').scrollTop = 0;
    void sheet.offsetHeight; // commit the closed crop, then let the drop transition run
    sheet.classList.add('is-in');
    setChrome(getComputedStyle(sheet).backgroundColor);
    // Focus once the sheet is in: focusing while the crop moves would reveal nothing of use.
    setTimeout(() => { if (!sheet.hidden) sheet.querySelector('input').focus({ preventScroll: true }); }, sheetMs());
  }
  const sheetMs = () => (reduceMotion.matches ? 0 : parseFloat(getComputedStyle(sheet).getPropertyValue('--sheet-ms')) || 600);
  function closeSheet() {
    if (sheet.hidden) return;
    if (document.activeElement && sheet.contains(document.activeElement)) document.activeElement.blur();
    sheet.classList.remove('is-in');
    sheet.classList.add('is-out');
    setChrome(getComputedStyle(document.documentElement).getPropertyValue('--paper').trim());
    refresh();
    setTimeout(() => { if (sheet.classList.contains('is-out')) { sheet.hidden = true; sheet.classList.remove('is-out'); } }, sheetMs());
  }
  $('annToggle').addEventListener('click', openSheet);
  $('annCancel').addEventListener('click', closeSheet);
  $('annSave').addEventListener('click', () => {
    data.annotations = draft.filter((a) => a.matched && a.word.trim() && a.explanation.trim()).map((a) => ({ word: a.word.trim(), explanation: a.explanation.trim() }));
    closeSheet();
  });

  /* ---------- Step 5: submit ---------- */

  $('fReflection').addEventListener('input', (e) => { data.reflection = e.target.value; refresh(); });
  $('fKeptBy').addEventListener('input', (e) => { data.keptBy = e.target.value; });

  async function submit() {
    if (!valid.every((v) => v())) return;
    const entry = payload();
    const btn = $('submitBtn');
    btn.disabled = true;
    try {
      if (SUBMIT_URL) {
        const r = await fetch(SUBMIT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) });
        if (!r.ok) throw new Error(`Submit failed: ${r.status}`);
      } else {
        // Offline (no worker yet): keep it in this browser so the entry can be inspected.
        const key = 'wwk-pending';
        const pending = JSON.parse(localStorage.getItem(key) || '[]');
        pending.push(entry);
        localStorage.setItem(key, JSON.stringify(pending));
        console.log('[Words We Keep] submission (offline, saved to localStorage "wwk-pending"):', entry);
      }
      go(STEPS, { force: true });
    } catch (err) {
      console.error(err);
      btn.disabled = false;
      alert('Something went wrong sending your words. Please try again.');
    }
  }
  $('submitBtn').addEventListener('click', submit);

  function reset() {
    data = blank();
    ['fText', 'fOriginal', 'fName', 'fNative', 'fTitle', 'fSourceLink', 'fContext', 'fReflection', 'fKeptBy', 'fWebsite'].forEach((id) => { $(id).value = ''; });
    fold($('fOriginalWrap'), false); fold($('origToggleWrap'), true); fold($('fNativeWrap'), false); showSourceFields(false);
    document.querySelectorAll('.cat').forEach((b) => b.setAttribute('aria-checked', 'false'));
    document.querySelectorAll('.fw.is-warn').forEach((w) => w.classList.remove('is-warn'));
    country.set(''); kind.set(''); year.set('');
    // From "Words submitted", a fresh step 1 comes in from below (one slide down, like every
    // other step), not by rewinding up through all five. Step 1 is parked under the done screen
    // for the slide, then everything is put back in place without a transition.
    const first = steps[0], ms = reduceMotion.matches ? 0 : 600;
    first.style.setProperty('--i', STEPS + 1);
    stepsEl.style.transform = `translateY(${-(STEPS + 1) * 100}%)`;
    sliding = true;
    cur = 0;
    refresh();
    setTimeout(() => {
      stepsEl.style.transition = 'none';
      first.style.setProperty('--i', 0);
      stepsEl.style.transform = 'translateY(0)';
      void stepsEl.offsetHeight;
      stepsEl.style.transition = '';
      sliding = false;
    }, ms);
  }
  $('againBtn').addEventListener('click', reset);

  /* ---------- "Add word": the landing page's label animation ----------
     The letters erase left→right and type back left→right, LABEL_STEP_MS apart (index.html has
     the same at 26ms). Desktop: on hover (and again on leaving); touch: once when the button
     becomes ready. Never while disabled. */
  const LABEL_STEP_MS = 26;
  function typewriterLabel(btn) {
    const cells = [];
    const text = btn.textContent;
    btn.textContent = '';
    const label = document.createElement('span'); // one inline flex item: the spaces between cells survive
    label.className = 'label';
    btn.appendChild(label);
    [...text].forEach((ch) => {
      if (ch === ' ') { label.appendChild(document.createTextNode(' ')); return; }
      const cell = document.createElement('span');
      cell.className = 'cell';
      cell.textContent = ch;
      cells.push(cell);
      label.appendChild(cell);
    });
    let timers = [];
    const play = () => {
      if (btn.disabled || reduceMotion.matches) return;
      timers.forEach(clearTimeout); timers = [];
      const eraseDone = cells.length * LABEL_STEP_MS;
      cells.forEach((cell, i) => {
        timers.push(setTimeout(() => { cell.style.opacity = '0'; }, i * LABEL_STEP_MS));
        timers.push(setTimeout(() => { cell.style.opacity = '1'; }, eraseDone + i * LABEL_STEP_MS));
      });
    };
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      btn.addEventListener('mouseenter', play);
      btn.addEventListener('mouseleave', play);
    } else {
      // Touch: once, as the button turns from disabled to ready.
      new MutationObserver(() => { if (!btn.disabled) play(); }).observe(btn, { attributes: true, attributeFilter: ['disabled'] });
    }
    return play;
  }
  typewriterLabel($('submitBtn'));

  /* ---------- Browser chrome colour (see js/app.js → syncChromeColor) ---------- */

  function setChrome(color) {
    document.documentElement.style.backgroundColor = document.body.style.backgroundColor = color;
    $('themeColor').setAttribute('content', color);
  }
  setChrome(getComputedStyle(document.documentElement).getPropertyValue('--paper').trim());

  document.querySelectorAll('.q-desc').forEach((p) => { p.textContent = noOrphans(p.textContent); });
  steps.forEach((s, i) => s.style.setProperty('--i', i));
  refresh();

  // The logo goes home: the form fades out around it first (css .is-leaving).
  document.querySelector('.home').addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const href = e.currentTarget.href;
    sessionStorage.setItem('wwk-home', '1');
    form.classList.add('is-leaving');
    setTimeout(() => { location.href = href; }, reduceMotion.matches ? 0 : 100);
  });
  window.addEventListener('pageshow', () => form.classList.remove('is-leaving'));

  // Opened from the archive's "Add words": play the entrance (css .is-arriving).
  if (sessionStorage.getItem('wwk-arrive')) {
    sessionStorage.removeItem('wwk-arrive');
    steps[0].querySelectorAll('.content > .group > *, .content > .btn').forEach((el, k) => { el.classList.add('rise'); el.style.setProperty('--k', k); });
    form.classList.add('is-arriving');
    setTimeout(() => { form.classList.remove('is-arriving'); document.documentElement.classList.remove('is-arriving'); }, 900);
  }
})();
