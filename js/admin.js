/* Words We Keep — the library (admin CMS). Plain JS.
   Three lists (Live / Pending / Archive) and an edit / review view. Routes (`go`): #live ·
   #pending · #archive · #fonts · #edit/<id>; kept in history.state, never in the address (an
   address with one still opens it, then the address is cleaned). #reset throws the demo data away.

   Data: served by the library's Worker (workers/admin), everything comes from and goes to its
   /api (load() / persist() / publish()), behind the login. Opened anywhere else (the staging
   site, a local preview) it is a demo: the live quotes come from data/quotes.json, pending and
   archived ones are made up here (seed()) and what the admin does is kept in localStorage. */
(() => {
  const STORE_KEY = 'wwk-admin-demo';
  const $ = (id) => document.getElementById(id);
  const admin = $('admin'), scroll = $('scroll');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const touch = window.matchMedia('(hover: none)').matches;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const composing = (e) => e.isComposing || e.keyCode === 229; // a key that belongs to an IME (Safari: the confirming Enter is 229)
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
  // `hint`: what the empty source link field says (the form's, js/form.js; the older kinds follow
  // their nearest form kind). Without one: "Source link".
  const VIDEO_HINT = 'Link to YouTube, Vimeo, or another site';
  const KINDS = [
    { value: 'book', label: 'Book' }, { value: 'film', label: 'Film & TV', hint: VIDEO_HINT }, { value: 'series', label: 'Series', hint: VIDEO_HINT },
    { value: 'song', label: 'Song', hint: 'Link to Apple Music, Spotify, YouTube, or other' }, { value: 'poem', label: 'Poem' }, { value: 'speech', label: 'Speech & interview', hint: VIDEO_HINT },
    { value: 'interview', label: 'Interview', hint: VIDEO_HINT }, { value: 'writing', label: 'Writing' }, { value: 'essay', label: 'Essay' },
    { value: 'letter', label: 'Letter' }, { value: 'scripture', label: 'Scripture' }, { value: 'comic', label: 'Comic' },
    { value: 'artwork', label: 'Artwork' }, { value: 'commercial', label: 'Commercial', hint: VIDEO_HINT }, { value: 'social', label: 'Social media', hint: 'Link to YouTube, TikTok, Instagram, or other' }, { value: 'personal', label: 'Personal' },
    { value: 'other', label: 'Other' },
  ];
  function linkHint(v) {
    const hint = (KINDS.find((k) => k.value === v) || {}).hint || 'Source link';
    $('fLink').placeholder = hint; $('fLink').setAttribute('aria-label', hint);
  }
  const REGION_CODES = ('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' ');
  const regionNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
  // Names the browser's list gets wrong for this site: Apple's says "China mainland".
  const REGION_FIX = { CN: 'China' };
  const regionName = (c) => REGION_FIX[c] || (regionNames ? regionNames.of(c) : c);
  const REGIONS = REGION_CODES.map((c) => ({ value: c, label: regionName(c) })).sort((a, b) => a.label.localeCompare(b.label));
  const NON_LATIN = new Set(('CN TW HK MO JP KR KP MN RU UA BY KZ KG TJ BG MK RS ME BA GE AM GR CY IL IR IQ SA AE KW QA BH OM YE JO SY LB EG LY TN DZ MA MR SD PS AF PK IN BD NP LK BT MM TH LA KH ET ER').split(' '));
  // The quote faces (css/fonts.css), copied from js/app.js: `not` = the length tiers a face is
  // not offered for (none now: every face at every length, Bill 2026-10-03). A quote with no
  // face of its own is Instrument, or Goudy when it is long.
  const FONTS = [
    { value: 'instrument', label: 'Instrument', not: [],
      latin: 'A1-A3 A5 A7-AB AE-B0 B4 B6-B8 BA-BB BF-107 10A-113 116-11B 11E-123 126-127 12A-12B 12E-133 136-137 139-13E 141-148 14A-14D 150-15B 15E-161 164-165 16A-17E 1CD-1CE 218-21B 237 1E80-1E85 1E9E 1EF2-1EF3 2013-2014 2018-201A 201C-201E 2022 2026 2039-203A 20AC' },
    { value: 'story',      label: 'Story',      not: [],
      latin: 'A1-AC AE-B4 B6-13E 141-148 14A-17E 181 186 18A 18E-190 192 197-199 19D 1A0-1A1 1AF-1B0 1B3-1B4 1CD-1DD 1E2-1E3 1E6-1E7 218-21B 232-233 237 245 1E04-1E05 1E0C-1E0F 1E20-1E21 1E24-1E2B 1E32-1E3B 1E40-1E49 1E56-1E5F 1E62-1E63 1E6C-1E6F 1E80-1E85 1E88-1E89 1E8C-1E8F 1E92-1E96 1E9E 1EA0-1EF9 2013-2014 2018-201A 201C-201E 2020-2022 2026 2039-203A 2044 2070 2074-2079 2080-2089 20A1 20A6 20A9-20AC' },
    { value: 'print',      label: 'Print',      not: [],
      latin: 'A1-AC AE-B4 B6-131 134-137 139-13E 141-148 14A-165 168-17E 181 186 18A 18E-190 197-199 19D 1A0-1A1 1AF-1B0 1B3-1B4 1CD-1DD 1E2-1E3 1E6-1E7 218-21B 232-233 237 245 1E04-1E05 1E0C-1E0F 1E20-1E21 1E24-1E2B 1E32-1E3B 1E40-1E49 1E56-1E5F 1E62-1E63 1E6C-1E6F 1E80-1E85 1E88-1E89 1E8C-1E8F 1E92-1E96 1E9E 1EA0-1EF9 2013-2014 2018-201A 201C-201E 2020-2022 2026 2039-203A 2044 2070 2074-2079 2080-2089 20A1 20A6 20A9 20AB-20AC' },
    { value: 'grotesk',    label: 'Grotesk',    not: [],
      latin: 'A1-A3 A5-B4 B6-137 139-148 14A-17E 192 1FC-1FF 218-21B 237 1E80-1E85 1EBC-1EBD 1EF2-1EF3 1EF8-1EF9 2013-2014 2018-201A 201C-201E 2020-2022 2026 2030 2039-203A 2044 20AC' },
    { value: 'round',      label: 'Round',      not: [],
      latin: 'A1-AC AE-B1 B4-B8 BA-113 116-12B 12E-13E 141-148 14A-14D 150-165 168-17E 18F 192 1A0-1A1 1AF-1B0 1E2-1E3 218-21B 237 1E0C-1E0D 1E20-1E21 1E24-1E25 1E2A-1E2B 1E34-1E3B 1E40-1E49 1E5C-1E5F 1E62-1E63 1E6C-1E6F 1E80-1E85 1E8E-1E8F 1E92-1E96 1E9E 1EA0-1EF9 2013-2014 2018-201A 201C-201E 2020 2022 2026 2032-2033 2039-203A 2044 20AC' },
    { value: 'poet',       label: 'Poet',       not: [],
      latin: 'A1-A3 A5 A7 A9-AB AD-AE B0 B2-B3 B9-BB BF-F6 F8-10F 112-121 124-125 128-131 134-137 139-13E 141-148 14C-14F 152-155 158-165 168-16F 172-17E 218-21B 237 1E9E 2013-2014 2018-201A 201C-201E 2022 2039-203A 20AC' },
    { value: 'goudy',      label: 'Goudy',      not: [],
      latin: 'A1-137 139-149 14C-17F 192 218-21B 237 2013-2014 2018-201A 201C-201E 2020 2022 2026 2039-203A 2044 20AC' },
    { value: 'sketch',     label: 'Sketch',     not: [],
      latin: 'A1-B4 B6-12B 12E-149 14C-17E 192 218-21B 237 1E80-1E85 1E9E 2013-2014 2018-201A 201C-201E 2020-2022 2026 2030 2039-203A 2044 20A3-20A4 20AC' },
    { value: 'rose',       label: 'Rose',       not: [],
      latin: 'A1-A9 AB-AC AE-B1 B4 B6-B8 BB BF-DD DF-FD FF-107 10C-10F 112-113 116-11B 122-123 12A-12B 12E-12F 136-137 139-13E 141-148 14C-14D 150-15B 15E-165 16A-16B 16E-17E 1E80-1E85 1E9E 1EF2-1EF3 2013-2014 2018-201A 201C-201E 2020-2022 2026 2030 2039-203A 20AC' },
    { value: 'author',     label: 'Author',     not: [],
      latin: 'A1-A9 AB AE-B1 B4 B6-B8 BB BF-107 10C-113 116-11B 122-123 12A-12B 12E-12F 131-133 136-137 139-13E 141-148 14C-14D 150-15B 15E-165 16A-16B 16E-17E 237 1E80-1E85 1E9E 1EF2-1EF3 2013-2014 2018-201A 201C-201E 2020-2022 2026 2030 2039-203A 20AC' },
    { value: 'fig',       label: 'Fig',       not: [], fresh: true, // fresh = still being tuned: in ink, and first, in the Fonts tab's list
      latin: 'A1-AC AE-B4 B6-127 12A-137 139-148 14A-167 16A-17E 18F 192 1FC-1FF 218-21B 237 1E80-1E85 1E9E 1EF2-1EF3 2013-2014 2018-201A 201C-201E 2020-2022 2026 2030 2039-203A 2044 20A9 20AC' },
    { value: 'stone',     label: 'Stone',     not: [], fresh: true,
      latin: 'A1-A9 AB AE-B1 B4 B6-B8 BB BF-EF F1-107 10A-113 116-11B 11E-123 126-127 12A-12B 12E-131 136-137 139-13E 141-148 14A-14D 150-15B 15E-167 16A-16B 16E-17E 218-21B 1E80-1E85 1EF2-1EF3 2013-2014 2018-201A 201C-201E 2020-2022 2026 2030 2039-203A 20AC' },
    { value: 'rondeau',   label: 'Rondeau',   not: [], fresh: true,
      latin: 'A1-AB AE-B4 B6-148 14A-17E 1E6-1E7 1FC-1FF 218-21B 232-233 237 1E80-1E85 1E9E 1EBC-1EBD 1EF2-1EF3 1EF8-1EF9 2010 2013-2014 2018-201A 201C-201E 2020-2022 2026 2030 2032-2033 2039-203A 2044 2070 2074-2079 2080-2089 20AC' },
  ];
  const FONT_FILES = ['story', 'print', 'grotesk', 'poet', 'sketch', 'rose', 'author', 'fig', 'stone', 'rondeau'];
  // An original-language quote written in Latin letters (Spanish, French, Vietnamese, pinyin…)
  // is set in the quote's own face when the face has every character it needs; anything else —
  // another script, or a letter the face lacks — is set in Noto. `latin`: what a face has beyond
  // ASCII, as hex ranges (made by workers/fonts/tools/coverage.py; the same table is in
  // js/app.js: change both). Poet's missing "…" is dealt with separately.
  const faceChars = new Map();
  function nativeInFace(text, key) {
    const face = FONTS.find((f) => f.value === key);
    if (!face || !text) return false;
    if (!faceChars.has(key)) {
      const has = new Set();
      face.latin.split(' ').forEach((r) => { const [a, b = a] = r.split('-').map((h) => parseInt(h, 16)); for (let c = a; c <= b; c++) has.add(c); });
      faceChars.set(key, has);
    }
    const has = faceChars.get(key);
    return [...text].every((ch) => { const c = ch.codePointAt(0); return /\s/.test(ch) || (c >= 0x20 && c <= 0x7e) || has.has(c) || (ch === '…' && key === 'poet'); });
  }
  function tier(text, cjkWeight = 4) { // js/app.js → tier (2 when sizing the original language)
    const cjk = (text.match(/[぀-ヿ㐀-鿿가-힯]/g) || []).length;
    const weight = text.length + cjk * (cjkWeight - 1);
    return weight <= 64 ? 'l' : weight <= 160 ? 'm' : weight <= 260 ? 's' : 'xs';
  }
  const fontFits = (key, t) => { const f = FONTS.find((x) => x.value === key); return !!f && !f.not.includes(t); };
  const fontFor = (key, t) => (fontFits(key, t) ? key : (t === 's' || t === 'xs' ? 'goudy' : 'instrument'));
  // Languages an original can be in: the code is what the archive's language button shows
  // (中 日 한 for those three, the two letters in capitals for the rest).
  const LANGUAGES = [['zh', 'Chinese'], ['ja', 'Japanese'], ['ko', 'Korean'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['it', 'Italian'], ['pt', 'Portuguese'],
    ['nl', 'Dutch'], ['la', 'Latin'], ['el', 'Greek'], ['ru', 'Russian'], ['uk', 'Ukrainian'], ['pl', 'Polish'], ['cs', 'Czech'], ['hu', 'Hungarian'], ['ro', 'Romanian'],
    ['sv', 'Swedish'], ['da', 'Danish'], ['no', 'Norwegian'], ['fi', 'Finnish'], ['is', 'Icelandic'], ['ga', 'Irish'], ['cy', 'Welsh'], ['ca', 'Catalan'], ['eu', 'Basque'],
    ['tr', 'Turkish'], ['ar', 'Arabic'], ['he', 'Hebrew'], ['fa', 'Persian'], ['ur', 'Urdu'], ['hi', 'Hindi'], ['bn', 'Bengali'], ['ta', 'Tamil'], ['th', 'Thai'],
    ['vi', 'Vietnamese'], ['id', 'Indonesian'], ['ms', 'Malay'], ['tl', 'Tagalog'], ['sw', 'Swahili'], ['eo', 'Esperanto'], ['other', 'Other']]
    .map(([value, label]) => ({ value, label: value === 'other' ? label : `${label} (${value.toUpperCase()})` }));
  const THIS_YEAR = new Date().getFullYear();
  const YEARS = Array.from({ length: THIS_YEAR - 999 }, (_, i) => ({ value: String(THIS_YEAR - i), label: String(THIS_YEAR - i) }));

  /* ---------- Data ---------- */

  let store = null; // { live: [], pending: [], archive: [], lastPublishedAt, publishDirty }
  const API = '/api';
  let remote = false;    // true: the Worker is behind this page
  let rev = 0;           // the Worker's revision of the store; a save from an older one is refused
  let known = new Set(); // keys the Worker has; one that is gone from the store was removed for good
  const allKeys = () => [...store.live, ...store.pending, ...store.archive].map((q) => q.key);
  const isJSON = (r) => (r.headers.get('Content-Type') || '').includes('json');
  const call = (path, method = 'GET', body) => fetch(API + path, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  function adopt(s) {
    rev = s.rev;
    store = { live: s.live, pending: s.pending, archive: s.archive, lastPublishedAt: s.lastPublishedAt, publishDirty: s.publishDirty };
    known = new Set(allKeys());
  }
  // The store as the Worker has it now took over (it changed on another device): what is on
  // screen is drawn again from it.
  function redraw() { if (edit && !findItem(edit.key)) edit = null; if (edit) { refreshChrome(); return; } renderList(); refreshChrome(); route(); }

  // Saving. One request at a time, always the latest store: an action taken while a save is
  // on its way is sent when that one is back.
  let saving = null, again = false;
  function persist() {
    if (!remote) { localStorage.setItem(STORE_KEY, JSON.stringify(store)); return Promise.resolve(); }
    if (saving) { again = true; return saving; }
    saving = send().finally(() => { saving = null; if (again) { again = false; persist(); } });
    return saving;
  }
  async function send() {
    const keys = new Set(allKeys());
    let r;
    try { r = await call('/store', 'PUT', { store, removed: [...known].filter((k) => !keys.has(k)), rev }); } catch (e) { r = null; }
    if (r && r.ok) { rev = (await r.json()).rev; known = keys; return; }
    if (r && r.status === 401) { await signIn(); return send(); }
    if (r && r.status === 409) { adopt((await r.json()).store); redraw(); await ask('The library was changed somewhere else. This is how it stands now.', 'Carry on', 'Close'); return; }
    if (await ask('That could not be saved.', 'Try again', 'Not yet')) return send();
  }
  const nowISO = () => new Date().toISOString();
  const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();

  async function load() {
    const r = await call('/store').catch(() => null);
    if (r && isJSON(r) && (r.ok || r.status === 401)) {
      remote = true;
      if (!r.ok) { await signIn(); return load(); }
      adopt(await r.json());
      return;
    }
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { try { store = JSON.parse(raw); if (store && store.live && store.live.every((q) => q.key)) return; } catch (e) { /* fall through */ } } // no keys = an older demo store: re-seed
    const res = await fetch('../data/quotes.json');
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
  // The view is kept in history.state (Back / Forward step through views) and in sessionStorage
  // (a reload stays put), never in the address: it stays admin.wordswekeep.org. An address that
  // still carries one (#pending, an old bookmark) opens it, then is cleaned.
  const ROUTE_KEY = 'wwk-admin-route';
  const cleanAddress = () => location.pathname + location.search;
  function currentRoute() {
    if (history.state && history.state.route) return history.state.route;
    try { return sessionStorage.getItem(ROUTE_KEY) || 'live'; } catch (e) { return 'live'; }
  }
  function go(to) {
    const h = String(to).replace(/^#/, '') || 'live';
    try { sessionStorage.setItem(ROUTE_KEY, h); } catch (e) {}
    if (!history.state || history.state.route !== h) history.pushState({ route: h }, '', cleanAddress());
    route();
  }
  if (location.hash) { // opened with a route in the address
    const h = location.hash.slice(1);
    try { sessionStorage.setItem(ROUTE_KEY, h); } catch (e) {}
    history.replaceState({ route: h }, '', cleanAddress());
  } else if (!history.state) history.replaceState({ route: currentRoute() }, '', cleanAddress());
  function route() {
    const h = currentRoute();
    try { sessionStorage.setItem(ROUTE_KEY, h); } catch (e) {}
    if (h === 'reset' && !remote) { localStorage.removeItem(STORE_KEY); history.replaceState({ route: 'live' }, '', cleanAddress()); try { sessionStorage.setItem(ROUTE_KEY, 'live'); } catch (e) {} location.reload(); return; }
    const [view, id] = h.split('/');
    if (view === 'edit' && findItem(id)) openEdit(id);
    else if (view === 'fonts') showFonts(id);
    else showList(view in TABS ? view : 'live');
  }
  window.addEventListener('popstate', route);
  // Links are buttons with a data-href, not <a href> (no address strip at the foot of the window
  // on hover; the archive and the form do the same). A click goes there, unless the button's
  // own handler has dealt with it; ⌘ / Ctrl or a middle click opens a new tab.
  const follow = (el, e) => {
    const href = el.dataset.href;
    if (e.metaKey || e.ctrlKey || e.button === 1) window.open(href, '_blank', 'noopener');
    else if (href.startsWith('#')) go(href); // a view of the library (a new tab opens it from the address, then cleans it)
    else location.href = href;
  };
  document.addEventListener('click', (e) => { const el = e.target.closest('[data-href]'); if (el && !e.defaultPrevented) follow(el, e); });
  document.addEventListener('auxclick', (e) => { const el = e.target.closest('[data-href]'); if (el && e.button === 1) follow(el, e); });

  // The list and the edit view cross-fade (--view-ms) and the page scrolls back to the top.
  const VIEWS = { list: 'listView', edit: 'editView', fonts: 'fontsView' };
  let viewTimer = 0;
  function switchView(view) {
    const cur = admin.dataset.view;
    if (cur === view) return Promise.resolve();
    const from = $(VIEWS[cur]), to = $(VIEWS[view]);
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
  const sortState = { live: { key: 'id', dir: -1 }, pending: { key: 'id', dir: -1 }, archive: { key: 'archivedAt', dir: -1 } }; // every list opens newest first
  // A live quote waiting for Publish: "Updated" if the site shows an older version of it, "Not
  // published" if the site does not show it at all (newly approved or put back).
  const unpublished = (q) => (q.dirty ? (q.updated ? 'Updated' : 'Not published') : '');
  const dateOf = { live: (q) => q.dirty ? '' : (q.approvedAt || ''), pending: (q) => q.submittedAt, archive: (q) => q.archivedAt };

  function showList(t) {
    tab = t;
    admin.dataset.tab = t;
    document.querySelectorAll('.tab').forEach((a) => a.classList.toggle('is-active', a.dataset.tab === t));
    $('ctaLive').hidden = t !== 'live'; $('ctaArchive').hidden = t !== 'archive'; $('ctaFonts').hidden = true;
    if (t === 'pending' && store.pending.some((q) => !q.seen)) { store.pending.forEach((q) => { q.seen = true; }); persist(); } // read: the mark goes
    renderList();
    switchView('list');
    refreshChrome();
  }

  function refreshChrome() {
    // How many wait to be reviewed, beside the tab's name: "Pending (3)"; nothing when none (Bill,
    // 2026-10-06; until then a small asterisk said only that some were new).
    $('pendingCount').textContent = store.pending.length ? ` (${store.pending.length})` : '';
    $('publishBtn').disabled = !store.publishDirty;
    $('lastPublished').textContent = store.lastPublishedAt ? `Last published : ${fmtDate(store.lastPublishedAt)}` : 'Never published';
    $('removeAllBtn').disabled = !store.archive.length;
  }

  // The list as shown: sorted, and in Live and Pending narrowed by the search.
  function sorted(t) {
    const { key, dir } = sortState[t];
    const val = (q) => (key === 'id' ? numberOf(q) : (key === 'publishedAt' ? (q.dirty ? '￿' : (q.approvedAt || '')) : (q[key] || '')));
    const terms = t in SEARCH_TABS ? fold_(query).split(/\s+/).filter(Boolean) : [];
    return listOf(t).filter((q) => terms.every((w) => hit(q, t, w))).sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * dir);
  }

  // Search: every word typed must be found in the quote. A number is looked for in the quote's
  // number (from its first digit: "1" finds 1, 10, 11…), as a whole part of its date (9 or 09
  // finds September and the 9th) and at the start of a word; anything with a "/" in the date as
  // shown (09/26, 9/26/26); anything else anywhere in the words: the quote, its original, the
  // author, the source, the categories, who kept it, and "Updated" / "Not published".
  const SEARCH_TABS = { live: 1, pending: 1 };
  let query = '';
  const fold_ = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').toLowerCase().trim();
  function hit(q, t, w) {
    const date = t === 'live' && q.dirty ? '' : fmtDate(dateOf[t](q));
    const words = fold_([q.text, q.originalLanguage && q.originalLanguage.text, q.author && q.author.name, q.author && q.author.nativeName, q.author && q.author.origin && `${q.author.origin} proverb`, q.source && q.source.title, catLabel(q.categories), q.keptBy, t === 'live' ? unpublished(q) : ''].filter(Boolean).join(' \n '));
    if (/^\d+$/.test(w)) return String(numberOf(q)).startsWith(w) || date.split('/').some((p) => Number(p) === Number(w)) || new RegExp(`(^|[^\\d])${w}`).test(words);
    if (w.includes('/')) return date.includes(w) || date.replace(/(^|\/)0/g, '$1').includes(w);
    return words.includes(w);
  }

  function renderList() {
    const items = sorted(tab);
    $('thead').querySelectorAll(':scope > :not(.search)').forEach((el) => el.remove()); // the search stays: redrawing it would drop the caret
    $('search').insertAdjacentHTML('beforebegin', HEADS[tab].map((h) => {
      const label = h.count ? `${h.t} (${items.length})` : (h.short ? `<span class="h-long">${h.t}</span><span class="h-short">${h.short}</span>` : h.t);
      if (h.sort) return `<div class="${h.c}"><button type="button" class="sort" data-key="${h.sort}" data-dir="${sortState[tab].key === h.sort ? sortState[tab].dir : 1}"><span>${label}</span><span class="icon icon-sort"></span></button></div>`;
      return `<div class="${h.c}">${label}</div>`;
    }).join(''));
    const acts = { live: '<button type="button" data-act="edit" aria-label="Edit"><span class="icon icon-edit"></span></button><button type="button" data-act="archive" aria-label="Archive"><span class="icon icon-x16"></span></button>',
                   pending: '<button type="button" data-act="edit" aria-label="Review"><span class="icon icon-eye"></span></button>',
                   archive: '<button type="button" data-act="revert" aria-label="Put back"><span class="icon icon-revert"></span></button><button type="button" data-act="remove" aria-label="Remove"><span class="icon icon-x16"></span></button>' }[tab];
    const swipe = { live: 'archive', pending: '', archive: 'remove' }[tab]; // touch: what a swipe to the left reveals (the archive's Put back is out in the open, in the number column)
    const swipeLabel = { archive: 'Archive', remove: 'Remove' };
    $('rows').style.setProperty('--num-w', `${String(Math.max(0, ...items.map(numberOf))).length}ch`); // every number as wide as the longest, so the ⓘs line up
    items.forEach(checkQuote);
    $('rows').innerHTML = items.map((q) => `
      <div class="row" data-key="${q.key}" tabindex="0">
        <div class="row-inner">
          <p class="c-num num"><span class="num-n">${numberOf(q)}</span>${(issues.get(q.key) || []).length ? ALERT_ICON : ''}</p>
          <p class="c-date num">${tab === 'live' && q.dirty ? unpublished(q) : fmtDate(dateOf[tab](q))}</p>
          <p class="c-cat">${esc(catLabel(q.categories))}</p>
          <p class="c-quote">${esc(q.text)}</p>
          <div class="c-act">${acts}</div>
        </div>
        ${swipe ? `<button type="button" class="row-swipe" data-act="${swipe}">${swipeLabel[swipe]}</button>` : ''}
      </div>`).join('');
    $('empty').hidden = items.length > 0;
    $('empty').textContent = listOf(tab).length ? 'Nothing found.' : { live: 'Nothing live yet.', pending: 'Nothing waiting.', archive: 'The archive is empty.' }[tab];
  }

  // The search button opens the field beside it (--search-ms) and closes it again; closing
  // empties it, so a list is never narrowed by words that are out of sight. Escape closes too.
  function setSearch(open) {
    const field = $('searchField');
    $('search').classList.toggle('is-open', open);
    $('searchBtn').setAttribute('aria-expanded', open);
    field.tabIndex = $('searchEnd').tabIndex = open ? 0 : -1;
    if (open) { field.focus({ preventScroll: true }); return; }
    field.blur();
    if (query) { field.value = ''; search(); }
  }
  function search() {
    query = $('searchField').value;
    $('search').classList.toggle('is-filled', !!query);
    renderList();
    scroll.scrollTop = 0;
  }
  $('searchBtn').addEventListener('click', () => setSearch(!$('search').classList.contains('is-open')));
  $('searchField').addEventListener('input', search);
  $('searchField').addEventListener('keydown', (e) => {
    if (composing(e)) return;
    if (e.key === 'Escape') { e.preventDefault(); setSearch(false); $('searchBtn').focus({ preventScroll: true }); }
    if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } // a phone's keyboard goes away
  });
  $('searchEnd').addEventListener('click', () => { const f = $('searchField'); if (f.value) { f.value = ''; search(); } f.focus({ preventScroll: true }); });

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
    if (tab !== 'archive') go(`#edit/${key}`);
  });
  $('rows').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const row = e.target.closest('.row'); if (row && tab !== 'archive') go(`#edit/${row.dataset.key}`);
  });

  // A row goes: fades out, then the list re-renders without it.
  function leaveRow(row, then) {
    row.classList.add('is-leaving');
    setTimeout(() => { then(); renderList(); refreshChrome(); }, ms(150));
  }
  async function doAction(act, key, row) {
    if (act === 'edit') { go(`#edit/${key}`); return; }
    if (act === 'archive') { leaveRow(row, () => archiveItem(key)); toast('Archived'); }
    if (act === 'revert') { // it goes back onto the site (or into the queue): worth a second look
      const f = findItem(key); const to = f && f.q.archivedFrom === 'live' ? 'live' : 'pending';
      if (await ask(`Put this quote back in ${to === 'live' ? 'Live' : 'Pending'}?`, 'Put back', 'Not yet')) { leaveRow(row, () => revertItem(key)); toast('Put back'); }
    }
    if (act === 'remove') { leaveRow(row, () => { take(key); persist(); }); toast('Removed'); } // one click: it was archived already
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
    const q = { ...f.q }; delete q.archivedAt; delete q.archivedFrom; delete q.updated;
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
  // Publish: the live list becomes the site — the Worker commits it as data/quotes.json. In
  // the demo it only stamps the dates and logs what would be sent.
  async function publish() {
    if (remote) {
      $('publishBtn').disabled = true;
      await persist(); // whatever is still on its way goes first
      let r;
      try { r = await call('/publish', 'POST', { rev }); } catch (e) { r = null; }
      if (r && r.status === 401) { await signIn(); return publish(); }
      if (r && (r.ok || r.status === 409)) { adopt((await r.json()).store); if (r.ok) toast('Published'); }
      else await ask('That could not be published. Nothing on the site changed.', 'Close', 'Not yet');
      renderList(); refreshChrome();
      return;
    }
    const t = nowISO();
    store.live.forEach((q) => { if (q.dirty) { q.dirty = false; delete q.updated; q.approvedAt = q.approvedAt || t; q.publishedAt = t; } });
    store.publishDirty = false; store.lastPublishedAt = t;
    persist();
    console.log('[library] publish →', store.live.map(({ dirty, updated, seen, publishedAt, ...q }) => q));
    renderList(); refreshChrome();
    toast('Published');
  }
  $('publishBtn').addEventListener('click', publish);
  $('removeAllBtn').addEventListener('click', async () => {
    if (!(await ask('Are you sure you want to remove all quotes?', 'Remove', 'Not yet'))) return;
    store.archive = []; persist(); renderList(); refreshChrome();
    toast('Removed');
  });

  /* ---------- Login ---------- */

  // Shows the login over the library; done once the Worker took the password. The password
  // goes to the Worker and nowhere else; what comes back is a cookie this script cannot read.
  let signingIn = null;
  function signIn() {
    if (signingIn) return signingIn;
    const login = $('login'), field = $('fPassword'), wrap = $('fPasswordWrap');
    const warn = (text) => { field.value = ''; field.placeholder = text; wrap.classList.add('is-warn'); $('enterBtn').disabled = false; field.focus({ preventScroll: true }); };
    login.hidden = false; login.classList.remove('is-out');
    field.value = ''; field.placeholder = 'Password'; wrap.classList.remove('is-warn');
    field.focus({ preventScroll: true });
    signingIn = new Promise((done) => {
      field.oninput = () => { if (wrap.classList.contains('is-warn')) { wrap.classList.remove('is-warn'); field.placeholder = 'Password'; } };
      login.onsubmit = async (e) => {
        e.preventDefault();
        if (!field.value) { warn('Password'); return; }
        $('enterBtn').disabled = true;
        let r;
        try { r = await call('/login', 'POST', { password: field.value }); } catch (err) { r = null; }
        if (!r || !r.ok) { warn(!r ? 'No connection' : r.status === 429 ? 'Too many tries, wait 15 minutes' : 'Wrong password'); return; }
        field.value = ''; $('enterBtn').disabled = false; field.blur();
        login.classList.add('is-out');
        setTimeout(() => { login.hidden = true; }, ms(300));
        signingIn = null;
        done();
      };
    });
    return signingIn;
  }

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

  /* ---------- Toast (Figma 314:5664) ----------
     A word at the bottom of the window once an action is done: fades up (--toast-ms), stays
     TOAST_STAY_MS, fades down. A new one replaces the one on screen. */
  const TOAST_STAY_MS = 2000;
  let toastTimer = 0;
  function toast(text) {
    const el = $('toast');
    clearTimeout(toastTimer);
    el.textContent = text;
    el.hidden = false;
    void el.offsetHeight;
    el.classList.add('is-in');
    toastTimer = setTimeout(() => {
      el.classList.remove('is-in');
      toastTimer = setTimeout(() => { el.hidden = true; }, ms(300));
    }, ms(300) + TOAST_STAY_MS);
  }

  /* ---------- The edit view ---------- */

  let edit = null; // { id, tab, draft, orig }
  const toDraft = (q) => ({
    text: q.text || '', original: q.originalLanguage ? q.originalLanguage.text : '', lang: q.originalLanguage ? q.originalLanguage.lang : '',
    categories: [...q.categories],
    author: { kind: q.author?.kind || 'person', name: q.author?.name || '', nativeName: q.author?.nativeName || '', country: q.author?.country || '', origin: q.author?.origin || '' },
    source: { kind: q.source?.kind || '', year: q.source?.year ? String(q.source.year) : '', title: q.source?.title || '', link: q.source?.link || '', cover: q.source?.cover || '', crop: q.source?.crop ? { ...q.source.crop } : null },
    context: q.context || '', annotations: q.annotations.map((a) => ({ word: a.word, explanation: a.explanation, matched: false, at: -1 })),
    reflection: q.reflection || '', keptBy: q.keptBy || '',
    font: fontFor(q.font, tier(q.text || '')), // the face the archive shows it in
    notFirst: !!q.notFirst, // "Don't show as the first quote"
  });
  function fromDraft(d, q) {
    const t = (s) => s.trim();
    const hasSource = !!d.source.kind && d.source.kind !== 'personal';
    q.text = t(d.text);
    q.originalLanguage = t(d.original) ? { lang: d.lang || detectLang(d.original), text: t(d.original) } : null;
    q.categories = CATEGORIES.map((c) => c.key).filter((k) => d.categories.includes(k));
    const named = ['person', 'acquaintance', 'self'].includes(d.author.kind); // who said it: only the fields its kind has (as the form sends)
    q.author = { kind: d.author.kind || 'person', name: named ? t(d.author.name) || null : null, nativeName: d.author.kind === 'person' && NON_LATIN.has(d.author.country) ? (t(d.author.nativeName) || null) : null,
      country: named ? d.author.country || null : null, origin: d.author.kind === 'saying' ? t(d.author.origin) || null : null };
    q.source = (d.source.kind || d.source.year || d.source.title || d.source.link)
      ? { title: hasSource ? (t(d.source.title) || null) : null, year: d.source.year ? Number(d.source.year) : null, kind: d.source.kind || null, link: hasSource ? (t(d.source.link) || null) : null }
      : null;
    if (q.source && d.source.kind === 'book' && t(d.source.cover || '')) q.source.cover = t(d.source.cover); // a book's cover: only ever present when picked
    if (q.source && q.source.link && d.source.crop && videoKey(q.source.link)) q.source.crop = { ...d.source.crop }; // a video's thumbnail window: only ever present when cropped
    q.context = t(d.context) || null;
    q.annotations = d.annotations.filter((a) => a.matched && a.word.trim()).map((a) => ({ word: a.word.trim(), explanation: a.explanation.trim() })); // locked rows only
    q.reflection = t(d.reflection);
    q.keptBy = t(d.keptBy) || null;
    q.font = d.font;
    if (d.notFirst) q.notFirst = true; else delete q.notFirst; // only ever present when set
    return q;
  }
  // The language of the original words, as a two-letter code. Other scripts are told apart by
  // their letters. Latin script is guessed from its commonest words and letters (LATIN_HINTS);
  // no clear winner = 'other'. The library shows the guess and lets the admin correct it.
  // (The same function is in js/form.js and js/admin.js: change both.)
  const LATIN_HINTS = {
    es: [' el ', ' la ', ' los ', ' las ', ' que ', ' y ', ' en ', ' un ', ' una ', ' no ', ' se ', ' es ', ' por ', ' con ', 'ñ', '¿', '¡'],
    fr: [' le ', ' la ', ' les ', ' des ', ' est ', ' et ', ' un ', ' une ', ' que ', ' pas ', ' ne ', ' je ', ' dans ', 'ç', 'œ', ' l’', ' d’', ' qu’', " l'", " d'"],
    de: [' der ', ' die ', ' das ', ' und ', ' ist ', ' nicht ', ' ein ', ' eine ', ' ich ', ' zu ', ' den ', ' mit ', 'ß', 'ü', 'ä'],
    it: [' il ', ' che ', ' non ', ' è ', ' di ', ' per ', ' un ', ' una ', ' gli ', ' sono ', ' della ', ' e ', ' più '],
    pt: [' o ', ' os ', ' que ', ' não ', ' um ', ' uma ', ' é ', ' do ', ' da ', ' em ', ' para ', ' com ', 'ã', 'õ'],
    nl: [' de ', ' het ', ' een ', ' en ', ' van ', ' niet ', ' is ', ' dat ', ' ik ', ' je ', 'ij'],
    la: [' et ', ' est ', ' non ', ' in ', ' ad ', ' qui ', ' quod ', ' sed ', ' ut ', ' cum ', 'ae', 'um '],
    vi: ['ơ', 'ư', 'đ', 'ạ', 'ả', 'ấ', 'ề', 'ệ', 'ộ', 'ữ', ' không ', ' là ', ' của '],
    pl: ['ł', 'ż', 'ś', 'ć', 'ę', 'ą', ' nie ', ' się ', ' jest ', ' to '],
    tr: ['ş', 'ğ', 'ı', ' bir ', ' ve ', ' bu ', ' için ', ' değil '],
  };
  function detectLang(text) {
    if (/[\u3040-\u30ff]/.test(text)) return 'ja';
    if (/[\uac00-\ud7af]/.test(text)) return 'ko';
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
    if (/[\u0400-\u04ff]/.test(text)) return 'ru';
    if (/[\u0600-\u06ff]/.test(text)) return 'ar';
    if (/[\u0590-\u05ff]/.test(text)) return 'he';
    if (/[\u0e00-\u0e7f]/.test(text)) return 'th';
    if (/[\u0370-\u03ff\u1f00-\u1fff]/.test(text)) return 'el';
    if (/[\u0900-\u097f]/.test(text)) return 'hi';
    const t = ` ${text.toLowerCase().replace(/[.,;:!?"“”«»()\n]/g, ' ').replace(/\s+/g, ' ')} `;
    const scores = Object.entries(LATIN_HINTS).map(([code, hints]) => [code, hints.reduce((n, h) => n + (t.split(h).length - 1), 0)]).sort((a, b) => b[1] - a[1]);
    return scores[0][1] >= 2 && scores[0][1] > scores[1][1] ? scores[0][0] : 'other';
  }

  // Compared without empty annotation pairs (the blank pair the view shows is not a change).
  const norm = (d) => JSON.stringify({ ...d, annotations: d.annotations.filter((a) => a.word.trim() || a.explanation.trim()).map((a) => ({ word: a.word, explanation: a.explanation })) });
  const isDirty = () => !!edit && norm(edit.draft) !== norm(edit.orig);
  function updateDirty() {
    const d = isDirty(), ok = checkAnn() && checkFont();
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
    const re = new RegExp((/^[\p{L}\p{N}]/u.test(w) && /[a-z0-9]$/i.test(w) ? '(^|[^\\p{L}\\p{N}])' : '()') + w.split(' ').map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+') + (/[a-z0-9]$/i.test(w) ? '(?![\\p{L}\\p{N}])' : ''), 'gu');
    const free = (a, b) => !taken.some(([s0, s1]) => a < s1 && b > s0);
    let m;
    while ((m = re.exec(hay))) { const at = m.index + m[1].length, end = m.index + m[0].length; if (free(at, end)) return { at, text: q.slice(at, end) }; if (end === at) re.lastIndex++; } // m[1]: the character before the word, matched rather than looked behind for (lookbehind needs Safari 16.4)
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
  let stepDir = 0; // set by the arrows before the route changes: +1 next, −1 previous
  async function openEdit(key) {
    const f = findItem(key); if (!f) return;
    if (f.tab === 'archive') { go('#archive'); return; }
    const stepping = admin.dataset.view === 'edit' && stepDir !== 0;
    const view = $('editView');
    if (stepping) { view.style.setProperty('--dir', stepDir); view.classList.add('is-stepping-out'); await new Promise((r) => setTimeout(r, ms(STEP_MS))); }
    edit = { key, tab: f.tab, draft: toDraft(f.q), orig: null, undo: [], redo: [], mark: null, linkWarned: new Set() }; // linkWarned: links already taken out once (js: linkFieldHealth)
    relockAnn(edit.draft);
    edit.langPicked = !!edit.draft.lang && edit.draft.lang !== 'other'; // a stored language is kept; 'other' is guessed again as the words change
    edit.orig = clone(edit.draft);
    admin.dataset.kind = f.tab;
    tab = f.tab;
    $('backBtn').dataset.href = `#${f.tab}`;
    $('editNo').textContent = `No. ${numberOf(f.q)}`;
    $('editDate').textContent = f.tab === 'live' ? (f.q.dirty || !f.q.approvedAt ? unpublished(f.q) || 'Not published' : `Published: ${fmtDate(f.q.approvedAt)}`) : `Submitted: ${fmtDate(f.q.submittedAt)}`;
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
    go(hash);
  }
  $('backBtn').addEventListener('click', (e) => { e.preventDefault(); leaveTo($('backBtn').dataset.href); });
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
    if (!f.q.dirty) f.q.updated = true; // on the site as it was: an update, not a new quote
    f.q.dirty = true; store.publishDirty = true;
    edit.orig = clone(edit.draft);
    persist(); updateDirty(); refreshChrome();
    $('editDate').textContent = unpublished(f.q);
    toast('Saved');
  }
  // The Save button saves and goes back to the list the quote was opened from (as Approve and
  // Archive do); ⌘S saves and stays, for carrying on with the same quote.
  $('saveBtn').addEventListener('click', () => {
    if (!edit) return;
    const back = `#${edit.tab}`;
    saveEdit();
    edit = null;
    go(back);
  });
  $('approveBtn').addEventListener('click', () => {
    const f = findItem(edit.key); if (!f) return;
    fromDraft(edit.draft, f.q);
    approveItem(edit.key);
    toast('Approved');
    edit = null; go('#pending');
  });
  $('archiveBtn').addEventListener('click', () => {
    const f = findItem(edit.key); if (!f) return;
    fromDraft(edit.draft, f.q);
    archiveItem(edit.key);
    toast('Archived');
    edit = null; go('#pending');
  });
  $('revertBtn').addEventListener('click', () => { if (!isDirty()) return; mark(); edit.draft = clone(edit.orig); fill(edit.draft); updateDirty(); });

  /* ---------- Fields ---------- */

  const bind = (id, set) => $(id).addEventListener('input', (e) => { mark(id); set(e.target.value); updateDirty(); });
  // Typed text in its own script's font (Bill, 2026-10-07), as the archive sets typed text: every
  // field has Crimson Pro first and then each script's Noto (css: --font-field), so the browser
  // takes each letter from the first font that has it — "The Analects 論語" works. Traditional
  // Chinese takes Noto Sans TC, Japanese JP, Korean KR (data-cjk). And every field reads in the
  // direction of what is typed (dir="auto").
  // The same helper is in js/form.js: change both.
  function fieldLook(el) {
    const v = el.value || '';
    const look = /[぀-ヿ]/.test(v) ? 'jpan' : /[가-힯ᄀ-ᇿ㄰-㆏]/.test(v) ? 'kore' : /[㐀-鿿]/.test(v) && isHant(v) ? 'hant' : '';
    if (look) el.dataset.cjk = look; else delete el.dataset.cjk;
  }
  const typedFields = () => document.querySelectorAll('input.field[type="text"], textarea.field');
  typedFields().forEach((f) => { f.dir = 'auto'; });
  document.addEventListener('input', (e) => { if (e.target.matches && e.target.matches('input.field[type="text"], textarea.field')) { e.target.dir = 'auto'; fieldLook(e.target); } });
  // Each script at the archive's size, letter by letter, in any field (Bill, 2026-10-07: 松 in an
  // English context, 一席话 in an annotation came out at full size). A field can't size single
  // letters, so its Noto fonts are copies drawn smaller: the page reads Google's @font-face rules
  // and adds them again as "Field Noto …" with size-adjust — Chinese, Japanese, Korean at the
  // site's 80% (--quote-native-scale), every other script at the script scale (--script-scale):
  // Greek and Cyrillic in Noto Serif (ahead of Crimson Pro, as the archive sets them), Arabic,
  // Hebrew, Thai, Devanagari, and the Notos of the other scripts someone may type (fetched here:
  // the pages don't load them). Only each script's own letters are copied — Latin stays Crimson
  // Pro at full size. Nothing changes size while typing: while a piece of one loads, its letter
  // shows in a system font at the same scale (form.css: Field Local), never at full size; those
  // stand in for good if Google can't be read. The same copies are made in js/form.js: change both.
  (function fieldFonts() {
    const CJK = ['Noto Sans SC', 'Noto Sans TC', 'Noto Sans JP', 'Noto Sans KR'];
    const SCRIPT = ['Noto Serif', 'Noto Sans Arabic', 'Noto Sans Hebrew', 'Noto Sans Thai', 'Noto Sans Devanagari', // (as the archive: nativeRuns)
      'Noto Sans Bengali', 'Noto Sans Tamil', 'Noto Sans Telugu', 'Noto Sans Kannada', 'Noto Sans Malayalam', 'Noto Sans Gujarati', 'Noto Sans Gurmukhi', 'Noto Sans Oriya', 'Noto Sans Sinhala', 'Noto Sans Georgian', 'Noto Sans Armenian', 'Noto Sans Ethiopic', 'Noto Sans Khmer', 'Noto Sans Lao', 'Noto Sans Myanmar']; // (any other script someone may type)
    const root = getComputedStyle(document.documentElement);
    const scaleOf = (fam) => (CJK.includes(fam) ? parseFloat(root.getPropertyValue('--quote-native-scale')) || 0.8 : SCRIPT.includes(fam) ? parseFloat(root.getPropertyValue('--script-scale')) || 0.78 : 0);
    const hrefs = [...document.querySelectorAll('link[href*="fonts.googleapis.com/css2"]')].map((l) => l.href);
    const missing = [...CJK, ...SCRIPT].filter((fam) => !hrefs.some((h) => h.includes(`family=${fam.replace(/ /g, '+')}:`) || h.includes(`family=${fam.replace(/ /g, '+')}&`)));
    if (missing.length) hrefs.push(`https://fonts.googleapis.com/css2?${missing.map((fam) => `family=${fam.replace(/ /g, '+')}`).join('&')}&display=swap`);
    Promise.all(hrefs.map((h) => fetch(h).then((r) => (r.ok ? r.text() : '')).catch(() => ''))).then((sheets) => {
      const faces = [];
      for (const [, subset = '', body] of sheets.join('\n').matchAll(/(?:\/\*\s*([^*]*?)\s*\*\/\s*)?@font-face\s*\{([^}]*)\}/g)) {
        const fam = (body.match(/font-family:\s*'([^']+)'/) || [])[1], scale = scaleOf(fam);
        if (!scale || /^(latin|vietnamese)/.test(subset)) continue; // (Latin stays Crimson Pro, at full size)
        if (fam === 'Noto Serif' && !/^(cyrillic|greek)/.test(subset)) continue;
        faces.push(`@font-face {${body.replace(`'${fam}'`, `'Field ${fam}'`)}  size-adjust: ${Math.round(scale * 100)}%;\n}`);
      }
      if (!faces.length) return;
      const style = document.createElement('style');
      style.textContent = faces.join('\n');
      document.head.appendChild(style);
    });
  })();
  bind('fText', (v) => { edit.draft.text = v; followAnn(); drawFont(); });
  // The language is guessed from the words until the admin picks one; a picked language stays.
  bind('fOriginal', (v) => { edit.draft.original = v; if (!edit.langPicked) { edit.draft.lang = v.trim() ? detectLang(v) : ''; lang.set(edit.draft.lang); } drawFont(); });
  bind('fName', (v) => { edit.draft.author.name = v; clearTimeout(drawCovers.t); drawCovers.t = setTimeout(drawCovers, 600); clearTimeout(autoSong.t); autoSong.t = setTimeout(autoSong, 600); });
  bind('fNative', (v) => { edit.draft.author.nativeName = v; });
  bind('fTitle', (v) => { edit.draft.source.title = v; clearTimeout(drawCovers.t); drawCovers.t = setTimeout(drawCovers, 600); clearTimeout(autoSong.t); autoSong.t = setTimeout(autoSong, 600); }); // (a book: its covers are looked for again once the typing pauses; a song: its link)
  bind('fLink', (v) => { const was = videoKey(edit.draft.source.link); edit.draft.source.link = v; if (edit.draft.source.crop && videoKey(v) !== was) edit.draft.source.crop = null; /* (another video: its crop goes) */ if ($('fLink').closest('.fw').classList.contains('is-warn')) warnLink(''); clearTimeout(drawVideo.t); drawVideo.t = setTimeout(drawVideo, 400); }); // (the preview follows once the typing pauses)
  $('fLink').addEventListener('change', linkFieldHealth); // the check: on leaving the field
  bind('fContext', (v) => { edit.draft.context = v; });
  bind('fReflection', (v) => { edit.draft.reflection = v; });
  bind('fKeptBy', (v) => { edit.draft.keptBy = v; });

  // "In original language +" adds the second field; it stays as long as there is text in it.
  $('origToggle').addEventListener('click', () => { mark(); fold($('fOriginalWrap'), true); $('origToggle').hidden = true; setTimeout(() => $('fOriginal').focus({ preventScroll: true }), 200); });
  // The × on the original-language field: the words go, the field folds shut, the "+" is back.
  $('origClose').addEventListener('click', () => { mark(); edit.draft.original = ''; edit.draft.lang = ''; edit.langPicked = false; lang.set(''); $('fOriginal').value = ''; fold($('fOriginalWrap'), false); $('origToggle').hidden = false; drawFont(); updateDirty(); });

  $('catList').innerHTML = CATEGORIES.map((c) => `
    <button type="button" class="chk" role="checkbox" aria-checked="false" data-key="${c.key}">
      <span class="chk-box" aria-hidden="true"><span class="icon icon-check"></span></span><span>${c.name}</span>
    </button>`).join('');
  $('fNotFirst').addEventListener('click', () => { // "Don't show as the first quote"
    mark();
    edit.draft.notFirst = !edit.draft.notFirst;
    $('fNotFirst').setAttribute('aria-checked', String(edit.draft.notFirst));
    updateDirty();
  });
  $('catList').addEventListener('click', (e) => {
    const b = e.target.closest('.chk'); if (!b) return;
    const k = b.dataset.key, on = !edit.draft.categories.includes(k);
    mark();
    edit.draft.categories = on ? [...edit.draft.categories, k] : edit.draft.categories.filter((x) => x !== k);
    b.setAttribute('aria-checked', String(on));
    coverGround();
    updateDirty();
  });

  const country = combo($('fCountry'), { options: REGIONS, placeholder: 'Country or region', onChange: (v) => { if (!edit) return; mark('country'); edit.draft.author.country = v; fold($('fNativeWrap'), edit.draft.author.kind === 'person' && NON_LATIN.has(v)); updateDirty(); } });
  // Who said it, as on the form (js/form.js → WHO, ORIGINS: keep the lists in step): the fields
  // follow the kind; a saying is where it is from ("Chinese" → "Chinese proverb" on the site).
  const WHO = [{ value: 'person', label: 'A known person', name: 'Author' }, { value: 'acquaintance', label: 'Someone I know', name: 'A friend' },
    { value: 'self', label: 'Myself', name: 'First name' }, { value: 'saying', label: 'A saying or proverb' }, { value: 'unknown', label: 'Not sure' }];
  const ORIGINS = ['African', 'Afghan', 'Albanian', 'American', 'Arabic', 'Armenian', 'Aboriginal Australian', 'Bengali', 'Brazilian', 'Buddhist',
    'Bulgarian', 'Burmese', 'Cambodian', 'Chinese', 'Croatian', 'Czech', 'Danish', 'Dutch', 'English', 'Estonian', 'Ethiopian', 'Filipino',
    'Finnish', 'French', 'Georgian', 'German', 'Ghanaian', 'Greek', 'Hawaiian', 'Hebrew', 'Hungarian', 'Icelandic', 'Igbo', 'Indian',
    'Indonesian', 'Irish', 'Italian', 'Jamaican', 'Japanese', 'Jewish', 'Kenyan', 'Korean', 'Kurdish', 'Latin', 'Latvian', 'Lithuanian',
    'Malay', 'Māori', 'Mexican', 'Mongolian', 'Native American', 'Nepali', 'Nigerian', 'Norwegian', 'Persian', 'Polish', 'Portuguese',
    'Punjabi', 'Romanian', 'Russian', 'Sanskrit', 'Scottish', 'Serbian', 'Slovak', 'Somali', 'Spanish', 'Sufi', 'Swahili', 'Swedish',
    'Tamil', 'Thai', 'Tibetan', 'Turkish', 'Ukrainian', 'Vietnamese', 'Welsh', 'Yiddish', 'Yoruba', 'Zen', 'Zulu']
    .sort((a, b) => a.localeCompare(b)).map((o) => ({ value: o, label: o }));
  function showWho(kind, now = false) {
    const w = WHO.find((x) => x.value === kind) || WHO[0], f = now ? foldNow : fold;
    $('fName').placeholder = w.name || 'Author'; $('fName').setAttribute('aria-label', w.name || 'Author');
    f($('fNameRowWrap'), !!w.name);
    f($('fNativeWrap'), kind === 'person' && NON_LATIN.has(edit ? edit.draft.author.country : ''));
    f($('fOriginWrap'), kind === 'saying');
  }
  const who = combo($('fWho'), { options: WHO, placeholder: 'Who said or wrote it', keep: true, select: true, onChange: (v) => { if (!edit || !v || edit.draft.author.kind === v) return; mark('who'); edit.draft.author.kind = v; showWho(v); updateDirty(); autoSong(); } });
  const origin = combo($('fOrigin'), { options: ORIGINS, placeholder: 'Where is it from', free: true, onChange: (v) => { if (!edit) return; mark('origin'); edit.draft.author.origin = v; updateDirty(); } });
  const kind = combo($('fKind'), { options: KINDS, placeholder: 'Source category', onChange: (v) => { linkHint(v); if (!edit) return; mark('kind'); edit.draft.source.kind = v; showSourceFields(!!v && v !== 'personal'); updateDirty(); autoSong(); } });
  const lang = combo($('fLang'), { options: LANGUAGES, placeholder: 'Language', onChange: (v) => {
    if (!edit) return;
    mark('lang');
    edit.langPicked = !!v;
    edit.draft.lang = v || (edit.draft.original.trim() ? detectLang(edit.draft.original) : ''); // cleared: back to the guess
    if (!v && edit.draft.lang) setTimeout(() => { if (edit && !edit.langPicked && document.activeElement !== lang.input) lang.set(edit.draft.lang); }, 0);
    updateDirty();
  } });
  /* The quote's face: a checkbox row per face (in the Fonts tab's order of FONTS), one chosen at a
     time (Bill, 2026-10-05: a dropdown was hard to choose from while watching the preview). Every
     row is one width — the longest name's, with its box and padding — and the rows fill as few
     even lines as the width allows (13 faces: 7 + 6 on a desktop). A face not drawn for this
     length (`not`) is greyed out. */
  $('fFont').innerHTML = FONTS.map((f) => `
    <button type="button" class="chk" role="radio" aria-checked="false" data-key="${f.value}">
      <span class="chk-box" aria-hidden="true"><span class="icon icon-check"></span></span><span>${esc(f.label)}</span>
    </button>`).join('');
  function layoutFonts() {
    const grid = $('fFont'), opts = [...grid.querySelectorAll('.chk')];
    if (!grid.clientWidth || !opts.length) return;
    const cs = getComputedStyle(opts[0]), ctx = (layoutFonts.c = layoutFonts.c || document.createElement('canvas').getContext('2d'));
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const name = Math.max(...FONTS.map((f) => ctx.measureText(f.label).width));
    const box = opts[0].querySelector('.chk-box').offsetWidth, gap = parseFloat(cs.columnGap) || parseFloat(cs.gap) || 10;
    const need = Math.ceil(name + box + gap + 2 * parseFloat(cs.paddingLeft) + 2); // one row, nothing cut
    const between = parseFloat(getComputedStyle(grid).columnGap) || 1;
    const fit = Math.max(1, Math.floor((grid.clientWidth + between) / (need + between)));
    const rows = Math.ceil(opts.length / fit), cols = Math.ceil(opts.length / rows); // even lines
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    opts.forEach((b) => { b.style.gridColumn = ''; });
    const empty = rows * cols - opts.length; // the last line's empty places: the last face stretches over them (Bill), so the block stays whole
    if (empty) opts[opts.length - 1].style.gridColumn = `span ${empty + 1}`;
  }
  new ResizeObserver(layoutFonts).observe($('fFont'));
  if (document.fonts) document.fonts.ready.then(layoutFonts);
  // A phone (under 600): the dropdown it was, in place of the rows (Bill, 2026-10-05); the two
  // are kept in step.
  const fontDrop = combo($('fFontDrop'), { options: () => FONTS.filter((f) => !edit || !f.not.includes(tier(edit.draft.text))), placeholder: 'Font', keep: true, onChange: (v) => { if (!edit || !v || edit.draft.font === v) return; mark('font'); edit.draft.font = v; font.set(v); drawFont(); updateDirty(); } });
  const font = {
    set(v) {
      fontDrop.set(v);
      const t = edit ? tier(edit.draft.text) : 'm';
      $('fFont').querySelectorAll('.chk').forEach((b) => {
        b.setAttribute('aria-checked', String(b.dataset.key === v));
        b.setAttribute('aria-disabled', String(FONTS.find((f) => f.value === b.dataset.key).not.includes(t)));
      });
    },
  };
  $('fFont').addEventListener('click', (e) => {
    const b = e.target.closest('.chk');
    if (!b || !edit || b.getAttribute('aria-disabled') === 'true' || edit.draft.font === b.dataset.key) return;
    mark('font'); edit.draft.font = b.dataset.key; font.set(b.dataset.key); drawFont(); updateDirty();
  });
  const year = combo($('fYear'), { options: YEARS, placeholder: 'Year', free: true, onChange: (v) => { if (!edit) return; mark('year'); edit.draft.source.year = /^\d{1,4}$/.test(v) ? v : ''; updateDirty(); } });
  year.input.inputMode = 'numeric';
  function showSourceFields(on) {
    clearTimeout(showSourceFields.t);
    if (on) { fold($('fTitleWrap'), true); showSourceFields.t = setTimeout(() => { fold($('fLinkWrap'), true); drawVideo(); drawCovers(); }, 50); }
    else { drawVideo(); drawCovers(); fold($('fLinkWrap'), false); showSourceFields.t = setTimeout(() => fold($('fTitleWrap'), false), 50); }
  }

  /* ---------- The source's video ----------
     A source link to YouTube, Vimeo, TikTok or Instagram gets the platform's player under it,
     16:9, so the video can be checked before publishing. Not playing until asked; the link's own
     start time is kept. The link patterns and players are the archive's (js/app.js → VIDEO),
     copied: keep the two in step. A short TikTok link (vm.tiktok.com/…) has no id: TikTok's
     lookup gives it. Music (Spotify, Apple Music; since 2026-10-05): the platform's dark player
     at its own height, rounded up to the grid's rows. */
  function startOf(link) {
    const m = link.match(/[?&#](?:t|start|time_continue)=([\dhms]+)/);
    if (!m) return 0;
    if (/^\d+$/.test(m[1])) return Number(m[1]);
    const part = (u) => Number((m[1].match(new RegExp(`(\\d+)${u}`)) || [0, 0])[1]);
    return part('h') * 3600 + part('m') * 60 + part('s');
  }
  const VIDEO = {
    youtube: {
      match: (l) => (l.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/) || [])[1],
      lookup: (l) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(l)}`,
      player: (id, l) => `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0${startOf(l) ? `&start=${startOf(l)}` : ''}`,
      vertical: (l) => /\/shorts\//.test(l),
    },
    vimeo: {
      match: (l) => (l.match(/vimeo\.com\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/)?(\d+)/) || [])[1],
      lookup: (l) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(l)}`,
      player: (id, l) => `https://player.vimeo.com/video/${id}?playsinline=1${startOf(l) ? `#t=${startOf(l)}s` : ''}`,
    },
    tiktok: {
      match: (l) => (/tiktok\.com\//.test(l) ? ((l.match(/\/video\/(\d+)/) || [])[1] || 'short') : null),
      player: (id) => `https://www.tiktok.com/player/v1/${id}?rel=0`,
      vertical: () => true,
      lookup: (l) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(l)}`,
    },
    instagram: {
      match: (l) => { const m = l.match(/instagram\.com\/(?:[^/]+\/)?(p|reels?|tv)\/([\w-]+)/); return m ? `${m[1] === 'reels' ? 'reel' : m[1]}/${m[2]}` : null; },
      player: (id) => `https://www.instagram.com/${id}/embed/`,
      vertical: () => true,
    },
    spotify: {
      match: (l) => { const m = l.match(/open\.spotify\.com\/(?:intl-[\w-]+\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/); return m ? `${m[1]}/${m[2]}` : null; },
      lookup: (l) => `https://open.spotify.com/oembed?url=${encodeURIComponent(l)}`,
      player: (id) => `https://open.spotify.com/embed/${id}?theme=0`,
      bg: '#1f1f1f', // (the player's grey: the box's colour — js/app.js)
      height: (id) => (/^(track|episode)\//.test(id) ? 152 : 352),
    },
    apple: {
      match: (l) => { const m = l.match(/music\.apple\.com\/[a-z]{2}\/(album|song|playlist)\/(?:[^/?#]+\/)?([\w.-]+)/); return m ? ((l.match(/[?&]i=(\d+)/) || [])[1] || m[2]) : null; },
      player: (id, l) => { const u = new URL(l), i = u.searchParams.get('i'); return `https://embed.music.apple.com${u.pathname}?${i ? `i=${i}&` : ''}theme=dark`; },
      bg: '#1c1c1e',
      lookup: (l, id) => (/^\d+$/.test(id) ? `https://itunes.apple.com/lookup?id=${id}&country=${l.match(/music\.apple\.com\/([a-z]{2})\//)[1]}` : null), // (a playlist has none)
      read: (d) => d.resultCount > 0,
      height: (id, l) => (/[?&]i=\d+/.test(l) || /\/song\//.test(l) ? 175 : 450),
    },
  };
  // A vertical video (TikTok, Instagram, a Short, or a source marked vertical): its player is
  // drawn at a phone's size (css: 360 × VERTICAL_H, 9:16) and scaled to the box's height
  // (--fit), centred — Instagram's embed is a whole post and will not shrink to a sliver.
  const VERTICAL_H = 640;
  // The box is as near 16:9 as the edit view's grid allows: a whole number of rows (a row is a
  // field, --fh, and its 1px gap; --u is the page's unit, tokens.css), so what follows stays on
  // the grid. The player fits itself inside.
  // Music: the player's own height and the black round it, rounded up to whole rows.
  function sizeVideo() {
    const box = $('fVideo'), w = box.clientWidth;
    if (!w) return;
    const u = Math.min(1.5, Math.max(1, innerWidth / 1440)), row = 41 * u, gap = u; // (--fh 40 × --u, and the 1px gap)
    const music = box.dataset.orientation === 'music';
    const rows = Math.max(1, (music ? Math.ceil : Math.round)(((music ? Number(box.dataset.h) : w * 9 / 16) + gap) / row));
    box.style.aspectRatio = 'auto'; // the height is set: the width is the column's alone (with the ratio kept, a box in the fold took its width from the height)
    box.style.height = `${(rows * row - gap).toFixed(2)}px`;
    box.style.setProperty('--fit', ((rows * row - gap) / VERTICAL_H).toFixed(4));
  }
  new ResizeObserver(sizeVideo).observe($('fVideo'));
  async function drawVideo(instant = false) { // instant: opening a quote, the player is simply there
    clearTimeout(drawVideo.t);
    const box = $('fVideo'), wrap = $('fVideoWrap');
    const d = edit && edit.draft, link = d ? d.source.link.trim() : '';
    const shown = d && !!d.source.kind && d.source.kind !== 'personal';
    let platform = null, id = null;
    for (const [name, p] of Object.entries(VIDEO)) { id = p.match(link); if (id) { platform = name; break; } }
    if (!shown || !platform) { cropFor('', instant); (instant ? foldNow : fold)(wrap, false); box.dataset.src = ''; box.innerHTML = ''; return; }
    if (id === 'short') { // a short TikTok link: ask TikTok for the video's id
      try { const r = await fetch(VIDEO.tiktok.lookup(link)); const j = r.ok ? await r.json() : null; id = j && j.embed_product_id ? String(j.embed_product_id) : null; } catch (e) { id = null; }
      if (!edit || edit.draft.source.link.trim() !== link) return; // the link changed meanwhile
    }
    const src = id ? VIDEO[platform].player(id, link) : '';
    const music = !!VIDEO[platform].height;
    cropFor(id && !music ? `${platform}:${id}` : '', instant, platform, id, link); // (a video's thumbnail, to crop)
    box.dataset.orientation = music ? 'music' : d.source.orientation === 'vertical' || (VIDEO[platform].vertical && VIDEO[platform].vertical(link)) ? 'vertical' : 'horizontal';
    box.dataset.h = music ? VIDEO[platform].height(id, link) + 16 : ''; // (8 of black round the player)
    box.style.setProperty('--player-h', music ? `${VIDEO[platform].height(id, link)}px` : '');
    box.style.backgroundColor = music ? VIDEO[platform].bg : '';
    sizeVideo();
    (instant ? foldNow : fold)(wrap, true);
    if (box.dataset.src === src) return; // the same video: the player is left as it is (or the crop, while cropping)
    box.dataset.src = src;
    box.innerHTML = src
      ? `<iframe src="${esc(src)}" title="${music ? 'Music' : 'Video'} preview" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe>`
      : `<p>${music ? 'Music' : 'Video'} not available.</p>`;
  }

  /* ---------- A video's thumbnail, cropped ----------
     (Bill, 2026-10-08; Figma 500:3978.) The site shows a video's thumbnail through a portrait
     window, 160 × 284 (css/app.css → .thumb), by default its middle. "Crop thumbnail" under the
     player puts the thumbnail itself in the player's place, whole, with that window over it:
     dragged to move, by a corner to size — always the same shape — and red while it would show
     the thumbnail softer than twice the 160 it is shown at (THUMB_MIN_W, as covers). "Done" keeps
     it as source.crop, the window as shares of the thumbnail { x, y, w, h }; the site draws the
     thumbnail through it. Only the numbers are stored: the thumbnail is still the platform's.
     The window left in the middle is no crop. Escape leaves without keeping, Enter is Done; the
     arrow keys move it (with Shift, ten times as far). A new video drops the crop. The thumbnail
     is the one the site shows (js/app.js → VIDEO.thumb, the lookup's thumbnail_url): keep the
     two in step. Instagram has none to crop. */
  const THUMB_RATIO = 160 / 284, THUMB_MIN_W = 320, CROP_MIN = 32; // CROP_MIN: the smallest window, in screen px
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  // A video link's platform and id ('' for music or not a video): the crop belongs to it.
  function videoKey(link) {
    const l = (link || '').trim();
    for (const [name, p] of Object.entries(VIDEO)) { const id = p.match(l); if (id) return p.height ? '' : `${name}:${id === 'short' ? l : id}`; }
    return '';
  }
  const thumbCache = new Map(); // "platform:id" → Promise of { src, nw, nh } or null
  function thumbFor(platform, id, link) {
    const key = `${platform}:${id}`;
    if (thumbCache.has(key)) return thumbCache.get(key);
    const load = (src) => new Promise((done) => { const img = new Image(); img.onload = () => done(img.naturalWidth ? { src, nw: img.naturalWidth, nh: img.naturalHeight } : null); img.onerror = () => done(null); img.src = src; });
    const t = platform === 'youtube' ? load(`https://i.ytimg.com/vi/${id}/hq720.jpg`).then((x) => x || load(`https://i.ytimg.com/vi/${id}/mqdefault.jpg`)) // (the site's, and its second)
      : platform === 'vimeo' || platform === 'tiktok' ? fetch(VIDEO[platform].lookup(link)).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((d) => (d && d.thumbnail_url ? load(d.thumbnail_url) : null))
      : Promise.resolve(null);
    thumbCache.set(key, t);
    return t;
  }
  // The middle of the thumbnail, as tall (or as wide) as it goes: what the site shows uncropped.
  const middleCrop = (t) => { const a = t.nw / t.nh; return a >= THUMB_RATIO ? { x: (1 - THUMB_RATIO / a) / 2, y: 0, w: THUMB_RATIO / a, h: 1 } : { x: 0, y: (1 - a / THUMB_RATIO) / 2, w: 1, h: a / THUMB_RATIO }; };
  const crop = { on: false, key: '', thumb: null, r: null }; // r: the window, as shares of the thumbnail
  // The video drawn: its thumbnail is fetched, and the row offered once it is there.
  function cropFor(key, instant, platform, id, link) {
    if (crop.on && crop.key !== key) endCrop(false, false);
    if (crop.key !== key) {
      crop.key = key; crop.thumb = null;
      if (key) thumbFor(platform, id, link).then((t) => { if (crop.key === key) { crop.thumb = t; cropRow(); } });
    }
    cropRow(instant);
  }
  function cropRow(instant = false) {
    const btn = $('fCropBtn');
    btn.firstElementChild.textContent = crop.on ? 'Done' : 'Crop thumbnail';
    btn.lastElementChild.className = `icon ${crop.on ? 'icon-done' : 'icon-crop'}`;
    (instant ? foldNow : fold)($('fCropWrap'), !!crop.thumb);
  }
  // Where the thumbnail sits in the box (whole, centred), in px.
  function cropLayout() {
    const box = $('fVideo'), t = crop.thumb, W = box.clientWidth, H = box.clientHeight;
    const s = Math.min(W / t.nw, H / t.nh), dw = t.nw * s, dh = t.nh * s;
    return { dw, dh, ox: (W - dw) / 2, oy: (H - dh) / 2 };
  }
  function drawCrop() {
    if (!crop.on) return;
    const box = $('fVideo'), L = cropLayout(), r = crop.r, win = box.querySelector('.crop-win');
    Object.assign(box.querySelector('.crop-img').style, { left: `${L.ox}px`, top: `${L.oy}px`, width: `${L.dw}px`, height: `${L.dh}px` });
    Object.assign(win.style, { left: `${L.ox + r.x * L.dw}px`, top: `${L.oy + r.y * L.dh}px`, width: `${r.w * L.dw}px`, height: `${r.h * L.dh}px` });
    win.classList.toggle('is-low', r.w * crop.thumb.nw < THUMB_MIN_W);
  }
  new ResizeObserver(drawCrop).observe($('fVideo'));
  // The window from px (left, top, width, against the thumbnail as drawn), its height from its shape.
  const setWin = (L, l, t, w) => { crop.r = { x: l / L.dw, y: t / L.dh, w: w / L.dw, h: Math.min(1, w / THUMB_RATIO / L.dh) }; drawCrop(); };
  function startCrop() {
    if (!edit || !crop.thumb || crop.on) return;
    const box = $('fVideo'), saved = edit.draft.source.crop;
    crop.on = true;
    crop.r = saved ? { ...saved } : middleCrop(crop.thumb);
    box.classList.add('is-cropping');
    box.innerHTML = `<img class="crop-img" src="${esc(crop.thumb.src)}" alt="">
      <div class="crop-win" tabindex="0" role="group" aria-label="The thumbnail's window: drag to move, a corner to size; arrow keys move it, Enter keeps it">
        ${['nw', 'ne', 'sw', 'se'].map((c) => `<span class="crop-corner" data-c="${c}"></span>`).join('')}
      </div>`;
    drawCrop(); cropRow();
    box.querySelector('.crop-win').focus({ preventScroll: true });
  }
  function endCrop(keep, redraw = true) {
    if (!crop.on) return;
    crop.on = false;
    if (keep && edit) {
      const mid = middleCrop(crop.thumb), r = crop.r, round = (v) => Math.round(v * 10000) / 10000;
      const next = ['x', 'y', 'w', 'h'].every((k) => Math.abs(r[k] - mid[k]) < 0.002) ? null : { x: round(r.x), y: round(r.y), w: round(r.w), h: round(r.h) }; // (left in the middle: no crop)
      if (JSON.stringify(next) !== JSON.stringify(edit.draft.source.crop || null)) { mark('crop'); edit.draft.source.crop = next; updateDirty(); }
    }
    const box = $('fVideo');
    box.classList.remove('is-cropping'); box.dataset.src = ''; box.innerHTML = '';
    cropRow();
    if (redraw) drawVideo();
  }
  $('fCropBtn').addEventListener('click', () => (crop.on ? endCrop(true) : startCrop()));
  // Dragging: the window moves; a corner sizes it from the opposite corner, keeping its shape.
  $('fVideo').addEventListener('pointerdown', (e) => {
    const win = crop.on && e.target.closest('.crop-win');
    if (!win || e.button > 0) return;
    e.preventDefault(); win.focus({ preventScroll: true });
    const L = cropLayout(), rect = $('fVideo').getBoundingClientRect(), c = (e.target.closest('.crop-corner') || {}).dataset?.c;
    const l0 = crop.r.x * L.dw, t0 = crop.r.y * L.dh, w0 = crop.r.w * L.dw, x0 = e.clientX, y0 = e.clientY;
    const ax = c && c[1] === 'e' ? l0 : l0 + w0, ay = c && c[0] === 's' ? t0 : t0 + w0 / THUMB_RATIO; // (the corner that stays)
    win.setPointerCapture(e.pointerId);
    win.dataset.drag = c || 'move';
    const move = (ev) => {
      if (!c) return setWin(L, clamp(l0 + ev.clientX - x0, 0, L.dw - w0), clamp(t0 + ev.clientY - y0, 0, L.dh - w0 / THUMB_RATIO), w0);
      const sx = c[1] === 'e' ? 1 : -1, sy = c[0] === 's' ? 1 : -1;
      const px = ev.clientX - rect.left - L.ox, py = ev.clientY - rect.top - L.oy;
      const max = Math.min(sx > 0 ? L.dw - ax : ax, (sy > 0 ? L.dh - ay : ay) * THUMB_RATIO);
      const w = clamp(Math.max(sx * (px - ax), sy * (py - ay) * THUMB_RATIO), Math.min(CROP_MIN, max), max);
      setWin(L, sx > 0 ? ax : ax - w, sy > 0 ? ay : ay - w / THUMB_RATIO, w);
    };
    const up = () => { delete win.dataset.drag; win.removeEventListener('pointermove', move); win.removeEventListener('pointerup', up); win.removeEventListener('pointercancel', up); };
    win.addEventListener('pointermove', move); win.addEventListener('pointerup', up); win.addEventListener('pointercancel', up);
  });
  $('fVideo').addEventListener('keydown', (e) => {
    if (!crop.on || !e.target.closest('.crop-win')) return;
    if (e.key === 'Enter') { e.preventDefault(); endCrop(true); $('fCropBtn').focus({ preventScroll: true }); return; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); endCrop(false); $('fCropBtn').focus({ preventScroll: true }); return; }
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!step) return;
    e.preventDefault();
    const L = cropLayout(), n = e.shiftKey ? 10 : 1, w = crop.r.w * L.dw;
    setWin(L, clamp(crop.r.x * L.dw + step[0] * n, 0, L.dw - w), clamp(crop.r.y * L.dh + step[1] * n, 0, L.dh - w / THUMB_RATIO), w);
  });

  /* ---------- A song's link ----------
     A song with its name but no link (Bill, 2026-10-08): its Apple Music link is looked up by the
     name and, for a known person, the author (Apple's search, US store) and put in the link field,
     so its player shows under it and the site plays it. Apple only: Spotify has no search without
     an account. Only a close match is taken — the same name (bracketed parts aside), the same
     artist when there is an author — otherwise the link stays empty. Once per name and author: a
     found link cleared or typed over stays so (Undo too); one found earlier follows a new name. A
     link given (YouTube or any other) is left alone. */
  const songCache = new Map(); // "title|author" → Promise of an Apple Music link or ''
  const songKey = (s) => s.normalize('NFKC').toLowerCase().replace(/\s*[(（[].*?[)）\]]\s*/g, ' ').replace(/[^\p{L}\p{N}]+/gu, '');
  function findSong(title, author) {
    const key = `${title}|${author}`;
    if (!songCache.has(key)) songCache.set(key, fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(author ? `${title} ${author}` : title)}&entity=song&limit=10&country=us`)
      .then((r) => (r.ok ? r.json() : null)).catch(() => null).then((d) => {
        const same = (a, b) => !!a && !!b && (a.includes(b) || b.includes(a));
        const hit = (d && d.results || []).find((x) => songKey(x.trackName || '') === songKey(title) && (!author || same(songKey(x.artistName || ''), songKey(author))));
        if (!hit || !hit.trackViewUrl) return '';
        const u = new URL(hit.trackViewUrl); u.searchParams.delete('uo');
        return u.href;
      }));
    return songCache.get(key);
  }
  async function autoSong() {
    clearTimeout(autoSong.t);
    const d = edit && edit.draft;
    if (!d || d.source.kind !== 'song') return;
    const link = d.source.link.trim(), title = d.source.title.trim(), author = d.author.kind === 'person' ? d.author.name.trim() : '';
    if (link && link !== edit.songLink) return; // a link given (or typed over the one found)
    const key = `${title}|${author}`;
    if (!title || edit.songTried === key) return;
    edit.songTried = key;
    const found = await findSong(title, author);
    const now = edit && edit.draft.source.link.trim();
    if (!edit || edit.songTried !== key || edit.draft.source.kind !== 'song' || (now && now !== edit.songLink) || found === now) return;
    mark(); edit.draft.source.link = found; edit.songLink = found;
    $('fLink').value = found; warnLink(''); drawVideo(); updateDirty();
    if (found) toast('Apple Music link found.');
  }

  /* ---------- What no longer works ----------
     A quote's source link and its book cover are checked once a visit, in the background: a
     video or music link by asking its platform (as the site does), a cover by loading it. Any
     other link cannot be checked from here (a browser may not see whether another site's page
     is there). A quote with something gone gets an ⓘ after its number in the list (16, info.svg;
     the numbers kept one width so the ⓘs line up), and in its edit view the field says so. A
     platform that cannot be reached at all is not counted as gone: when its lookup fails, a link
     known to be there is asked too (HEALTH_CONTROL), and only if that one answers is the quote's
     link taken to be gone (Spotify answers a dead link without the header the page needs). */
  // A link's shape: http(s), a real domain, no bare IP address or localhost, no user name or
  // password (workers/lib/link.js → shapeOf, which the Workers check again: keep in step).
  function linkShapeOk(raw) {
    let u;
    try { u = new URL(raw.trim()); } catch (e) { return false; }
    if (!/^https?:$/.test(u.protocol) || u.username || u.password) return false;
    const host = u.hostname.toLowerCase();
    return host.includes('.') && !/^\[|^\d+(\.\d+){3}$/.test(host) && !/(^|\.)(localhost|local|internal|lan|home|test|invalid|example)$/.test(host);
  }
  // A warning in the link field, as every warning in the form: the link goes, the warning takes
  // the placeholder's place, with the ⓘ. '' puts the category's hint back.
  function warnLink(text) {
    const field = $('fLink');
    field.closest('.fw').classList.toggle('is-warn', !!text);
    if (!text) return linkHint(edit ? edit.draft.source.kind : '');
    field.value = '';
    field.placeholder = text; field.setAttribute('aria-label', text);
  }
  const LINK_NOTE = { shape: 'This doesn’t look like a link.', unreachable: 'We can’t reach this link.', unsafe: 'This link is flagged as unsafe.' };
  const ALERT_ICON = '<span class="icon icon-info num-alert" role="img" aria-label="Something no longer works"></span>';
  const HEALTH_CONTROL = {
    youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', vimeo: 'https://vimeo.com/22439234',
    tiktok: 'https://www.tiktok.com/@scout2015/video/6718335390845095173', spotify: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
    apple: 'https://music.apple.com/us/album/moon-river/358066383?i=358066422',
  };
  const healthCache = new Map(); // a link or cover → Promise of 'ok' | 'gone' | 'unknown'
  const issues = new Map();      // a quote's key → what is gone in it: ['link'] / ['cover'] / both
  const platformOf = (link) => { for (const [name, p] of Object.entries(VIDEO)) { const id = p.match(link); if (id) return { name, id }; } return null; };
  async function askPlatform(link) {
    const pf = platformOf(link), p = VIDEO[pf.name], url = p.lookup && p.lookup(link, pf.id);
    if (!url) return 'unknown';
    const r = await fetch(url);
    if (!r.ok) return 'gone';
    return !p.read || p.read(await r.json()) ? 'ok' : 'gone';
  }
  // → 'ok' | 'gone' (can't be reached) | 'unsafe' (its site flagged) | 'shape' (not a link) | 'unknown'
  // Any other link: the Worker opens it and asks Cloudflare's filter (/api/check-link; not in the demo).
  async function askWorker(link) {
    const r = await call('/check-link', 'POST', { url: link });
    if (!r.ok) return 'unknown';
    const d = await r.json();
    return d.unsafe ? 'unsafe' : d.reach === 'unreachable' ? 'gone' : d.shape === 'bad' ? 'shape' : 'ok';
  }
  function linkHealth(link) {
    if (!link) return Promise.resolve('ok');
    if (healthCache.has(link)) return healthCache.get(link);
    const pf = platformOf(link);
    const found = !linkShapeOk(link) ? Promise.resolve('shape')
      : !pf ? (remote ? askWorker(link).catch(() => 'unknown') : Promise.resolve('unknown'))
      : !VIDEO[pf.name].lookup ? Promise.resolve('unknown')
      : askPlatform(link).catch(() => askPlatform(HEALTH_CONTROL[pf.name]).then((c) => (c === 'ok' ? 'gone' : 'unknown')).catch(() => 'unknown'));
    healthCache.set(link, found);
    return found;
  }
  function coverHealth(src) {
    if (!src || coverPreview.has(src)) return Promise.resolve('ok'); // (one just pasted: the site has it a minute or so later — it is not "gone")
    const key = `cover:${src}`;
    if (!healthCache.has(key)) healthCache.set(key, new Promise((done) => {
      const img = new Image(), t = setTimeout(() => done('unknown'), 8000);
      img.onload = () => { clearTimeout(t); done('ok'); };
      img.onerror = () => { clearTimeout(t); done('gone'); };
      img.src = src;
    }));
    return healthCache.get(key);
  }
  function checkQuote(q) {
    const src = q.source || {};
    Promise.all([linkHealth(src.link), src.kind === 'book' ? coverHealth(src.cover) : 'ok']).then(([link, cover]) => {
      const now = [['gone', 'unsafe', 'shape'].includes(link) && 'link', cover === 'gone' && 'cover'].filter(Boolean);
      const before = issues.get(q.key) || [];
      issues.set(q.key, now);
      if (now.length === before.length) return;
      const cell = $('rows').querySelector(`.row[data-key="${q.key}"] .c-num`);
      if (cell) cell.innerHTML = `<span class="num-n">${numberOf(q)}</span>${now.length ? ALERT_ICON : ''}`;
    });
  }
  // The edit view: the link field and the cover field say what is wrong (the draft as it stands).
  // The link is checked when the quote opens and when the field is left (not as it is typed); a
  // warning takes the link out of the draft (Undo / Revert bring it back) — once per link: one
  // brought back is the admin's choice and stays.
  let healthWarn = false; // the cover field shows the "no longer loads" warning (not another one)
  function linkFieldHealth() {
    if (!edit) return;
    const link = edit.draft.source.link.trim(), shown = !!edit.draft.source.kind && edit.draft.source.kind !== 'personal';
    if (!link || !shown || edit.linkWarned.has(link)) return;
    linkHealth(link).then((h) => {
      const text = { gone: LINK_NOTE.unreachable, unsafe: LINK_NOTE.unsafe, shape: LINK_NOTE.shape }[h];
      if (!text || !edit || edit.draft.source.link.trim() !== link || edit.linkWarned.has(link)) return;
      edit.linkWarned.add(link);
      mark('link'); edit.draft.source.link = '';
      warnLink(text); drawVideo(); updateDirty();
    });
  }
  function fieldHealth() {
    if (!edit) return;
    const cover = edit.draft.source.kind === 'book' ? edit.draft.source.cover : '';
    coverHealth(cover).then((h) => {
      if (!edit || (edit.draft.source.kind === 'book' ? edit.draft.source.cover : '') !== cover) return;
      if (h === 'gone') { healthWarn = true; warnCover('The picked cover no longer loads. Pick another.'); }
      else if (healthWarn) { healthWarn = false; warnCover(''); }
    });
  }

  /* ---------- A book's cover ----------
     A book has no link to find its cover from, so the cover is looked for by its title and author
     and picked here: Apple Books (by title and author, then by title alone — the better search for
     Chinese and Japanese books), then Open Library; up to COVER_MAX. Nothing is picked for you
     ("No cover" until a tile is chosen): a wrong cover is worse than none. An image address can be
     pasted for a book neither has. The pick is stored as source.cover; the site shows it as is. */
  const COVER_MAX = 8;
  // Too small to keep: the site shows a cover 160 wide, so under twice that it would be soft on a
  // sharp screen. Each cover is loaded at the size the site would use and measured; one that is
  // narrower, or will not load in COVER_WAIT_MS, is left out (Bill, 2026-10-05).
  const COVER_MIN_W = 320, COVER_WAIT_MS = 6000;
  const sharpEnough = (c) => new Promise((done) => {
    const img = new Image(), t = setTimeout(() => done(false), COVER_WAIT_MS);
    img.onload = () => { clearTimeout(t); done(img.naturalWidth >= COVER_MIN_W); };
    img.onerror = () => { clearTimeout(t); done(false); };
    img.src = c.src;
  });
  const coverCache = new Map(); // "title|author" → Promise of [{ src, small, title, by, from }]
  function findCovers(title, author) {
    const key = `${title}|${author}`;
    if (coverCache.has(key)) return coverCache.get(key);
    const get = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const apple = (term) => get(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=ebook&limit=${COVER_MAX}&country=us`)
      .then((d) => (d && d.results || []).filter((x) => x.artworkUrl100).map((x) => ({
        src: x.artworkUrl100.replace(/100x100bb/, '600x600bb'), small: x.artworkUrl100.replace(/100x100bb/, '200x200bb'), title: x.trackName, by: x.artistName, from: 'Apple Books' })));
    const library = get(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}${author ? `&author=${encodeURIComponent(author)}` : ''}&limit=${COVER_MAX}&fields=title,author_name,cover_i`)
      .then((d) => (d && d.docs || []).filter((x) => x.cover_i).map((x) => ({
        src: `https://covers.openlibrary.org/b/id/${x.cover_i}-L.jpg`, small: `https://covers.openlibrary.org/b/id/${x.cover_i}-M.jpg`, title: x.title, by: (x.author_name || [])[0] || '', from: 'Open Library' })));
    const found = Promise.all([author ? apple(`${title} ${author}`) : [], apple(title), library]).then(([both, byTitle, lib]) => {
      const seen = new Set(); // Apple's best five, Open Library's three, then the rest — the sharp ones
      const all = [...both.slice(0, 5), ...lib.slice(0, 3), ...both.slice(5), ...byTitle, ...lib.slice(3)].filter((c) => !seen.has(c.src) && seen.add(c.src));
      return Promise.all(all.map(sharpEnough)).then((ok) => all.filter((c, i) => ok[i]).slice(0, COVER_MAX));
    });
    coverCache.set(key, found);
    return found;
  }
  const coverTile = (c, picked) => `<button type="button" class="cover-pick" role="radio" aria-checked="${picked}" data-src="${esc(c.src)}" title="${esc([c.title, c.by].filter(Boolean).join(' · '))}" aria-label="${esc([c.title, c.by].filter(Boolean).join(', ') || 'Cover')}">
      <span class="chk-box" aria-hidden="true"><span class="icon icon-check"></span></span>
      <span class="cover-img"><img src="${esc(coverPreview.get(c.src) || c.small || c.src)}" alt="" loading="lazy"></span>
    </button>`;
  // The tiles, the picked one checked (a pasted or earlier pick that is not among them comes first).
  // The cover alone, no text under it (Bill, 2026-10-05): its title and author are on hover.
  // The tiles sit on the notes' background, a category's (tokens.css). With several, the notes take
  // one at random each time: "Note background" steps to the next (Bill, 2026-10-05; only for
  // looking, not stored — off with one category).
  let coverGroundAt = 0;
  function coverGround() {
    const cats = edit ? CATEGORIES.map((c) => c.key).filter((k) => edit.draft.categories.includes(k)) : [];
    const list = cats.length ? cats : ['perspective']; // (none yet: the archive's own fallback)
    const k = list[coverGroundAt % list.length], name = (CATEGORIES.find((c) => c.key === k) || {}).name || k;
    $('fCovers').style.setProperty('--cover-bg', `var(--${k}-bg)`);
    $('fCoverBg').setAttribute('aria-disabled', String(list.length < 2));
    $('fCoverBg').setAttribute('aria-label', `Note background: ${name}${list.length < 2 ? '' : ', show the next category'}`);
    $('fCoverBg').title = name;
  }
  $('fCoverBg').addEventListener('click', () => {
    if ($('fCoverBg').getAttribute('aria-disabled') === 'true') return;
    coverGroundAt += 1; coverGround();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) $('fCoverBg').querySelector('.icon').style.rotate = `${coverGroundAt * 360}deg`; // one more turn clockwise
  });
  function pickCovers(list) {
    coverGround();
    const cover = edit ? edit.draft.source.cover : '';
    const tiles = cover && !list.some((c) => c.src === cover) ? [{ src: cover, title: 'Picked' }, ...list] : list;
    $('fCovers').innerHTML = tiles.length ? tiles.map((c) => coverTile(c, c.src === cover)).join('') : `<p class="cover-note">${drawCovers.busy ? 'Looking for covers…' : 'No covers found.'}</p>`;
    $('fNoCover').setAttribute('aria-checked', String(!cover));
    if (cover !== $('fCoverLink').value.trim()) $('fCoverLink').value = ''; // the field holds only what was pasted, while it is the pick
  }
  async function drawCovers(instant = false) {
    clearTimeout(drawCovers.t);
    const d = edit && edit.draft, wrap = $('fCoverWrap');
    const book = !!d && d.source.kind === 'book';
    (instant ? foldNow : fold)(wrap, book);
    if (!book) return;
    const title = d.source.title.trim(), author = d.author.name.trim();
    if (!title) { drawCovers.list = []; drawCovers.busy = false; return pickCovers([]); }
    const key = `${title}|${author}`;
    drawCovers.key = key; drawCovers.busy = true;
    pickCovers(drawCovers.list && drawCovers.listKey === key ? drawCovers.list : []);
    const list = await findCovers(title, author);
    if (drawCovers.key !== key || !edit) return; // the title changed meanwhile
    drawCovers.busy = false; drawCovers.list = list; drawCovers.listKey = key;
    pickCovers(list);
  }
  function setCover(src) {
    if (!edit || edit.draft.source.cover === src) return;
    mark('cover'); edit.draft.source.cover = src; updateDirty();
    pickCovers(drawCovers.list || []);
    fieldHealth();
  }
  $('fCovers').addEventListener('click', (e) => { const t = e.target.closest('.cover-pick'); if (t) setCover(t.dataset.src); });
  $('fNoCover').addEventListener('click', () => setCover(''));
  /* Pasting into "Or paste a cover image, or its address":
     · an address is tried first: one that will not load here (a site that only shows its images
       on its own pages, as Douban does) is not taken, and the field says to paste the image;
     · an image (copied in the browser, or dropped from the computer) is shrunk here to COVER_W
       wide and committed to the site (the Worker's /api/cover → assets/covers/…); until the site
       has it, its tile shows the copy in hand (coverPreview). In the demo it stays in this browser. */
  const COVER_W = 320, COVER_LINK_HINT = 'Or paste a cover image, or its address';
  const coverPreview = new Map(); // a saved cover's path → the image as pasted, for its tile
  function warnCover(text) {
    const field = $('fCoverLink'), wrap = field.parentNode;
    wrap.classList.toggle('is-warn', !!text);
    field.placeholder = text || COVER_LINK_HINT;
    if (text) field.value = '';
  }
  const loads = (src) => new Promise((done) => {
    const img = new Image(), t = setTimeout(() => done(0), COVER_WAIT_MS);
    img.onload = () => { clearTimeout(t); done(img.naturalWidth); };
    img.onerror = () => { clearTimeout(t); done(0); };
    img.src = src;
  });
  $('fCoverLink').addEventListener('input', (e) => {
    const v = e.target.value.trim();
    if (e.target.parentNode.classList.contains('is-warn')) warnCover('');
    clearTimeout(setCover.t);
    setCover.t = setTimeout(async () => {
      if (!/^https?:\/\/\S+$/i.test(v)) return setCover('');
      if (await loads(v)) { if ($('fCoverLink').value.trim() === v) setCover(v); return; }
      if ($('fCoverLink').value.trim() !== v) return; // typed on meanwhile
      setCover('');
      warnCover('Its site blocks this. Copy the image and paste it instead.');
    }, 400);
  });
  async function shrinkCover(file) {
    const bmp = await createImageBitmap(file);
    const w = Math.min(COVER_W, bmp.width), h = Math.round(bmp.height * w / bmp.width);
    const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    const as = (type) => new Promise((done) => canvas.toBlob(done, type, 0.85));
    let blob = await as('image/webp');
    if (!blob || blob.type !== 'image/webp') blob = await as('image/jpeg'); // (a browser that cannot write WebP)
    const url = await new Promise((done) => { const r = new FileReader(); r.onload = () => done(r.result); r.readAsDataURL(blob); });
    return { url, width: bmp.width };
  }
  async function pasteCover(file) {
    warnCover('');
    let shrunk;
    try { shrunk = await shrinkCover(file); } catch (e) { return warnCover('That image could not be read. Try another.'); }
    const soft = shrunk.width < COVER_W ? ` It is only ${shrunk.width} wide, so it may look soft.` : '';
    if (!remote) { setCover(shrunk.url); if (soft) toast(soft.trim()); return; } // the demo: kept in this browser
    $('fCoverLink').placeholder = 'Saving the cover…';
    const send = () => call('/cover', 'PUT', { data: shrunk.url.split(',')[1] });
    let r;
    try { r = await send(); if (r.status === 401) { await signIn(); r = await send(); } } catch (e) { r = null; }
    if (!r || !r.ok) return warnCover('The cover could not be saved. Try again.');
    const { path } = await r.json();
    coverPreview.set(path, shrunk.url);
    warnCover('');
    setCover(path);
    toast(`Cover saved.${soft}`);
  }
  const imageIn = (list) => [...(list || [])].find((f) => f && /^image\//.test(f.type));
  $('fCoverLink').addEventListener('paste', (e) => {
    const file = imageIn(e.clipboardData && e.clipboardData.files);
    if (!file) return; // text: an address, handled as it is typed
    e.preventDefault();
    pasteCover(file);
  });
  ['fCoverLink', 'fCovers'].forEach((id) => {
    $(id).addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.items].some((i) => i.kind === 'file')) e.preventDefault(); });
    $(id).addEventListener('drop', (e) => { const file = imageIn(e.dataTransfer && e.dataTransfer.files); if (!file) return; e.preventDefault(); pasteCover(file); });
  });
  // A cover that will not load is no use: its tile goes.
  $('fCovers').addEventListener('error', (e) => { const t = e.target.closest && e.target.closest('.cover-pick'); if (t && t.getAttribute('aria-checked') !== 'true') t.remove(); }, true);

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
    const i = [...row.parentElement.children].indexOf(row); // before renderAnn, which builds the rows anew (this one is then gone)
    renderAnn(); updateDirty();
    const r = $('annRows').querySelector(`.ann-pair[data-i="${i}"]`);
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
    if (e.key !== 'Enter' || composing(e) || e.target.dataset.f !== 'word') return;
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
    $('fNotFirst').setAttribute('aria-checked', String(!!d.notFirst));
    $('fName').value = d.author.name; $('fNative').value = d.author.nativeName;
    country.set(d.author.country); who.set(d.author.kind || 'person'); origin.set(d.author.origin || ''); showWho(d.author.kind || 'person', true);
    kind.set(d.source.kind); year.set(d.source.year); linkHint(d.source.kind);
    const src = !!d.source.kind && d.source.kind !== 'personal';
    foldNow($('fTitleWrap'), src); foldNow($('fLinkWrap'), src);
    $('fTitle').value = d.source.title; $('fLink').value = d.source.link;
    endCrop(false, false); // (cropping: left, nothing kept)
    foldNow($('fVideoWrap'), false); $('fVideo').dataset.src = ''; $('fVideo').innerHTML = ''; drawVideo(true); // (the quote's own video, if it has one)
    drawCovers(true); // (a book: its covers, the picked one checked)
    autoSong(); // (a song with no link: its Apple Music link)
    healthWarn = false; warnCover(''); warnLink('');
    fieldHealth(); linkFieldHealth(); // (a link or cover that no longer works: its field says so)
    $('fContext').value = d.context; $('fReflection').value = d.reflection; $('fKeptBy').value = d.keptBy;
    typedFields().forEach((f) => { f.dir = 'auto'; fieldLook(f); }); // (the quote's fields, as filled)
    font.set(d.font); lang.set(d.lang); drawFont();
    renderAnn();
    setAnnOpen(d.annotations.some((a) => a.word.trim() || a.explanation.trim()), false);
    document.querySelectorAll('textarea.field').forEach((ta) => ta.dispatchEvent(new Event('scroll')));
  }

  /* ---------- The quote's face ----------
     The dropdown offers the faces drawn for the quote's length. If the words change length and
     the chosen face is no longer one of them, the field goes into the warning state and Save /
     Approve wait for another. The preview is the quote as the archive sets it (css/fonts.css,
     the .quote rules of css/app.css). */
  // The archive's line-breaking rules (js/app.js → noOrphans, copied: change both), so the
  // preview breaks where the archive does: the last two words stay together (CJK: the last
  // four characters), a sentence's opener — one or two letters, or a pronoun — stays with
  // the word after it, and so do "a", "an", "of" and "from" ("the" and "is" are looser: SOFT_END).
  const NBSP = '\u00a0', WJ = '\u2060', CJK_CHAR = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\uff00-\uffef\u3000-\u303f]/;
  const OPENERS = 'I|we|you|he|she|it|they|my|our|your|his|her|its|their|me|us|them';
  const OPENER = new RegExp(`([.!?…:;][”’)\\]]*\\s+[“‘(\\[]*(?:[^\\s\\u00a0]{1,2}|(?:${OPENERS})(?:[’'][a-z]+)?)) (?=\\S)`, 'gi');
  const TIED_WORD = /(^|[\s“‘(\[—–])(a|an|of|from) (?=\S)/gi; // "a", "an", "of", "from" never end a line
  const tieWords = (line) => { for (let was; was !== line;) { was = line; line = line.replace(TIED_WORD, `$1$2${NBSP}`); } return line; };
  function noOrphans(text) {
    return text.split('\n').map((line) => {
      const chars = [...line];
      if (chars.filter((ch) => CJK_CHAR.test(ch)).length > chars.length / 2) return chars.length < 8 ? line : chars.slice(0, -4).join('') + chars.slice(-4).join(WJ);
      if (line.trim().split(/\s+/).length < 4) return tieWords(line);
      const words = tieWords(line).trimEnd().split(' ');
      const last = words.pop();
      return `${words.join(' ')}${NBSP}${last}`.replace(OPENER, `$1${NBSP}`);
    }).join('\n');
  }
  function checkFont() { return !edit || fontFits(edit.draft.font, tier(edit.draft.text)); }
  // Two panels: the English words, and under them the original-language ones when there are
  // any — in the quote's own face if it is Latin script the face can set (nativeInFace), else
  // in Noto, as the archive does (css: .quote[data-native]).
  // The script of an original-language quote set in Noto (js/app.js → quoteScript, copied: change both).
  const QUOTE_SCRIPTS = [['kana', /[\u3040-\u30ff]/g], ['hang', /[\uac00-\ud7af\u1100-\u11ff]/g], ['hani', /[\u3400-\u9fff]/g],
    ['cyrl', /[\u0400-\u052f]/g], ['grek', /[\u0370-\u03ff\u1f00-\u1fff]/g], ['arab', /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/g],
    ['hebr', /[\u0590-\u05ff\ufb1d-\ufb4f]/g], ['thai', /[\u0e00-\u0e7f]/g], ['deva', /[\u0900-\u097f\ua8e0-\ua8ff]/g]];
  // Traditional or simplified Chinese, told apart by characters that exist in one form only
  // (說/说, 這/这, 們/们…); a tie goes by the author's country (Taiwan, Hong Kong, Macau:
  // traditional). Set in Noto TC or SC (css/fonts.css, .n-hant).
  const HANT_ONLY = /[說這們過時會來個為與學國對開關麼見現發經長點無還將當動從實後問進間頭東車門書話認樣電種總體歲氣讓應議處覺親邊雖萬誰聽廣際隊陽燈愛歡飛龍風馬鳥魚謂緣遠漸塊積塵習樂淚夢聲憶戀讀寫語衛華葉燒紅綠線給結終錯鐘難歷戰爭張紀記許該誤調請謝識變義藝劇嗎麗歐傳價優億盡屬歸斷雙舊雜響顏顯驗滿漢灣熱爾獨環畫盤確禮離筆節糧級細網練織臉興舉藥虛蘭術補視觀計訴詩詞試誠論證讚貝負財貨貴買費賣質輕載輪農運達遲選遺郵鄉醫釋鐵錢閉陳隨險雞靜韓頁順須預領題願類飯館驚齊齒]/g;
  const HANS_ONLY = /[说这们过时会来个为与学国对开关么见现发经长点无还将当动从实后问进间头东车门书话认样电种总体岁气让应议处觉亲边虽万谁听广际队阳灯爱欢飞龙风马鸟鱼谓缘远渐块积尘习乐泪梦声忆恋读写语卫华叶烧红绿线给结终错钟难历战争张纪记许该误调请谢识变义艺剧吗丽欧传价优亿尽属归断双旧杂响颜显验满汉湾热尔独环画盘确礼离笔节粮级细网练织脸兴举药虚兰术补视观计诉诗词试诚论证赞贝负财货贵买费卖质轻载轮农运达迟选遗邮乡医释铁钱闭陈随险鸡静韩页顺须预领题愿类饭馆惊齐齿]/g;
  const isHant = (text, country) => {
    const t = (text.match(HANT_ONLY) || []).length, s = (text.match(HANS_ONLY) || []).length;
    return t !== s ? t > s : ['TW', 'HK', 'MO'].includes(country);
  };
  function quoteScript(text, country) {
    const n = Object.fromEntries(QUOTE_SCRIPTS.map(([k, re]) => [k, (text.match(re) || []).length]));
    if (n.kana) return 'jpan';
    if (n.hang) return 'kore';
    const [best, count] = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
    if (best === 'hani' && count) return isHant(text, country) ? 'hant' : 'hans';
    return count ? best : 'latn';
  }
  const quoteIn = (text, key, native) => {
    const t = native ? tier(text, 2) : tier(text), inFace = !native || nativeInFace(text, key);
    const shown = inFace && key === 'poet' ? text.replace(/…/g, '...') : text; // Poet has no ellipsis
    const script = inFace ? '' : quoteScript(text, edit && edit.draft.author && edit.draft.author.country);
    const attrs = inFace ? '' : ` data-native data-script="${script}"${script === 'arab' || script === 'hebr' ? ' dir="rtl"' : ''}`;
    return `<blockquote class="quote" data-tier="${t}"${t === 'l' ? ' data-short' : ''} data-font="${esc(key)}"${attrs}>${esc(noOrphans(shown.trim()))}</blockquote>`;
  };
  function drawFont() {
    if (!edit) return;
    const key = edit.draft.font, original = edit.draft.original.trim();
    font.set(key); // (the checked row, and which faces this length allows)
    $('fontStage').innerHTML = quoteIn(edit.draft.text, key, false);
    $('fontViewNative').hidden = !original;
    $('fontStageNative').innerHTML = original ? quoteIn(original, key, true) : '';
    sizeFont();
  }
  // As in the archive (js/app.js → fitTier): a short quote that takes more than two lines is
  // set in the medium size. Counted on the preview itself, and again when its face has loaded.
  function fitFont(q) {
    if (!q || !q.firstChild) return;
    plainLines(q);
    q.dataset.tier = 'l';
    const r = document.createRange(); r.selectNodeContents(q);
    let lines = 0, last = null;
    [...r.getClientRects()].filter((b) => b.width > 0).forEach((b) => { if (last === null || Math.abs(b.top - last) > b.height / 2) { lines++; last = b.top; } });
    if (lines > 2) q.dataset.tier = 'm';
  }
  // The archive's rag (js/app.js → evenLines / ragBreaks, copied: change both), so the preview
  // breaks where the archive does: the same number of lines as plain filling takes, and
  // among every way to break the quote into that many, the one whose lines fall least short
  // of the box. The breaks are written into the text as newlines; the text as it was is kept
  // on the element (`_plain`) and put back before each new measuring. Not here: the archive's
  // fallback for CJK and for a word group wider than the box (those stay as the browser breaks them).
  const RAG_LAST = 1, RAG_LAST_MIN = 0.33; // js/app.js → RAG_LAST
  function plainLines(q) {
    if (q._plain != null && q.firstChild && q.childNodes.length === 1) q.firstChild.data = q._plain;
    q._plain = null;
  }
  function evenLines(q) {
    plainLines(q);
    const node = q.firstChild;
    if (!node || node.nodeType !== 3 || q.childNodes.length !== 1) return;
    const text = node.data, range = document.createRange(), words = [];
    if (CJK_CHAR.test(text) || [...text].length !== text.length) return;
    const re = /\S+/g;
    let m;
    while ((m = re.exec(text))) {
      range.setStart(node, m.index); range.setEnd(node, m.index + m[0].length);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0);
      if (rects.length !== 1) return; // a word broken at its hyphen: left alone
      words.push({ text: m[0], left: rects[0].left, right: rects[0].right, top: rects[0].top, height: rects[0].height, start: m.index, end: m.index + m[0].length });
    }
    const sameLine = (a, b) => Math.abs(a.top - b.top) < a.height / 2;
    const count = () => { // lines as rendered now
      const r = document.createRange(); r.selectNodeContents(q);
      let lines = 0, last = null;
      [...r.getClientRects()].filter((b) => b.width > 0).forEach((b) => { if (last === null || Math.abs(b.top - last) > b.height / 2) { lines++; last = b.top; } });
      return lines;
    };
    if (words.length < 2 || count() < 2) return;
    const box = q.getBoundingClientRect().width - 1;
    const before = words.map((w, k) => (k ? text.slice(words[k - 1].end, w.start) : '\n'));
    const gapAt = words.findIndex((w, k) => k && before[k] === ' ' && sameLine(w, words[k - 1]));
    const space = gapAt > 0 ? Math.max(words[gapAt].left - words[gapAt - 1].right, words[gapAt - 1].left - words[gapAt].right) : parseFloat(getComputedStyle(q).fontSize) * 0.25; // (right to left, the word before is to the right)
    const width = words.map((w) => w.right - w.left);
    const breaks = [];
    let from = 0;
    for (let k = 1; k <= words.length; k++) {
      if (k < words.length && !before[k].includes('\n')) continue;
      const cut = ragBreaks(width.slice(from, k), before.slice(from, k).map((b, i) => i > 0 && b === ' '), space, box, words.slice(from, k).map((w) => stackKey(w.text)));
      if (!cut) return;
      cut.forEach((c) => breaks.push(from + c));
      from = k;
    }
    if (!breaks.length) return;
    const chars = [...text];
    breaks.forEach((k) => { chars[words[k].start - 1] = '\n'; });
    node.data = chars.join('');
    q._plain = text;
    if (count() !== before.filter((b) => b.includes('\n')).length + breaks.length) plainLines(q); // the browser must agree line for line
  }
  // No stacks (Bill, 2026-10-06): two lines in a row should not start with the same word
  // ("you … / you …", "the person … / the person …") — the eye can lose its place, and the left
  // edge shows the repeat. Bill's order (2026-10-06): no repeats first, then even lines, then
  // "the" / "is" at a line end. A repeat costs RAG_STACK² boxes² — more than any unevenness — so
  // it happens only when nothing else fits. Words are compared without capitals or punctuation.
  const RAG_STACK = 10;
  // Last in that order: a line avoids ending on "the" or "is" — it costs as much as a line left
  // RAG_SOFT of the box short — which decides between ways that are about as even, and gives way
  // to evenness otherwise. ("a", "an", "of", "from" are tied to the next word and never end a line.)
  const SOFT_END = new Set(['the', 'is']), RAG_SOFT = 0.15;
  // No shapes (Bill, 2026-10-06): three lines in a row that each grow, or each shrink, make the
  // rag a wedge or a diamond (a phone: 57% 60% 66% 82% 74% 64%). Each such run of three costs as
  // much as a line left RAG_SHAPE of the box short, so the lines go in and out instead. A step
  // under RAG_STEP of the box is no step, and lines that shrink into the last one are not a shape:
  // that is how a paragraph ends ("is — in the end, the / world takes down everyone." kept a 58%
  // line rather than let "world" up).
  const RAG_SHAPE = 0.3, RAG_STEP = 0.05;
  const stackKey = (text) => text.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  function ragBreaks(width, open, space, box, keys = []) {
    const n = width.length;
    const span = (i, j) => { let w = 0; for (let k = i; k < j; k++) w += width[k]; return w + (j - i - 1) * space; }; // words i…j-1 on one line
    // best[j] per line count: least cost of setting the first j words in exactly `l` lines.
    let prev = new Array(n + 1).fill(Infinity), trail = [];
    prev[0] = 0;
    for (let l = 1; l <= n; l++) {
      const cur = new Array(n + 1).fill(Infinity), back = new Array(n + 1).fill(-1);
      for (let j = 1; j <= n; j++) {
        if (j < n && !open[j]) continue; // a line cannot end inside a tie
        for (let i = j - 1; i >= 0; i--) {
          if (i > 0 && !open[i]) continue;
          const w = span(i, j);
          if (w > box) break;
          if (prev[i] === Infinity) continue;
          const short = box - w, last = j === n;
          const above = l > 1 ? trail[l - 2][i] : -1; // where the line before this one starts
          const stack = above >= 0 && keys[i] && keys[i] === keys[above] ? (RAG_STACK * box) ** 2 : 0;
          const soft = !last && SOFT_END.has(keys[j - 1]) ? (RAG_SOFT * box) ** 2 : 0;
          let shape = 0;
          const above2 = l > 2 && above >= 0 ? trail[l - 3][above] : -1;
          if (above2 >= 0) { // the two lines before this one: i is where the first ends, `above` where the one before it ends
            const w1 = span(above, i), w2 = span(above2, above), step = RAG_STEP * box;
            if ((w - w1 > step && w1 - w2 > step) || (!last && w1 - w > step && w2 - w1 > step)) shape = (RAG_SHAPE * box) ** 2; // (lines that shrink into the last line are how a paragraph ends: no shape)
          }
          const cost = prev[i] + stack + soft + shape + (last ? (w < box * RAG_LAST_MIN ? short * short : RAG_LAST * short * short) : short * short);
          if (cost < cur[j]) { cur[j] = cost; back[j] = i; }
        }
      }
      trail.push(back);
      if (cur[n] < Infinity) { // the fewest lines that fit: take this one
        const starts = [];
        for (let j = n, k = trail.length - 1; k > 0; k--) { j = trail[k][j]; starts.unshift(j); }
        return starts;
      }
      prev = cur;
    }
    return null;
  }
  // A panel is its stage scaled to the panel's width (--s); the stage is as tall as the quote
  // needs, and never less than its minimum (css/admin.css), so nothing is cut and no room is
  // left over. The stage's own width changes with the breakpoint.
  function sizeFont() {
    [['fontView', 'fontStage'], ['fontViewNative', 'fontStageNative']].forEach(([v, st]) => {
      const view = $(v), stage = $(st);
      if (view.hidden) return;
      const w = view.clientWidth, sw = stage.offsetWidth;
      if (!w || !sw) return;
      const k = w / sw;
      stage.style.setProperty('--s', k.toFixed(4));
      stage.querySelectorAll('.quote').forEach((q) => { if (q.hasAttribute('data-short')) fitFont(q); evenLines(q); });
      view.style.height = `${Math.ceil(stage.offsetHeight * k)}px`;
    });
  }
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', sizeFont);
  if (typeof ResizeObserver === 'function') { const ro = new ResizeObserver(sizeFont); ro.observe($('fontView')); ro.observe($('fontViewNative')); }
  window.addEventListener('resize', sizeFont);
  // A local preview has no fonts Worker: the same faces, from the project's own folder.
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    const local = document.createElement('style');
    local.textContent = FONT_FILES.map((key) => `@font-face { font-family: '${FONTS.find((f) => f.value === key).label}'; src: url('/workers/fonts/files/${key}.woff2') format('woff2'); font-weight: 400; font-style: normal; font-display: swap; }`).join('\n');
    document.head.appendChild(local);
  }

  /* ---------- The quote faces (the Fonts tab) ----------
     Each face's size at each length, its leading and its tracking can be tuned here on a
     short, a medium and a long quote set as the archive sets them. What is saved (`faces`) is
     laid over css/fonts.css, here and on the site (data/faces.json, js/app.js → facesCSS).
     Save sends the whole table: the Worker commits it, and the site follows in about a
     minute. In the demo it is kept in this browser only. */
  const FACES_KEY = 'wwk-faces-demo';
  let faces = {};
  const faceStyle = document.createElement('style');
  document.head.appendChild(faceStyle);
  // The faces' tuned settings (data/faces.json, saved from the library's Fonts tab) laid over
  // css/fonts.css: per face its leading, its tracking (%) and its size against the tier's at
  // each length. The same function is in js/app.js: change both.
  function facesCSS(table) {
    const num = (v) => typeof v === 'number' && Number.isFinite(v);
    return Object.entries(table || {}).map(([key, f]) => {
      const s = f && f.scale;
      if (!/^[a-z]+$/.test(key) || !s || ![s.l, s.m, s.s, f.leading, f.tracking].every(num)) return '';
      const at = `[data-font="${key}"]`;
      return `${at} { --qf-leading: ${f.leading}; --qf-tracking: ${f.tracking / 100}em; }\n`
        + `${at}[data-tier="l"] { --qf-scale: ${s.l}; }\n${at}[data-tier="m"] { --qf-scale: ${s.m}; }\n`
        + `${at}[data-tier="s"], ${at}[data-tier="xs"] { --qf-scale: ${s.s}; }`;
    }).join('\n');
  }
  const applyFaces = () => { faceStyle.textContent = facesCSS(faces); };
  async function loadFaces() {
    try {
      if (remote) { const r = await call('/faces'); if (r.ok) faces = (await r.json()).faces || {}; }
      else {
        const kept = localStorage.getItem(FACES_KEY);
        if (kept) faces = JSON.parse(kept) || {};
        else { const r = await fetch('../data/faces.json', { cache: 'no-cache' }); if (r.ok) faces = await r.json(); }
      }
    } catch (e) { faces = {}; }
    applyFaces();
  }

  const TUNE = { scaleL: 'tScaleL', scaleM: 'tScaleM', scaleS: 'tScaleS', leading: 'tLeading', tracking: 'tTracking' }; // what can be tuned → its field
  const FACE_SAMPLES = [
    ['l', 'Short', 'You be it. Be about it.'],
    ['m', 'Medium', 'Anybody can play. The note is only 20 percent. The attitude of the motherfucker who plays it is 80 percent.'],
    ['s', 'Long', 'The amazing thing is that every atom in your body came from a star that exploded. And, the atoms in your left hand probably came from a different star than your right hand. It really is the most poetic thing I know about physics: You are all stardust.'],
  ];
  // A board holds no more than its length allows (the limits of tier(): a CJK character counts as 4).
  const TIER_MAX = { l: 64, m: 160, s: 260 };
  const weight = (text) => text.length + (text.match(/[぀-ヿ㐀-鿿가-힯]/g) || []).length * 3;
  const clip = (text, max) => { let out = ''; for (const ch of text) { if (weight(out + ch) > max) break; out += ch; } return out; };
  const FACE_LIST = [...FONTS.filter((f) => f.fresh), ...FONTS.filter((f) => !f.fresh)]; // the ones still being tuned first
  const face = {
    font: FACE_LIST[0].value,
    ref: false,                               // Comparison: the same words in Instrument under each quote (off until asked for)
    texts: FACE_SAMPLES.map((x) => x[2]),     // the boards' words: edited in place, kept from face to face
    tune: {},                                 // face → the values tried and not saved yet (only those that differ)
  };
  const editable = (() => { const d = document.createElement('div'); try { d.contentEditable = 'plaintext-only'; } catch (e) { /* older browsers */ } return d.contentEditable === 'plaintext-only' ? 'plaintext-only' : 'true'; })();
  const rnd = (n, d) => Math.round(n * 10 ** d) / 10 ** d;

  $('faceList').innerHTML = FACE_LIST.map((f) => `<button type="button" class="combo-item${f.fresh ? ' is-fresh' : ''}" role="option" data-font="${f.value}">${f.label}</button>`).join('');
  const openFaces = (open) => { $('faceList').hidden = !open; $('facePick').classList.toggle('is-open', open); $('faceBtn').setAttribute('aria-expanded', String(open)); };

  // What a face is set at now (fonts.css + what was saved), read from quotes of each length
  // that are not shown.
  function asSetOf(key) {
    const out = {};
    [['l', 'scaleL'], ['m', 'scaleM'], ['s', 'scaleS']].forEach(([t, id]) => {
      const probe = document.createElement('blockquote');
      probe.className = 'quote'; probe.dataset.tier = t; probe.dataset.font = key; probe.style.cssText = 'position:absolute;visibility:hidden';
      $('faceBoards').appendChild(probe);
      const cs = getComputedStyle(probe), px = parseFloat(cs.fontSize);
      out[id] = rnd(parseFloat(cs.getPropertyValue('--qf-scale')) || 1, 4);
      if (t === 'm') { out.leading = rnd(parseFloat(cs.lineHeight) / px, 3); out.tracking = cs.letterSpacing === 'normal' ? 0 : rnd(parseFloat(cs.letterSpacing) / px * 100, 2); }
      probe.remove();
    });
    return out;
  }
  function showFonts(key) {
    if (FONTS.some((f) => f.value === key)) face.font = key;
    admin.dataset.tab = 'fonts';
    document.querySelectorAll('.tab').forEach((a) => a.classList.toggle('is-active', a.dataset.tab === 'fonts'));
    $('ctaLive').hidden = $('ctaArchive').hidden = true; $('ctaFonts').hidden = false;
    switchView('fonts').then(drawFaces);
    refreshChrome();
  }
  function drawFaces() {
    const f = FONTS.find((x) => x.value === face.font);
    $('faceBoards').innerHTML = FACE_SAMPLES.map(([t, name], i) => `
      <section class="face-board" data-i="${i}">
        <p class="face-cap" data-name="${name}${f.not.includes(t) ? ' (not offered at this length)' : ''}"></p>
        <blockquote class="quote" data-tier="${t}" data-font="${f.value}" contenteditable="${editable}" spellcheck="false">${esc(face.texts[i])}</blockquote>
        ${face.ref && f.value !== 'instrument' ? `<blockquote class="quote is-ref" data-tier="${t}" data-font="instrument">${esc(face.texts[i])}</blockquote>` : ''}
      </section>`).join('');
    // A face has one leading and one tracking, so those apply at every length; a scale applies
    // to its own. A value put back to what is saved is no longer a change.
    const asSet = asSetOf(f.value), tune = face.tune[f.value] || {};
    Object.keys(tune).forEach((id) => { if (tune[id] === asSet[id]) delete tune[id]; });
    if (!Object.keys(tune).length) delete face.tune[f.value];
    const now = (id) => (tune[id] != null ? tune[id] : asSet[id]);
    const was = (id, unit = '') => (now(id) !== asSet[id] ? `was ${asSet[id]}${unit}` : '');
    $('faceBoards').querySelectorAll('.quote:not(.is-ref)').forEach((q) => {
      const id = { l: 'scaleL', m: 'scaleM' }[q.dataset.tier] || 'scaleS';
      if (tune.leading != null) q.style.setProperty('--qf-leading', tune.leading);
      if (tune.tracking != null) q.style.setProperty('--qf-tracking', `${tune.tracking / 100}em`);
      if (tune[id] != null) q.style.setProperty('--qf-scale', tune[id]);
      q.closest('.face-board').dataset.was = [was('leading'), was('tracking', '%'), was(id)].join('|');
    });
    Object.entries(TUNE).forEach(([id, el]) => { if (document.activeElement !== $(el)) $(el).value = now(id); });
    $('facesReset').disabled = !face.tune[f.value];
    $('facesSave').disabled = !Object.keys(face.tune).length;
    $('faceBtn').textContent = f.label; $('faceBtn').classList.toggle('is-fresh', !!f.fresh);
    $('faceList').querySelectorAll('.combo-item').forEach((b) => {
      const on = b.dataset.font === f.value;
      b.setAttribute('aria-selected', String(on));
      b.innerHTML = esc(b.textContent) + (on ? '<span class="icon icon-asterisk"></span>' : '');
    });
    $('faceRef').setAttribute('aria-pressed', String(face.ref)); $('faceRef').textContent = face.ref ? 'On' : 'Off';
    captionFaces();
  }
  // Over each board, what the browser really set: size, leading, tracking, sets.
  function captionFaces() {
    $('faceBoards').querySelectorAll('.face-board').forEach((board) => {
      const q = board.querySelector('.quote'), cs = getComputedStyle(q), size = parseFloat(cs.fontSize);
      const track = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) / size * 100;
      const [wasL, wasT, wasS] = (board.dataset.was || '||').split('|').map((w) => (w ? ` (${w})` : ''));
      board.querySelector('.face-cap').textContent = [
        board.querySelector('.face-cap').dataset.name,
        `${rnd(size, 1)}px${wasS}`,
        `Leading ${rnd(parseFloat(cs.lineHeight) / size, 3)}${wasL}`,
        `Tracking ${rnd(track, 2)}%${wasT}`,
        (cs.fontFeatureSettings === 'normal' ? '' : cs.fontFeatureSettings.replace(/"/g, '').replace(/ 1\b/g, '').split(/,\s*/).filter((f) => f !== 'liga' && f !== 'clig').join(', ')) || 'No sets', // ligatures are on in every face (fonts.css): not listed
      ].join('. ');
    });
  }
  // Save: every face with values tried out, at once.
  async function saveFaces() {
    const next = clone(faces);
    Object.keys(face.tune).forEach((key) => {
      const v = { ...asSetOf(key), ...face.tune[key] };
      next[key] = { scale: { l: v.scaleL, m: v.scaleM, s: v.scaleS }, leading: v.leading, tracking: v.tracking };
    });
    $('facesSave').disabled = true;
    if (remote) {
      let r;
      try { r = await call('/faces', 'PUT', { faces: next }); } catch (e) { r = null; }
      if (r && r.status === 401) { await signIn(); return saveFaces(); }
      if (!r || !r.ok) { $('facesSave').disabled = false; if (await ask('That could not be saved. Nothing on the site changed.', 'Try again', 'Not yet')) return saveFaces(); return; }
      faces = (await r.json()).faces;
    } else { faces = next; localStorage.setItem(FACES_KEY, JSON.stringify(faces)); }
    face.tune = {};
    applyFaces();
    drawFaces();
    sizeFont();
    toast('Saved');
  }

  $('fontsView').addEventListener('click', (e) => {
    if (!e.target.closest('#facePick')) openFaces(false);
    const b = e.target.closest('.combo-item, #faceBtn, #faceRef');
    if (!b) return;
    if (b.id === 'faceBtn') { openFaces($('faceList').hidden); return; }
    if (b.dataset.font) { openFaces(false); face.font = b.dataset.font; }
    else face.ref = !face.ref;
    drawFaces();
  });
  // On the face dropdown: ↑ ↓ step through the faces (open or closed), Escape closes.
  $('facePick').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { openFaces(false); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const i = FACE_LIST.findIndex((f) => f.value === face.font) + (e.key === 'ArrowDown' ? 1 : -1);
    face.font = FACE_LIST[(i + FACE_LIST.length) % FACE_LIST.length].value;
    drawFaces();
    $('faceBtn').focus();
  });
  Object.entries(TUNE).forEach(([id, el]) => $(el).addEventListener('input', () => {
    const v = parseFloat($(el).value), tune = face.tune[face.font] || (face.tune[face.font] = {});
    if (Number.isFinite(v)) tune[id] = v; else delete tune[id];
    drawFaces();
  }));
  // The words are edited in the board itself; Instrument's copy follows.
  $('faceBoards').addEventListener('input', (e) => {
    const q = e.target.closest('.quote[contenteditable]');
    if (!q) return;
    const board = q.closest('.face-board'), max = TIER_MAX[q.dataset.tier];
    let text = q.innerText.replace(/\n$/, '');
    if (weight(text) > max) { // pasted past the limit: cut to it, the caret at the end
      text = clip(text, max);
      q.textContent = text;
      const end = document.createRange(); end.selectNodeContents(q); end.collapse(false);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(end);
    }
    face.texts[board.dataset.i] = text;
    const ref = board.querySelector('.is-ref');
    if (ref) ref.textContent = text;
    captionFaces();
  });
  // Typing stops at the board's limit (what is selected makes room).
  $('faceBoards').addEventListener('beforeinput', (e) => {
    const q = e.target.closest && e.target.closest('.quote[contenteditable]');
    if (!q || !e.inputType.startsWith('insert') || e.inputType === 'insertFromPaste' || e.isComposing) return;
    const sel = getSelection(), picked = sel.rangeCount && q.contains(sel.anchorNode) ? weight(sel.toString()) : 0;
    if (weight(q.innerText.replace(/\n$/, '')) - picked + weight(e.data || '\n') > TIER_MAX[q.dataset.tier]) e.preventDefault();
  });
  $('facesReset').addEventListener('click', () => { delete face.tune[face.font]; if (document.activeElement) document.activeElement.blur(); drawFaces(); });
  $('facesSave').addEventListener('click', saveFaces);
  window.addEventListener('resize', () => { if (admin.dataset.view === 'fonts') captionFaces(); });
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => { if (admin.dataset.view === 'fonts') captionFaces(); });

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
    // is-settled (css): once open, what is inside may reach out of the fold — a dropdown's list
    // (the language under the original words) was cropped at the fold's edge, and scrolled the
    // fold's content up when it opened.
    if (open) { if (!el.hidden && el.classList.contains('is-open')) return; el.hidden = false; void el.offsetHeight; el.classList.add('is-open'); foldTimers.set(el, setTimeout(() => el.classList.add('is-settled'), ms(FOLD_MS))); }
    else { if (el.hidden) return; el.classList.remove('is-open', 'is-settled'); foldTimers.set(el, setTimeout(() => { el.hidden = true; }, ms(FOLD_MS))); }
  }
  function foldNow(el, open) { clearTimeout(foldTimers.get(el)); el.style.transition = 'none'; el.hidden = !open; el.classList.toggle('is-open', open); el.classList.toggle('is-settled', open); void el.offsetHeight; el.style.transition = ''; }

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
  function combo(host, { options: source, placeholder, free = false, keep = false, select = false, onChange }) {
    // `source`: a list, or what makes it (the faces depend on the quote). `keep`: a value that
    // is changed, never cleared — the chevron stays, and an emptied field takes its value back.
    const all = () => (typeof source === 'function' ? source() : source);
    host.classList.add('combo');
    host.innerHTML = `<input class="field" type="text" placeholder="${placeholder}" autocomplete="off" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-label="${placeholder}">
      <button type="button" class="combo-btn" tabindex="-1" aria-label="Open"><span class="icon icon-chevron"></span></button>`;
    const input = host.querySelector('input'), btn = host.querySelector('.combo-btn'), icon = btn.querySelector('.icon');
    if (select) { input.readOnly = true; host.classList.add('combo--select'); input.removeAttribute('aria-autocomplete'); } // `select`: picked from the list only, never typed into (js/form.js → combo)
    let list = null, bar = null, value = '', kept = '', hover = -1, shown = [], silent = false;
    const drawBar = () => { if (!list || !bar) return; const { scrollHeight: sh, clientHeight: ch, scrollTop: st, offsetTop: top } = list; if (sh <= ch + 1) { bar.hidden = true; return; } bar.hidden = false; const h = Math.max(24, (ch / sh) * ch); bar.style.top = `${top + (st / (sh - ch)) * (ch - h)}px`; bar.style.height = `${h}px`; };
    const setValue = (v, lbl) => { value = v; if (v) kept = v; input.value = lbl || ''; host.classList.toggle('has-value', !!v); icon.className = 'icon ' + (v && !keep ? 'icon-x' : 'icon-chevron'); btn.setAttribute('aria-label', v && !keep ? 'Clear' : 'Open'); if (!silent) onChange(v); };
    const close = () => { if (!list) return; list.remove(); list = null; hover = -1; if (bar) { bar.remove(); bar = null; } host.classList.remove('is-open'); input.setAttribute('aria-expanded', 'false'); };
    const render = (q) => {
      const s = q.trim().toLowerCase();
      const options = all();
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
      const t = input.value.trim(), options = all();
      const exact = options.find((o) => o.label.toLowerCase() === t.toLowerCase());
      if (exact) setValue(exact.value, exact.label);
      else if (free && t) setValue(t, t);
      else if (keep) { silent = true; setValue(kept, (all().find((o) => o.value === kept) || FONTS.find((o) => o.value === kept))?.label || ''); silent = false; }
      else if (!t) setValue('', '');
      else setValue(value, options.find((o) => o.value === value)?.label || (free ? value : ''));
      close();
    };
    input.addEventListener('focus', () => render(value ? '' : input.value));
    input.addEventListener('click', () => { if (!list) render(value ? '' : input.value); });
    input.addEventListener('input', () => { if (value) { value = ''; host.classList.remove('has-value'); icon.className = 'icon icon-chevron'; if (!keep) onChange(''); } render(input.value); });
    input.addEventListener('blur', settle);
    input.addEventListener('keydown', (e) => {
      if (composing(e)) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); if (!list) render(input.value); setHover(hover + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHover(hover - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); if (list && hover >= 0) pick(hover); else if (list && shown.length === 1) pick(0); else settle(); }
      else if (e.key === 'Escape') { e.preventDefault(); settle(); }
      else if (e.key === 'Tab') settle();
    });
    btn.addEventListener('pointerdown', (e) => e.preventDefault());
    btn.addEventListener('click', () => { if (value && !keep) { setValue('', ''); input.focus(); render(''); } else if (list) { close(); input.blur(); } else input.focus(); });
    return { input, set: (v) => { silent = true; const o = all().find((x) => x.value === v) || (keep ? FONTS.find((x) => x.value === v) : null); setValue(v, o ? o.label : (free ? v : '')); silent = false; } };
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

  /* ---------- Smooth (eased) wheel scrolling ----------
     The archive's notes pattern (js/app.js): the wheel moves a target and the page glides after
     it, covering SCROLL_EASE of the remaining distance every frame. Touch, keys and the rest stay
     native; a textarea or a dropdown under the pointer scrolls itself first. */
  const SCROLL_EASE = 0.11;   // lower = longer, silkier glide; higher = tighter
  const glide = { pos: 0, target: 0, raf: 0, at: 0 };
  const dropGlide = () => { cancelAnimationFrame(glide.raf); glide.raf = 0; };
  function glideStep() {
    if (Math.abs(scroll.scrollTop - glide.at) > 1) { glide.raf = 0; return; } // something else moved the page (a new view, a search)
    const gap = glide.target - glide.pos;
    glide.pos = Math.abs(gap) < 0.4 ? glide.target : glide.pos + gap * SCROLL_EASE; // kept as a fraction: scrollTop itself rounds
    scroll.scrollTop = glide.pos;
    glide.at = scroll.scrollTop;
    glide.raf = glide.pos === glide.target ? 0 : requestAnimationFrame(glideStep);
  }
  // An element under the pointer that can still scroll the way the wheel is going.
  function scrollsInside(el, dy) {
    for (; el && el !== scroll; el = el.parentElement) {
      if (el.scrollHeight <= el.clientHeight + 1 || !/auto|scroll/.test(getComputedStyle(el).overflowY)) continue;
      if (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
    }
    return false;
  }
  scroll.addEventListener('wheel', (e) => {
    if (reduceMotion.matches || e.ctrlKey || scrollsInside(e.target, e.deltaY)) return; // ctrl+wheel = pinch zoom
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? scroll.clientHeight : 1; // lines / pages → px
    if (!glide.raf) glide.pos = glide.target = glide.at = scroll.scrollTop;
    const max = scroll.scrollHeight - scroll.clientHeight;
    glide.target = Math.max(0, Math.min(max, glide.target + e.deltaY * unit));
    if (!glide.raf) glide.raf = requestAnimationFrame(glideStep);
  }, { passive: false });
  ['touchstart', 'mousedown'].forEach((type) => scroll.addEventListener(type, dropGlide, { passive: true }));
  window.addEventListener('keydown', dropGlide);

  /* ---------- Go ---------- */

  load().then(loadFaces).then(() => { refreshChrome(); route(); });
})();
