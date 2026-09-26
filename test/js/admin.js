/* Words We Keep — the library (admin CMS). Plain JS, no backend yet.
   Three lists (Live / Pending / Archive) and an edit / review view, routed by the URL hash:
   #live · #pending · #archive · #edit/<id>. #reset throws the demo data away.

   Data: the live quotes come from data/quotes.json; pending and archived ones are made up here
   (seed()). Everything the admin does is kept in localStorage (STORE_KEY) so it survives a
   reload. When the Workers exist, load() / persist() / publish() are the three seams to wire. */
(() => {
  const STORE_KEY = 'wwk-admin-demo';
  const $ = (id) => document.getElementById(id);
  const admin = $('admin'), scroll = $('scroll');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const touch = window.matchMedia('(hover: none)').matches;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const ms = (n) => (reduceMotion.matches ? 0 : n);

  const CATEGORIES = [
    { key: 'perspective', name: 'Perspective' },
    { key: 'growth',      name: 'Growth' },
    { key: 'drive',       name: 'Drive' },
    { key: 'community',   name: 'Community' },
    { key: 'romance',     name: 'Romance' },
  ];
  // The form's kinds, plus the ones already in quotes.json (the converter's SOURCES), so every
  // live quote shows its kind.
  const KINDS = [
    { value: 'book', label: 'Book' }, { value: 'film', label: 'Film & TV' }, { value: 'series', label: 'Series' },
    { value: 'song', label: 'Song' }, { value: 'poem', label: 'Poem' }, { value: 'speech', label: 'Speech & interview' },
    { value: 'interview', label: 'Interview' }, { value: 'writing', label: 'Writing' }, { value: 'essay', label: 'Essay' },
    { value: 'letter', label: 'Letter' }, { value: 'scripture', label: 'Scripture' }, { value: 'comic', label: 'Comic' },
    { value: 'artwork', label: 'Artwork' }, { value: 'commercial', label: 'Commercial' }, { value: 'personal', label: 'Personal' },
    { value: 'other', label: 'Other' },
  ];
  const REGION_CODES = ('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' ');
  const regionNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
  const REGIONS = REGION_CODES.map((c) => ({ value: c, label: regionNames ? regionNames.of(c) : c })).sort((a, b) => a.label.localeCompare(b.label));
  const NON_LATIN = new Set(('CN TW HK MO JP KR KP MN RU UA BY KZ KG TJ BG MK RS ME BA GE AM GR CY IL IR IQ SA AE KW QA BH OM YE JO SY LB EG LY TN DZ MA MR SD PS AF PK IN BD NP LK BT MM TH LA KH ET ER').split(' '));
  const THIS_YEAR = new Date().getFullYear();
  const YEARS = Array.from({ length: THIS_YEAR - 999 }, (_, i) => ({ value: String(THIS_YEAR - i), label: String(THIS_YEAR - i) }));

  /* ---------- Data ---------- */

  let store = null; // { live: [], pending: [], archive: [], lastPublishedAt, publishDirty }
  const persist = () => localStorage.setItem(STORE_KEY, JSON.stringify(store));
  const nowISO = () => new Date().toISOString();
  const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();

  async function load() {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { try { store = JSON.parse(raw); if (store && store.live && store.live.every((q) => q.key)) return; } catch (e) { /* fall through */ } } // no keys = an older demo store: re-seed
    const res = await fetch('../../data/quotes.json');
    store = seed(await res.json());
    persist();
  }

  // Made-up pending and archived quotes, with the kind of mess Auto cleanup is for.
  function seed(live) {
    let uid = 0;
    const base = (o) => ({ key: `s${++uid}`, status: 'pending', text: '', originalLanguage: null, categories: [], author: { name: '', nativeName: null, country: null }, source: null, context: null, annotations: [], reflection: '', keptBy: null, submittedAt: nowISO(), approvedAt: null, ...o });
    const pending = [
      base({ text: 'the only way to do great work is to love what you do . if you havent found it yet,keep looking. dont settle', categories: ['drive'],
        author: { name: 'steve jobs', nativeName: null, country: 'US' }, source: { title: 'stanford commencement address', year: 2005, kind: 'speech', link: 'https://www.youtube.com/watch?v=UF8uR6Z6KLc' },
        context: 'said near the end of the speech,  after the part about being fired from apple', reflection: 'i read this the week i quit my job. it made the whole thing feel less like falling and more like looking', keptBy: 'maya', submittedAt: daysAgo(1), seen: false }),
      base({ text: 'The road ahead is long and far; I will search up and down for it.', originalLanguage: { lang: 'zh', text: '路漫漫其修远兮，吾将上下而求索' }, categories: ['growth', 'perspective'],
        author: { name: 'Qu Yuan', nativeName: '屈原', country: 'CN' }, source: { title: 'Li Sao', year: null, kind: 'poem', link: null },
        context: null, reflection: 'My grandfather wrote this on the first page of every notebook he gave me.', keptBy: 'Ruolin', submittedAt: daysAgo(2), seen: false }),
      base({ text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', categories: ['drive', 'growth'],
        author: { name: 'Will Durant', nativeName: null, country: 'US' }, source: { title: 'The Story of Philosophy', year: 1926, kind: 'book', link: null },
        context: 'Often attributed to Aristotle; Durant was summarising him.', annotations: [{ word: 'habit', explanation: 'From the Greek hexis: a settled disposition, something you have rather than something you do.' }],
        reflection: 'It took the pressure off. I don’t have to be excellent today, I have to show up today.', keptBy: null, submittedAt: daysAgo(5), seen: true }),
    ];
    const archive = [
      base({ status: 'archived', text: 'Live, laugh, love.', categories: ['perspective'], author: { name: 'Unknown', nativeName: null, country: 'US' }, source: null,
        reflection: 'It is on my kitchen wall.', keptBy: 'Dana', submittedAt: daysAgo(12), archivedAt: daysAgo(10), archivedFrom: 'pending' }),
      base({ status: 'archived', text: 'Check out my website for the best quotes and deals!!!', categories: ['drive'], author: { name: 'quotesdaily', nativeName: null, country: null }, source: null,
        reflection: 'best quotes', keptBy: null, submittedAt: daysAgo(9), archivedAt: daysAgo(9), archivedFrom: 'pending' }),
      { ...clone(live[1]), key: 'a-jordan', id: live.reduce((m, q) => Math.max(m, q.id), 0) + 1, status: 'archived', text: 'I have missed more than 9000 shots in my career. I have lost almost 300 games.', keptBy: 'Sam', submittedAt: daysAgo(20), approvedAt: daysAgo(19), archivedAt: daysAgo(3), archivedFrom: 'live', dirty: false },
    ];
    return {
      live: live.map((q) => ({ ...q, key: `q${q.id}`, dirty: false })),
      pending, archive,
      lastPublishedAt: daysAgo(3),
      publishDirty: false,
    };
  }

  const fmtDate = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`; };
  const catLabel = (keys) => keys.map((k, i) => { const n = (CATEGORIES.find((c) => c.key === k) || { name: k }).name; return i ? n.toLowerCase() : n; }).join(', ');
  const listOf = (tab) => store[tab];
  const findItem = (key) => { for (const tab of ['live', 'pending', 'archive']) { const q = store[tab].find((x) => x.key === key); if (q) return { q, tab }; } return null; };
  // Numbers. A live quote keeps its number for good (an archived live quote's number is retired
  // with it). A pending quote shows its *potential* number: the next free one, in order of
  // submission, so archiving a pending quote hands its number to the one after it.
  const maxId = () => [...store.live, ...store.archive].reduce((m, q) => Math.max(m, q.id || 0), 0);
  const pendingOrder = () => [...store.pending].sort((a, b) => (a.submittedAt > b.submittedAt ? 1 : -1));
  const numberOf = (q) => (q.status === 'pending' ? maxId() + 1 + pendingOrder().findIndex((x) => x.key === q.key) : q.id);

  /* ---------- Routing ---------- */

  const TABS = { live: 1, pending: 1, archive: 1 };
  let tab = 'live';
  function route() {
    const h = location.hash.slice(1) || 'live';
    if (h === 'reset') { localStorage.removeItem(STORE_KEY); location.hash = '#live'; location.reload(); return; }
    const [view, id] = h.split('/');
    if (view === 'edit' && findItem(id)) openEdit(id);
    else showList(view in TABS ? view : 'live');
  }
  window.addEventListener('hashchange', route);

  // The list and the edit view cross-fade (--view-ms) and the page scrolls back to the top.
  let viewTimer = 0;
  function switchView(view) {
    const cur = admin.dataset.view;
    if (cur === view) return Promise.resolve();
    const from = view === 'edit' ? $('listView') : $('editView'), to = view === 'edit' ? $('editView') : $('listView');
    from.classList.add('is-out');
    clearTimeout(viewTimer);
    return new Promise((res) => {
      viewTimer = setTimeout(() => {
        from.hidden = true; to.hidden = false; to.classList.add('is-out');
        admin.dataset.view = view;
        $('chromeList').hidden = view === 'edit'; $('chromeEdit').hidden = view !== 'edit';
        scroll.scrollTop = 0;
        void to.offsetHeight;
        to.classList.remove('is-out');
        res();
      }, ms(200));
    });
  }

  /* ---------- The lists ---------- */

  const HEADS = {
    live:    [{ c: 'c-num', t: 'Number', short: 'No.', sort: 'id' }, { c: 'c-date', t: 'Date published', sort: 'publishedAt' }, { c: 'c-cat', t: 'Category' }, { c: 'c-quote', t: 'Quote', count: true }, { c: 'c-act', t: '' }],
    pending: [{ c: 'c-num', t: 'Number', short: 'No.', sort: 'id' }, { c: 'c-date', t: 'Date submitted', sort: 'submittedAt' }, { c: 'c-cat', t: 'Category' }, { c: 'c-quote', t: 'Quote', count: true }, { c: 'c-act', t: '' }],
    archive: [{ c: 'c-date', t: 'Date archived', sort: 'archivedAt' }, { c: 'c-cat', t: 'Category' }, { c: 'c-quote', t: 'Quote', count: true }, { c: 'c-act', t: '' }],
  };
  const sortState = { live: { key: 'id', dir: 1 }, pending: { key: 'id', dir: 1 }, archive: { key: 'archivedAt', dir: -1 } };
  const dateOf = { live: (q) => q.dirty ? '' : (q.approvedAt || ''), pending: (q) => q.submittedAt, archive: (q) => q.archivedAt };

  function showList(t) {
    tab = t;
    admin.dataset.tab = t;
    document.querySelectorAll('.tab').forEach((a) => a.classList.toggle('is-active', a.dataset.tab === t));
    $('ctaLive').hidden = t !== 'live'; $('ctaArchive').hidden = t !== 'archive';
    if (t === 'pending' && store.pending.some((q) => !q.seen)) { store.pending.forEach((q) => { q.seen = true; }); persist(); } // read: the mark goes
    renderList();
    switchView('list');
    refreshChrome();
  }

  function refreshChrome() {
    $('pendingDot').hidden = !store.pending.some((q) => !q.seen);
    $('publishBtn').disabled = !store.publishDirty;
    $('lastPublished').textContent = store.lastPublishedAt ? `Last published : ${fmtDate(store.lastPublishedAt)}` : 'Never published';
    $('removeAllBtn').disabled = !store.archive.length;
  }

  function sorted(t) {
    const { key, dir } = sortState[t];
    const val = (q) => (key === 'id' ? numberOf(q) : (key === 'publishedAt' ? (q.dirty ? '￿' : (q.approvedAt || '')) : (q[key] || '')));
    return [...listOf(t)].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * dir);
  }

  function renderList() {
    const items = sorted(tab);
    $('thead').innerHTML = HEADS[tab].map((h) => {
      const label = h.count ? `${h.t} (${items.length})` : (h.short ? `<span class="h-long">${h.t}</span><span class="h-short">${h.short}</span>` : h.t);
      if (h.sort) return `<div class="${h.c}"><button type="button" class="sort" data-key="${h.sort}" data-dir="${sortState[tab].key === h.sort ? sortState[tab].dir : 1}"><span>${label}</span><span class="icon icon-sort"></span></button></div>`;
      return `<div class="${h.c}">${label}</div>`;
    }).join('');
    const acts = { live: '<button type="button" data-act="edit" aria-label="Edit"><span class="icon icon-edit"></span></button><button type="button" data-act="archive" aria-label="Archive"><span class="icon icon-x16"></span></button>',
                   pending: '<button type="button" data-act="edit" aria-label="Review"><span class="icon icon-eye"></span></button>',
                   archive: '<button type="button" data-act="revert" aria-label="Put back"><span class="icon icon-revert"></span></button><button type="button" data-act="remove" aria-label="Remove"><span class="icon icon-x16"></span></button>' }[tab];
    const swipe = { live: 'archive', pending: '', archive: 'revert' }[tab];
    const swipeLabel = { archive: 'Archive', revert: 'Put back' };
    $('rows').innerHTML = items.map((q) => `
      <div class="row" data-key="${q.key}" tabindex="0">
        <div class="row-inner">
          <p class="c-num num">${numberOf(q)}</p>
          <p class="c-date num">${tab === 'live' && q.dirty ? 'Not published' : fmtDate(dateOf[tab](q))}</p>
          <p class="c-cat">${esc(catLabel(q.categories))}</p>
          <p class="c-quote">${esc(q.text)}</p>
          <div class="c-act">${acts}</div>
        </div>
        ${swipe ? `<button type="button" class="row-swipe" data-act="${swipe}">${swipeLabel[swipe]}</button>` : ''}
      </div>`).join('');
    $('empty').hidden = items.length > 0;
    $('empty').textContent = { live: 'Nothing live yet.', pending: 'Nothing waiting.', archive: 'The archive is empty.' }[tab];
  }

  $('thead').addEventListener('click', (e) => {
    const b = e.target.closest('.sort'); if (!b) return;
    const s = sortState[tab];
    if (s.key === b.dataset.key) s.dir = -s.dir; else { s.key = b.dataset.key; s.dir = 1; }
    renderList();
  });

  $('rows').addEventListener('click', (e) => {
    const row = e.target.closest('.row'); if (!row) return;
    const key = row.dataset.key;
    const act = e.target.closest('[data-act]');
    if (act) { e.preventDefault(); doAction(act.dataset.act, key, row); return; }
    if (row.classList.contains('is-open')) { row.classList.remove('is-open'); return; }
    if (tab !== 'archive') location.hash = `#edit/${key}`;
  });
  $('rows').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const row = e.target.closest('.row'); if (row && tab !== 'archive') location.hash = `#edit/${row.dataset.key}`;
  });

  // A row goes: fades out, then the list re-renders without it.
  function leaveRow(row, then) {
    row.classList.add('is-leaving');
    setTimeout(() => { then(); renderList(); refreshChrome(); }, ms(150));
  }
  async function doAction(act, key, row) {
    if (act === 'edit') { location.hash = `#edit/${key}`; return; }
    if (act === 'archive') leaveRow(row, () => archiveItem(key));
    if (act === 'revert') leaveRow(row, () => revertItem(key));
    if (act === 'remove' && (await ask('Remove this quote for good?', 'Remove', 'Not yet'))) leaveRow(row, () => { take(key); persist(); });
  }

  /* ---------- Moves between the lists ---------- */

  function take(key) { const f = findItem(key); if (!f) return null; store[f.tab] = store[f.tab].filter((x) => x.key !== key); return f; }
  function archiveItem(key) {
    const f = take(key); if (!f) return;
    store.archive.unshift({ ...f.q, status: 'archived', archivedAt: nowISO(), archivedFrom: f.tab });
    if (f.tab === 'live') store.publishDirty = true; // the site still shows it until the next publish
    persist();
  }
  function revertItem(key) {
    const f = take(key); if (!f) return;
    const to = f.q.archivedFrom === 'live' ? 'live' : 'pending';
    const q = { ...f.q }; delete q.archivedAt; delete q.archivedFrom;
    if (to === 'live') { q.status = 'live'; q.dirty = true; store.publishDirty = true; store.live.push(q); store.live.sort((a, b) => a.id - b.id); }
    else { q.status = 'pending'; q.seen = true; store.pending.push(q); store.pending.sort((a, b) => a.id - b.id); }
    persist();
  }
  function approveItem(key) {
    const f = take(key); if (!f) return;
    store.live.push({ ...f.q, id: maxId() + 1, status: 'live', dirty: true, approvedAt: null }); // the number it was showing
    store.live.sort((a, b) => a.id - b.id);
    store.publishDirty = true;
    persist();
  }
  // Publish: the live list becomes the site. Here it only stamps the dates and logs what would
  // be sent to the Worker.
  function publish() {
    const t = nowISO();
    store.live.forEach((q) => { if (q.dirty) { q.dirty = false; q.approvedAt = q.approvedAt || t; q.publishedAt = t; } });
    store.publishDirty = false; store.lastPublishedAt = t;
    persist();
    console.log('[library] publish →', store.live.map(({ dirty, seen, publishedAt, ...q }) => q));
    renderList(); refreshChrome();
  }
  $('publishBtn').addEventListener('click', publish);
  $('removeAllBtn').addEventListener('click', async () => {
    if (!(await ask('Are you sure you want to remove all quotes?', 'Remove', 'Not yet'))) return;
    store.archive = []; persist(); renderList(); refreshChrome();
  });

  /* ---------- Pop-up ---------- */

  let popupResolve = null;
  function ask(text, yes, no) {
    $('popupText').textContent = text; $('popupYes').textContent = yes; $('popupNo').textContent = no;
    $('popup').hidden = false;
    $('popupNo').focus();
    return new Promise((res) => { popupResolve = res; });
  }
  function answer(v) { if (!popupResolve) return; $('popup').hidden = true; const r = popupResolve; popupResolve = null; r(v); }
  $('popupYes').addEventListener('click', () => answer(true));
  $('popupNo').addEventListener('click', () => answer(false));
  $('popup').addEventListener('click', (e) => { if (e.target === $('popup')) answer(false); });
  document.addEventListener('keydown', (e) => { if (popupResolve && e.key === 'Escape') answer(false); });

  /* ---------- The edit view ---------- */

  let edit = null; // { id, tab, draft, orig }
  const toDraft = (q) => ({
    text: q.text || '', original: q.originalLanguage ? q.originalLanguage.text : '', lang: q.originalLanguage ? q.originalLanguage.lang : '',
    categories: [...q.categories],
    author: { name: q.author?.name || '', nativeName: q.author?.nativeName || '', country: q.author?.country || '' },
    source: { kind: q.source?.kind || '', year: q.source?.year ? String(q.source.year) : '', title: q.source?.title || '', link: q.source?.link || '' },
    context: q.context || '', annotations: q.annotations.map((a) => ({ word: a.word, explanation: a.explanation, matched: false, at: -1 })),
    reflection: q.reflection || '', keptBy: q.keptBy || '',
  });
  function fromDraft(d, q) {
    const t = (s) => s.trim();
    const hasSource = !!d.source.kind && d.source.kind !== 'personal';
    q.text = t(d.text);
    q.originalLanguage = t(d.original) ? { lang: d.lang || detectLang(d.original), text: t(d.original) } : null;
    q.categories = CATEGORIES.map((c) => c.key).filter((k) => d.categories.includes(k));
    q.author = { name: t(d.author.name), nativeName: NON_LATIN.has(d.author.country) ? (t(d.author.nativeName) || null) : null, country: d.author.country || null };
    q.source = (d.source.kind || d.source.year || d.source.title || d.source.link)
      ? { title: hasSource ? (t(d.source.title) || null) : null, year: d.source.year ? Number(d.source.year) : null, kind: d.source.kind || null, link: hasSource ? (t(d.source.link) || null) : null }
      : null;
    q.context = t(d.context) || null;
    q.annotations = d.annotations.filter((a) => a.matched && a.word.trim()).map((a) => ({ word: a.word.trim(), explanation: a.explanation.trim() })); // locked rows only
    q.reflection = t(d.reflection);
    q.keptBy = t(d.keptBy) || null;
    return q;
  }
  function detectLang(text) {
    if (/[぀-ヿ]/.test(text)) return 'ja';
    if (/[가-힯]/.test(text)) return 'ko';
    if (/[一-鿿]/.test(text)) return 'zh';
    if (/[Ѐ-ӿ]/.test(text)) return 'ru';
    if (/[؀-ۿ]/.test(text)) return 'ar';
    return 'other';
  }

  // Compared without empty annotation pairs (the blank pair the view shows is not a change).
  const norm = (d) => JSON.stringify({ ...d, annotations: d.annotations.filter((a) => a.word.trim() || a.explanation.trim()).map((a) => ({ word: a.word, explanation: a.explanation })) });
  const isDirty = () => !!edit && norm(edit.draft) !== norm(edit.orig);
  function updateDirty() {
    const d = isDirty(), ok = checkAnn();
    $('saveBtn').disabled = !d || !ok;
    $('approveBtn').disabled = !ok;
    $('revertBtn').disabled = !d;
  }

  /* ---------- Annotations must match the quote ----------
     The same rules as the form's sheet (js/form.js → findInQuote): a word is checked against the
     quote — case and whitespace aside, whole words for Latin, a substring for CJK, each row
     taking the next *free* occurrence — and locks in the quote's spelling. Stored annotations
     open already locked. When the quote changes (typing, Auto cleanup), a locked word that no
     longer fits is looked for loosely (straight/curly quotes and punctuation aside); one clear
     hit and it is rewritten to the new spelling, otherwise it unlocks into the warning state.
     Save / Approve wait while any row is unlocked with a word in it. */
  const normalise = (t) => t.replace(/\s+/g, ' ').trim().toLowerCase();
  function findInQuote(word, text, taken = []) {
    const q = text.trim(), w = normalise(word);
    if (!w) return { at: -1 };
    const hay = q.toLowerCase();
    const re = new RegExp((/^[\p{L}\p{N}]/u.test(w) && /[a-z0-9]$/i.test(w) ? '(?<![\\p{L}\\p{N}])' : '') + w.split(' ').map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+') + (/[a-z0-9]$/i.test(w) ? '(?![\\p{L}\\p{N}])' : ''), 'gu');
    const free = (a, b) => !taken.some(([s0, s1]) => a < s1 && b > s0);
    let m;
    while ((m = re.exec(hay))) { if (free(m.index, m.index + m[0].length)) return { at: m.index, text: q.slice(m.index, m.index + m[0].length) }; }
    for (let k = hay.indexOf(w); k >= 0; k = hay.indexOf(w, k + 1)) { if (free(k, k + w.length)) return { at: k, text: q.slice(k, k + w.length) }; }
    return { at: -1 };
  }
  const takenBy = (rows) => rows.filter((a) => a.matched && a.at >= 0).map((a) => [a.at, a.at + a.word.length]);
  const loose = (t) => t.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[.,;:!?…()\[\]"']/g, '').replace(/\s+/g, ' ').trim();
  // Lock every row that fits the quote (opening a quote; the draft coming back from undo).
  function relockAnn(d) {
    d.annotations.forEach((a) => { a.matched = false; a.at = -1; });
    d.annotations.forEach((a) => { const m = findInQuote(a.word, d.text, takenBy(d.annotations)); if (m.at >= 0) { a.word = m.text; a.at = m.at; a.matched = true; } });
  }
  const checkAnn = () => !edit || edit.draft.annotations.every((a) => a.matched || !a.word.trim());
  // The quote changed: locked words follow it or come unlocked.
  function followAnn() {
    if (!edit) return;
    const text = edit.draft.text, words = text.split(/\s+/);
    let changed = false;
    edit.draft.annotations.forEach((a) => {
      if (!a.matched) return;
      const others = takenBy(edit.draft.annotations.filter((x) => x !== a));
      let m = findInQuote(a.word, text, others);
      if (m.at < 0) { // loosely: one clear hit and the word is rewritten
        const target = loose(a.word), n = target.split(' ').length, hits = [];
        for (let k = 0; k + n <= words.length; k++) { const run = words.slice(k, k + n).join(' '); if (loose(run) === target) hits.push(run.replace(/^[“"‘(]+/, '').replace(/[.,;:!?…”"’)]+$/, '')); }
        if (hits.length === 1) m = findInQuote(hits[0], text, others);
      }
      if (m.at >= 0) { if (m.text !== a.word || m.at !== a.at) { a.word = m.text; a.at = m.at; changed = true; } }
      else { a.matched = false; a.at = -1; changed = true; }
    });
    if (changed) renderAnn(true);
  }

  // Stepping quote → quote with the arrows: the form slides out (up or down, the way the arrow
  // points) while fading, the next one slides in from the other side; the page is back at the top.
  const STEP_MS = 250;
  let stepDir = 0; // set by the arrows before the hash changes: +1 next, −1 previous
  async function openEdit(key) {
    const f = findItem(key); if (!f) return;
    if (f.tab === 'archive') { location.hash = '#archive'; return; }
    const stepping = admin.dataset.view === 'edit' && stepDir !== 0;
    const view = $('editView');
    if (stepping) { view.style.setProperty('--dir', stepDir); view.classList.add('is-stepping-out'); await new Promise((r) => setTimeout(r, ms(STEP_MS))); }
    edit = { key, tab: f.tab, draft: toDraft(f.q), orig: null, undo: [], redo: [], mark: null };
    relockAnn(edit.draft);
    edit.orig = clone(edit.draft);
    admin.dataset.kind = f.tab;
    tab = f.tab;
    $('backBtn').href = `#${f.tab}`;
    $('editNo').textContent = `No. ${numberOf(f.q)}`;
    $('editDate').textContent = f.tab === 'live' ? (f.q.dirty || !f.q.approvedAt ? 'Not published' : `Published: ${fmtDate(f.q.approvedAt)}`) : `Submitted: ${fmtDate(f.q.submittedAt)}`;
    fill(edit.draft);
    updateDirty();
    const list = sorted(f.tab), i = list.findIndex((x) => x.key === key);
    $('prevBtn').disabled = i <= 0; $('nextBtn').disabled = i >= list.length - 1;
    $('prevBtn').dataset.key = i > 0 ? list[i - 1].key : ''; $('nextBtn').dataset.key = i < list.length - 1 ? list[i + 1].key : '';
    if (stepping) {
      scroll.scrollTop = 0;
      view.classList.remove('is-stepping-out'); view.classList.add('is-stepping-in');
      void view.offsetHeight;
      view.classList.remove('is-stepping-in');
    }
    stepDir = 0;
    await switchView('edit');
  }

  // Leaving the edit view with unsaved changes asks first.
  async function leaveTo(hash) {
    if (isDirty() && !(await ask('Leave without saving?', 'Leave', 'Keep editing'))) return;
    edit = null;
    location.hash = hash;
  }
  $('backBtn').addEventListener('click', (e) => { e.preventDefault(); leaveTo($('backBtn').getAttribute('href')); });
  $('prevBtn').addEventListener('click', () => { if ($('prevBtn').dataset.key) { stepDir = -1; leaveTo(`#edit/${$('prevBtn').dataset.key}`); } });
  $('nextBtn').addEventListener('click', () => { if ($('nextBtn').dataset.key) { stepDir = 1; leaveTo(`#edit/${$('nextBtn').dataset.key}`); } });
  document.addEventListener('keydown', (e) => {
    if (admin.dataset.view !== 'edit' || popupResolve || !edit) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === 's') { e.preventDefault(); if (edit.tab === 'live' && isDirty()) saveEdit(); }
    if (mod && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); } // the form's own history, not the field's
  });

  /* ---------- Undo (⌘Z) / redo (⇧⌘Z) ----------
     The whole form is one history: every change (typing, a checkbox, a dropdown, Auto cleanup,
     Revert, an annotation added or removed) first files the state it starts from. Typing in one
     field files one step per pause of UNDO_PAUSE_MS, not one per key. */
  const UNDO_PAUSE_MS = 600;
  function mark(what = '') {
    if (!edit) return;
    const now = performance.now();
    if (what && edit.mark && edit.mark.what === what && now - edit.mark.at < UNDO_PAUSE_MS) { edit.mark.at = now; return; }
    edit.undo.push(clone(edit.draft)); edit.redo = [];
    if (edit.undo.length > 100) edit.undo.shift();
    edit.mark = what ? { what, at: now } : null;
  }
  function undo() { if (!edit.undo.length) return; edit.redo.push(clone(edit.draft)); edit.draft = edit.undo.pop(); edit.mark = null; fill(edit.draft); updateDirty(); }
  function redo() { if (!edit.redo.length) return; edit.undo.push(clone(edit.draft)); edit.draft = edit.redo.pop(); edit.mark = null; fill(edit.draft); updateDirty(); }

  function saveEdit() {
    const f = findItem(edit.key); if (!f) return;
    fromDraft(edit.draft, f.q);
    f.q.dirty = true; store.publishDirty = true;
    edit.orig = clone(edit.draft);
    persist(); updateDirty(); refreshChrome();
    $('editDate').textContent = 'Not published';
  }
  $('saveBtn').addEventListener('click', saveEdit);
  $('approveBtn').addEventListener('click', () => {
    const f = findItem(edit.key); if (!f) return;
    fromDraft(edit.draft, f.q);
    approveItem(edit.key);
    edit = null; location.hash = '#pending';
  });
  $('archiveBtn').addEventListener('click', () => {
    const f = findItem(edit.key); if (!f) return;
    fromDraft(edit.draft, f.q);
    archiveItem(edit.key);
    edit = null; location.hash = '#pending';
  });
  $('revertBtn').addEventListener('click', () => { if (!isDirty()) return; mark(); edit.draft = clone(edit.orig); fill(edit.draft); updateDirty(); });

  /* ---------- Fields ---------- */

  const bind = (id, set) => $(id).addEventListener('input', (e) => { mark(id); set(e.target.value); updateDirty(); });
  // CJK text in a field is set smaller (css .is-cjk); checked as it is typed and when filled.
  const cjkSize = (el) => el.classList.toggle('is-cjk', /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(el.value));
  ['fOriginal', 'fNative', 'fText', 'fName', 'fTitle'].forEach((id) => $(id).addEventListener('input', () => cjkSize($(id))));
  bind('fText', (v) => { edit.draft.text = v; followAnn(); });
  bind('fOriginal', (v) => { edit.draft.original = v; edit.draft.lang = v.trim() ? detectLang(v) : ''; });
  bind('fName', (v) => { edit.draft.author.name = v; });
  bind('fNative', (v) => { edit.draft.author.nativeName = v; });
  bind('fTitle', (v) => { edit.draft.source.title = v; });
  bind('fLink', (v) => { edit.draft.source.link = v; });
  bind('fContext', (v) => { edit.draft.context = v; });
  bind('fReflection', (v) => { edit.draft.reflection = v; });
  bind('fKeptBy', (v) => { edit.draft.keptBy = v; });

  // "In original language +" adds the second field; it stays as long as there is text in it.
  $('origToggle').addEventListener('click', () => { mark(); fold($('fOriginalWrap'), true); $('origToggle').hidden = true; setTimeout(() => $('fOriginal').focus({ preventScroll: true }), 200); });
  // The × on the original-language field: the words go, the field folds shut, the "+" is back.
  $('origClose').addEventListener('click', () => { mark(); edit.draft.original = ''; edit.draft.lang = ''; $('fOriginal').value = ''; fold($('fOriginalWrap'), false); $('origToggle').hidden = false; updateDirty(); });

  $('catList').innerHTML = CATEGORIES.map((c) => `
    <button type="button" class="chk" role="checkbox" aria-checked="false" data-key="${c.key}">
      <span class="chk-box" aria-hidden="true"><span class="icon icon-check"></span></span><span>${c.name}</span>
    </button>`).join('');
  $('catList').addEventListener('click', (e) => {
    const b = e.target.closest('.chk'); if (!b) return;
    const k = b.dataset.key, on = !edit.draft.categories.includes(k);
    mark();
    edit.draft.categories = on ? [...edit.draft.categories, k] : edit.draft.categories.filter((x) => x !== k);
    b.setAttribute('aria-checked', String(on));
    updateDirty();
  });

  const country = combo($('fCountry'), { options: REGIONS, placeholder: 'Country or region', onChange: (v) => { if (!edit) return; mark('country'); edit.draft.author.country = v; fold($('fNativeWrap'), NON_LATIN.has(v)); updateDirty(); } });
  const kind = combo($('fKind'), { options: KINDS, placeholder: 'Source category', onChange: (v) => { if (!edit) return; mark('kind'); edit.draft.source.kind = v; showSourceFields(!!v && v !== 'personal'); updateDirty(); } });
  const year = combo($('fYear'), { options: YEARS, placeholder: 'Year', free: true, onChange: (v) => { if (!edit) return; mark('year'); edit.draft.source.year = /^\d{1,4}$/.test(v) ? v : ''; updateDirty(); } });
  year.input.inputMode = 'numeric';
  function showSourceFields(on) {
    clearTimeout(showSourceFields.t);
    if (on) { fold($('fTitleWrap'), true); showSourceFields.t = setTimeout(() => fold($('fLinkWrap'), true), 50); }
    else { fold($('fLinkWrap'), false); showSourceFields.t = setTimeout(() => fold($('fTitleWrap'), false), 50); }
  }

  // Annotations: closed ("Annotation +") until there is one; open = the rows, "Another +" once
  // every row is matched, and a × on the title line that drops them all (hidden once there are
  // two rows, which carry their own ×). A row: the Word field, → to check it (Enter too); a match
  // locks it and unfolds the explanation; the × unlocks row 1 / removes an added row.
  function setAnnOpen(open, animate = true) {
    $('annSec').classList.toggle('is-open', open);
    (animate ? fold : foldNow)($('annWrap'), open);
  }
  $('annOpen').addEventListener('click', () => { renderAnn(); setAnnOpen(true); setTimeout(() => $('annRows').querySelector('input')?.focus({ preventScroll: true }), 200); });
  $('annClose').addEventListener('click', () => { if (edit.draft.annotations.some((a) => a.word.trim() || a.explanation.trim())) mark(); edit.draft.annotations = []; setAnnOpen(false); updateDirty(); });
  function renderAnn(flash = false) {
    const rows = edit.draft.annotations.length ? edit.draft.annotations : [{ word: '', explanation: '' }]; // the blank row is display only until something is typed in it
    const many = rows.length > 1;
    $('annSec').classList.toggle('is-many', many);
    $('annRows').innerHTML = rows.map((a, i) => {
      const matched = !!a.matched, typed = !!a.word.trim();
      return `
      <div class="ann-pair${matched ? ' is-matched' : ''}" data-i="${i}">
        ${many ? `<div class="ann-pair-head"><p>${i + 1}.</p></div>` : ''}
        <div class="fw ann-field${typed && !matched ? ' is-warn' : ''}">
          <input class="field field--word${flash && matched ? ' is-flash' : ''}" type="text" data-f="word" placeholder="Word" value="${esc(a.word)}" autocomplete="off" aria-label="Word ${i + 1}"${matched ? ' readonly' : ''}>
          <button type="button" class="ann-confirm" aria-label="Check the word"${typed && !matched ? '' : ' hidden'}><span class="icon icon-arrow icon-arrow--right"></span></button>
          ${i > 0
            ? `<button type="button" class="ann-unlock ann-remove" aria-label="Remove this word"><span class="icon icon-x"></span></button>`
            : `<button type="button" class="ann-unlock" aria-label="Change the word"${matched ? '' : ' hidden'}><span class="icon icon-x"></span></button>`}
        </div>
        <div class="fold${matched ? ' is-open' : ''}"${matched ? '' : ' hidden'}><div class="fw"><textarea class="field" data-f="explanation" placeholder="Annotation" rows="3" aria-label="Annotation ${i + 1}">${esc(a.explanation)}</textarea></div></div>
      </div>`; }).join('');
    $('annRows').querySelectorAll('textarea').forEach(attachBar);
    $('annRows').querySelectorAll('.ann-field.is-warn').forEach((f) => { f.querySelector('.ann-confirm').hidden = false; }); // an unlocked word can be checked again
    if (flash) setTimeout(() => $('annRows').querySelectorAll('.is-flash').forEach((f) => f.classList.remove('is-flash')), 600);
    $('annAnother').hidden = !(edit.draft.annotations.length && edit.draft.annotations.every((a) => a.matched));
  }
  const rowOf = (el) => { const row = el.closest('.ann-pair'); if (!row) return null; const i = Number(row.dataset.i); if (!edit.draft.annotations[i]) edit.draft.annotations[i] = { word: '', explanation: '', matched: false, at: -1 }; return { row, i, a: edit.draft.annotations[i] }; };
  function confirmWord(row, a) {
    const m = findInQuote(a.word, edit.draft.text, takenBy(edit.draft.annotations.filter((x) => x !== a)));
    mark();
    if (m.at < 0) { a.matched = false; a.at = -1; renderAnn(); row.querySelector('input').focus({ preventScroll: true }); updateDirty(); return; } // warning state, → stays to try again
    a.word = m.text; a.at = m.at; a.matched = true;
    renderAnn(); updateDirty();
    const r = $('annRows').querySelector(`.ann-pair[data-i="${[...row.parentElement.children].indexOf(row)}"]`);
    setTimeout(() => r?.querySelector('textarea')?.focus({ preventScroll: true }), 200);
  }
  $('annRows').addEventListener('input', (e) => {
    const r = rowOf(e.target); if (!r) return;
    mark(`ann${r.i}${e.target.dataset.f}`);
    r.a[e.target.dataset.f] = e.target.value;
    if (e.target.dataset.f === 'word') { const fw = e.target.closest('.ann-field'); fw.classList.remove('is-warn'); fw.querySelector('.ann-confirm').hidden = !e.target.value.trim(); const rm = fw.querySelector('.ann-remove'); if (rm) rm.hidden = !!e.target.value.trim(); }
    updateDirty();
  });
  $('annRows').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.target.dataset.f !== 'word') return;
    e.preventDefault();
    const r = rowOf(e.target); if (r && !r.a.matched && r.a.word.trim()) confirmWord(r.row, r.a);
  });
  $('annRows').addEventListener('click', (e) => {
    const b = e.target.closest('.ann-confirm, .ann-unlock'); if (!b) return;
    const r = rowOf(b); if (!r) return;
    if (b.classList.contains('ann-confirm')) { confirmWord(r.row, r.a); return; }
    mark();
    if (b.classList.contains('ann-remove')) edit.draft.annotations.splice(r.i, 1); // an added row goes, whatever its state
    else { r.a.matched = false; r.a.at = -1; }                                    // row 1: unlock, keep the word to edit
    renderAnn(); updateDirty();
    if (!b.classList.contains('ann-remove')) { const inp = $('annRows').querySelector('input'); inp.focus({ preventScroll: true }); inp.select(); }
  });
  $('annAnother').addEventListener('click', () => {
    mark();
    edit.draft.annotations.push({ word: '', explanation: '', matched: false, at: -1 });
    renderAnn();
    $('annRows').lastElementChild.querySelector('input').focus({ preventScroll: true });
  });

  // Fill every field from the draft (opening a quote, Revert, Auto cleanup).
  function fill(d) {
    $('fText').value = d.text;
    $('fOriginal').value = d.original;
    const hasOrig = !!d.original.trim();
    foldNow($('fOriginalWrap'), hasOrig); $('origToggle').hidden = hasOrig;
    $('catList').querySelectorAll('.chk').forEach((b) => b.setAttribute('aria-checked', String(d.categories.includes(b.dataset.key))));
    $('fName').value = d.author.name; $('fNative').value = d.author.nativeName;
    country.set(d.author.country); foldNow($('fNativeWrap'), NON_LATIN.has(d.author.country));
    kind.set(d.source.kind); year.set(d.source.year);
    const src = !!d.source.kind && d.source.kind !== 'personal';
    foldNow($('fTitleWrap'), src); foldNow($('fLinkWrap'), src);
    $('fTitle').value = d.source.title; $('fLink').value = d.source.link;
    $('fContext').value = d.context; $('fReflection').value = d.reflection; $('fKeptBy').value = d.keptBy;
    ['fOriginal', 'fNative', 'fText', 'fName', 'fTitle'].forEach((id) => cjkSize($(id)));
    renderAnn();
    setAnnOpen(d.annotations.some((a) => a.word.trim() || a.explanation.trim()), false);
    document.querySelectorAll('textarea.field').forEach((ta) => ta.dispatchEvent(new Event('scroll')));
  }

  /* ---------- Auto cleanup ----------
     House style, the same rules as the converter: sentences capitalised, one space, a space after
     punctuation, curly quotes, … for ..., a closing period, common slips fixed. CJK text is only
     trimmed. A field it changed lights up. */
  const TYPOS = { teh: 'the', dont: 'don’t', doesnt: 'doesn’t', didnt: 'didn’t', cant: 'can’t', wont: 'won’t', im: 'I’m', ive: 'I’ve', youre: 'you’re', thats: 'that’s', isnt: 'isn’t', wasnt: 'wasn’t', couldnt: 'couldn’t', wouldnt: 'wouldn’t', shouldnt: 'shouldn’t', havent: 'haven’t', hasnt: 'hasn’t', recieve: 'receive', seperate: 'separate', definately: 'definitely', occured: 'occurred', alot: 'a lot', untill: 'until', wich: 'which', becuase: 'because', i: 'I' };
  function tidy(s, { sentences = true, close = false, typos = true } = {}) {
    if (!s) return s;
    let t = s.replace(/\r/g, '').replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (/[぀-鿿가-힯]/.test(t)) return t;
    t = t.replace(/\.{3}/g, '…')
      .replace(/ +([,.;:!?…])/g, '$1')                      // no space before punctuation
      .replace(/([,;:!?…])(?=[A-Za-z“‘"'(])/g, '$1 ')          // a space after it
      .replace(/(\p{L}{2,})\.(?=\p{Ll})/gu, '$1. ')             // "yet.keep" (not "e.g." or "3.5")
      .replace(/(^|[\s(\[])"/g, '$1“').replace(/"/g, '”')
      .replace(/(^|[\s(\[])'/g, '$1‘').replace(/'/g, '’');
    if (typos) t = t.replace(/\b([A-Za-z]+)\b/g, (w) => { const r = TYPOS[w.toLowerCase()]; if (!r) return w; return (w[0] === w[0].toUpperCase() && w.toLowerCase() !== 'i') ? r[0].toUpperCase() + r.slice(1) : r; });
    if (sentences) t = t.replace(/(^|[.!?…]\s+|\n\s*)(\p{Ll})/gu, (m, a, c) => a + c.toUpperCase());
    if (close && /[\p{L}\p{N}’”)]$/u.test(t)) t += '.';
    return t;
  }
  function cleanup(d) {
    const n = clone(d);
    n.text = tidy(d.text, { close: true });
    n.original = d.original.trim();
    n.context = tidy(d.context, { close: true });
    n.reflection = tidy(d.reflection, { close: true });
    n.annotations = d.annotations.map((a) => ({ word: a.word.trim().replace(/\s+/g, ' '), explanation: tidy(a.explanation, { close: true }) }));
    n.author.name = tidy(d.author.name, { sentences: false, typos: false }).replace(/\b(\p{Ll})(\p{L}*)/gu, (m, a, b) => (m.length > 2 || /^(de|da|di|van|von|le|la|du|bin|al)$/.test(m) ? m : a.toUpperCase() + b)); // no title-casing: "bell hooks" is a name
    n.author.name = d.author.name === d.author.name.toLowerCase() ? d.author.name.trim().replace(/\s+/g, ' ').replace(/(^|\s)(\p{Ll})/gu, (m, s, c) => s + c.toUpperCase()) : n.author.name; // all-lowercase names are capitalised
    n.author.nativeName = d.author.nativeName.trim();
    n.source.title = tidy(d.source.title, { sentences: false, typos: false });
    n.source.title = d.source.title === d.source.title.toLowerCase() ? n.source.title.replace(/(^|\s)(\p{Ll})(?=\p{L}{3,})/gu, (m, s, c) => s + c.toUpperCase()).replace(/^(\p{Ll})/u, (c) => c.toUpperCase()) : n.source.title; // an all-lowercase title gets its long words capitalised
    n.source.link = d.source.link.trim();
    n.keptBy = d.keptBy.trim().replace(/^(\p{Ll})/u, (c) => c.toUpperCase());
    return n;
  }
  $('cleanupBtn').addEventListener('click', () => {
    const before = edit.draft, after = cleanup(before);
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    mark();
    edit.draft = after; followAnn(); fill(after); updateDirty();
    // light up what changed
    const pairs = [['fText', 'text'], ['fContext', 'context'], ['fReflection', 'reflection'], ['fName', 'author.name'], ['fTitle', 'source.title'], ['fKeptBy', 'keptBy']];
    const get = (o, p) => p.split('.').reduce((x, k) => x[k], o);
    const flash = (el) => { el.classList.add('is-flash'); setTimeout(() => el.classList.remove('is-flash'), 600); };
    pairs.forEach(([id, p]) => { if (get(before, p) !== get(after, p)) flash($(id)); });
    after.annotations.forEach((a, i) => { const b = before.annotations[i]; if (b && (a.word !== b.word || a.explanation !== b.explanation)) $('annRows').children[i]?.querySelectorAll('.field').forEach(flash); });
    if (JSON.stringify(after.annotations) !== JSON.stringify(edit.draft.annotations)) after.annotations = edit.draft.annotations;
  });

  /* ---------- Shared bits (same as js/form.js) ---------- */

  const FOLD_MS = 200;
  const foldTimers = new WeakMap();
  function fold(el, open) {
    clearTimeout(foldTimers.get(el));
    if (open) { if (!el.hidden && el.classList.contains('is-open')) return; el.hidden = false; void el.offsetHeight; el.classList.add('is-open'); }
    else { if (el.hidden) return; el.classList.remove('is-open'); foldTimers.set(el, setTimeout(() => { el.hidden = true; }, ms(FOLD_MS))); }
  }
  function foldNow(el, open) { clearTimeout(foldTimers.get(el)); el.style.transition = 'none'; el.hidden = !open; el.classList.toggle('is-open', open); void el.offsetHeight; el.style.transition = ''; }

  // The 2px overlay scrollbar on textareas (the native one is hidden by form.css).
  function attachBar(ta) {
    if (ta.dataset.bar) return; ta.dataset.bar = '1';
    const bar = document.createElement('div'); bar.className = 'fw-bar'; bar.hidden = true; ta.parentElement.appendChild(bar);
    const draw = () => { const { scrollHeight: sh, clientHeight: ch, scrollTop: st, offsetTop: top } = ta; if (sh <= ch + 1) { bar.hidden = true; return; } bar.hidden = false; const h = Math.max(24, (ch / sh) * ch); bar.style.top = `${top + (st / (sh - ch)) * (ch - h)}px`; bar.style.height = `${h}px`; };
    ['scroll', 'input', 'focus'].forEach((ev) => ta.addEventListener(ev, draw, { passive: true }));
    window.addEventListener('resize', draw);
  }
  document.querySelectorAll('textarea.field').forEach(attachBar);

  // Combobox: a text field that filters a list (js/form.js → combo, trimmed).
  function combo(host, { options, placeholder, free = false, onChange }) {
    host.classList.add('combo');
    host.innerHTML = `<input class="field" type="text" placeholder="${placeholder}" autocomplete="off" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-label="${placeholder}">
      <button type="button" class="combo-btn" tabindex="-1" aria-label="Open"><span class="icon icon-chevron"></span></button>`;
    const input = host.querySelector('input'), btn = host.querySelector('.combo-btn'), icon = btn.querySelector('.icon');
    let list = null, bar = null, value = '', hover = -1, shown = [], silent = false;
    const drawBar = () => { if (!list || !bar) return; const { scrollHeight: sh, clientHeight: ch, scrollTop: st, offsetTop: top } = list; if (sh <= ch + 1) { bar.hidden = true; return; } bar.hidden = false; const h = Math.max(24, (ch / sh) * ch); bar.style.top = `${top + (st / (sh - ch)) * (ch - h)}px`; bar.style.height = `${h}px`; };
    const setValue = (v, lbl) => { value = v; input.value = lbl || ''; host.classList.toggle('has-value', !!v); icon.className = 'icon ' + (v ? 'icon-x' : 'icon-chevron'); btn.setAttribute('aria-label', v ? 'Clear' : 'Open'); if (!silent) onChange(v); };
    const close = () => { if (!list) return; list.remove(); list = null; hover = -1; if (bar) { bar.remove(); bar = null; } host.classList.remove('is-open'); input.setAttribute('aria-expanded', 'false'); };
    const render = (q) => {
      const s = q.trim().toLowerCase();
      shown = s ? [...options.filter((o) => o.label.toLowerCase().startsWith(s)), ...options.filter((o) => !o.label.toLowerCase().startsWith(s) && o.label.toLowerCase().includes(s))] : options;
      if (!list) {
        list = document.createElement('div'); list.className = 'combo-list'; list.setAttribute('role', 'listbox');
        list.addEventListener('pointerdown', (e) => e.preventDefault());
        list.addEventListener('click', (e) => { const it = e.target.closest('.combo-item'); if (it) pick(Number(it.dataset.i)); });
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
    const setHover = (i) => { if (!list || !shown.length) return; hover = (i + shown.length) % shown.length; [...list.children].forEach((c, k) => c.classList.toggle('is-hover', k === hover)); list.children[hover]?.scrollIntoView({ block: 'nearest' }); };
    const settle = () => {
      const t = input.value.trim();
      const exact = options.find((o) => o.label.toLowerCase() === t.toLowerCase());
      if (exact) setValue(exact.value, exact.label);
      else if (free && t) setValue(t, t);
      else if (!t) setValue('', '');
      else setValue(value, options.find((o) => o.value === value)?.label || (free ? value : ''));
      close();
    };
    input.addEventListener('focus', () => render(value ? '' : input.value));
    input.addEventListener('click', () => { if (!list) render(value ? '' : input.value); });
    input.addEventListener('input', () => { if (value) { value = ''; host.classList.remove('has-value'); icon.className = 'icon icon-chevron'; onChange(''); } render(input.value); });
    input.addEventListener('blur', settle);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (!list) render(input.value); setHover(hover + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHover(hover - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); if (list && hover >= 0) pick(hover); else if (list && shown.length === 1) pick(0); else settle(); }
      else if (e.key === 'Escape') { e.preventDefault(); settle(); }
      else if (e.key === 'Tab') settle();
    });
    btn.addEventListener('pointerdown', (e) => e.preventDefault());
    btn.addEventListener('click', () => { if (value) { setValue('', ''); input.focus(); render(''); } else if (list) close(); else input.focus(); });
    return { input, set: (v) => { silent = true; const o = options.find((x) => x.value === v); setValue(v, o ? o.label : (free ? v : '')); silent = false; } };
  }

  /* ---------- Touch: swipe a row to the left for its action ---------- */

  if (touch) {
    let drag = null;
    $('rows').addEventListener('touchstart', (e) => {
      const row = e.target.closest('.row'); if (!row || !row.querySelector('.row-swipe')) return;
      drag = { row, x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, moved: false, open: row.classList.contains('is-open') };
      document.querySelectorAll('.row.is-open').forEach((r) => { if (r !== row) r.classList.remove('is-open'); });
    }, { passive: true });
    $('rows').addEventListener('touchmove', (e) => {
      if (!drag) return;
      const dx = e.touches[0].clientX - drag.x, dy = e.touches[0].clientY - drag.y;
      if (!drag.moved) { if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; if (Math.abs(dy) > Math.abs(dx)) { drag = null; return; } drag.moved = true; drag.row.classList.add('is-dragging'); }
      const w = drag.row.querySelector('.row-swipe').offsetWidth;
      drag.dx = Math.max(-w, Math.min(0, (drag.open ? -w : 0) + dx));
      drag.row.querySelector('.row-inner').style.transform = `translateX(${drag.dx}px)`;
      drag.row.querySelector('.row-swipe').style.transform = `translateX(${w + drag.dx}px)`;
    }, { passive: true });
    $('rows').addEventListener('touchend', () => {
      if (!drag) return;
      const { row, dx, moved } = drag; drag = null;
      row.classList.remove('is-dragging');
      row.querySelector('.row-inner').style.transform = ''; row.querySelector('.row-swipe').style.transform = '';
      if (!moved) return;
      const w = row.querySelector('.row-swipe').offsetWidth;
      row.classList.toggle('is-open', -dx > w / 2);
      row.dataset.swiped = '1'; setTimeout(() => { delete row.dataset.swiped; }, 300); // the tap that ends a swipe opens nothing
    });
    $('rows').addEventListener('click', (e) => { const row = e.target.closest('.row'); if (row && row.dataset.swiped) e.stopImmediatePropagation(); }, true);
  }

  /* ---------- Go ---------- */

  load().then(() => { refreshChrome(); route(); });
})();
