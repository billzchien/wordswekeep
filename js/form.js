/* Words We Keep — "Add words" submission form. Plain JS.
   Five steps + a thank-you screen, one screen each, slid like Typeform: Next, the arrows, the
   wheel, a swipe, ↑/↓ keys. Going back is always free; going forward is gated by the step's
   required fields: Next unfolds once they are filled (the down arrow stays grey till then), and
   an arrow/wheel/key attempt marks the empty ones with the warning state — only once something
   has been entered on the step: an untouched step just stays put (Bill, 2026-10-11).

   The payload matches data/quotes.json + the schema in md/handoff.md. submit()
   posts the entry to SUBMIT_URL (Worker #1); with SUBMIT_URL empty it keeps it in localStorage
   (`wwk-pending`) instead. */
(() => {
  // Cloudflare Worker #1 (workers/submit); '' = offline (localStorage + console). On a local
  // preview nothing is sent: the entry stays in this browser and the form carries on to "Words
  // submitted" as if it had gone (add ?real to the address to post to the Worker from localhost).
  const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !/[?&]real\b/.test(location.search);
  const SUBMIT_URL = LOCAL ? '' : 'https://api.wordswekeep.org/';

  const CATEGORIES = [
    { key: 'perspective', name: 'Perspective', desc: 'The lens we bring to life. Values, time, presence, and the search for meaning.' },
    { key: 'growth',      name: 'Growth',      desc: 'The hardships, changes, and realizations that shape who we become.' },
    { key: 'drive',       name: 'Drive',       desc: 'The work, ambition, and craft we pour into building something that matters.' },
    { key: 'community',   name: 'Community',   desc: 'The family, friends, and connections that remind us we’re not alone.' },
    { key: 'romance',     name: 'Romance',     desc: 'The joy and heartbreak of loving and being loved.' },
  ];
  // Source kinds. The site sets a title in italics only for book and film (js/app.js → ITALIC_KINDS).
  // "Personal" (something said to the submitter), or no kind chosen yet: no source name or link.
  // `hint`: what the empty source link field says for that kind — the platforms the site plays
  // (js/app.js → VIDEO). Any link is still taken. Without one: "Source link".
  // `name`: what the empty source name field says ("Song title"…). Without one: "Source name".
  const KINDS = [
    { value: 'book', label: 'Book', name: 'Book title' },
    { value: 'film', label: 'Film / TV', name: 'Film or show title', hint: 'Link to YouTube, Vimeo, or another site' },
    { value: 'song', label: 'Song', name: 'Song title', hint: 'Link to Apple Music, Spotify, YouTube, or other' },
    { value: 'poem', label: 'Poem', name: 'Poem title' },
    { value: 'speech', label: 'Speech / Interview', name: 'Event or show name', hint: 'Link to YouTube, Vimeo, or another site' },
    { value: 'writing', label: 'Writing', name: 'Title of the piece' },
    { value: 'social', label: 'Social media', name: 'Post or video title', hint: 'Link to YouTube, TikTok, Instagram, or other' },
    { value: 'personal', label: 'Personal' },
    { value: 'other', label: 'Other' },
  ];
  // ISO 3166-1 alpha-2; names from the browser (English), sorted.
  const REGION_CODES = ('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' ');
  const regionNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
  // Names the browser's list gets wrong for this site: Apple's says "China mainland".
  const REGION_FIX = { CN: 'China' };
  const regionName = (c) => REGION_FIX[c] || (regionNames ? regionNames.of(c) : c);
  const REGIONS = REGION_CODES.map((c) => ({ value: c, label: regionName(c) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  // Regions whose everyday script is not Latin: only there does "Name in original language" show
  // (elsewhere the Latin name is the original). Edit freely.
  const NON_LATIN = new Set(('CN TW HK MO JP KR KP MN RU UA BY KZ KG TJ BG MK RS ME BA GE AM GR CY IL IR IQ SA AE KW QA BH OM YE JO SY LB EG LY TN DZ MA MR SD PS AF PK IN BD NP LK BT MM TH LA KH ET ER SG').split(' '));
  // Who said or wrote it (Bill, 2026-10-06). `person` — a known person — is the default and what
  // every quote from before has. Each kind asks for its own fields (WHO_FIELDS); "Words from"
  // shows them as js/app.js → whoRows. The same list is in js/admin.js and workers/lib/entry.js.
  // "A fictional character" and "Other" (Bill, 2026-10-17): a character's name, and the country of
  // the film, show or book it is from — asked in "Where can we find this quote?", which loses
  // Personal and Speech / Interview for it (CHARACTER_SKIP); anything else (a band, a brand,
  // scripture, a stranger) a name and, if known, a country. Neither is ever looked up.
  const WHO = [
    { value: 'person', label: 'A known person', name: 'Name' },
    { value: 'acquaintance', label: 'Someone I know', name: 'A friend' },
    { value: 'self', label: 'Myself', name: 'Your first name' },
    { value: 'character', label: 'A fictional character', name: 'Character name' },
    { value: 'saying', label: 'A saying or proverb' },
    { value: 'other', label: 'Other', name: 'Name' },
    { value: 'unknown', label: 'Not sure' },
  ];
  const NAMED = new Set(['person', 'acquaintance', 'self', 'character', 'other']); // the kinds with a name and a country (the country never required: Bill, 2026-10-24)
  const CHARACTER_SKIP = new Set(['personal', 'speech']); // source kinds a fictional character is never from
  // Where a saying is from: a culture, a people, a language or a tradition, as it reads before
  // "proverb" ("Chinese proverb"). One not on the list can be typed. (js/admin.js has the same list.)
  const ORIGINS = ['African', 'Afghan', 'Albanian', 'American', 'Arabic', 'Armenian', 'Aboriginal Australian', 'Bengali', 'Brazilian', 'Buddhist',
    'Bulgarian', 'Burmese', 'Cambodian', 'Chinese', 'Croatian', 'Czech', 'Danish', 'Dutch', 'English', 'Estonian', 'Ethiopian', 'Filipino',
    'Finnish', 'French', 'Georgian', 'German', 'Ghanaian', 'Greek', 'Hawaiian', 'Hebrew', 'Hungarian', 'Icelandic', 'Igbo', 'Indian',
    'Indonesian', 'Irish', 'Italian', 'Jamaican', 'Japanese', 'Jewish', 'Kenyan', 'Korean', 'Kurdish', 'Latin', 'Latvian', 'Lithuanian',
    'Malay', 'Māori', 'Mexican', 'Mongolian', 'Native American', 'Nepali', 'Nigerian', 'Norwegian', 'Persian', 'Polish', 'Portuguese',
    'Punjabi', 'Romanian', 'Russian', 'Sanskrit', 'Scottish', 'Serbian', 'Slovak', 'Somali', 'Spanish', 'Sufi', 'Swahili', 'Swedish',
    'Tamil', 'Thai', 'Tibetan', 'Turkish', 'Ukrainian', 'Vietnamese', 'Welsh', 'Yiddish', 'Yoruba', 'Zen', 'Zulu']
    .sort((a, b) => a.localeCompare(b)).map((o) => ({ value: o, label: o }));
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
    author: { kind: 'person', name: '', nativeName: '', country: '', origin: '' },
    source: { kind: '', year: '', title: '', link: '' },
    context: '', annotations: [], reflection: '', keptBy: '',
  });
  let data = blank();
  let cur = 0;

  // A rough script sniff for the original-language code; the admin can correct it.
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
    // Danish, Norwegian, Swedish (Bill, 2026-10-23: No. 37, Kierkegaard, had come in as "other", its
    // button "Aa"). Danish and Norwegian share most words: each lists them, so only their own words
    // (mig/meg, af/av, hvad/hva…) tell them apart — and a text with none of those is left "other".
    da: [' og ', ' ikke ', ' det ', ' jeg ', ' til ', ' er ', ' har ', ' kan ', ' vil ', ' med ', ' som ', ' mig ', ' dig ', ' sig ', ' af ', ' hvad ', ' meget ', ' blive ', ' nu ', 'æ', 'ø', 'aa'],
    no: [' og ', ' ikke ', ' det ', ' jeg ', ' til ', ' er ', ' har ', ' kan ', ' vil ', ' med ', ' som ', ' meg ', ' deg ', ' seg ', ' av ', ' hva ', ' mye ', ' bli ', ' ikkje ', 'æ', 'ø'],
    sv: [' och ', ' inte ', ' är ', ' jag ', ' det ', ' att ', ' som ', ' för ', ' med ', ' har ', ' kan ', ' vill ', ' mig ', ' dig ', ' sig ', ' av ', ' vad ', 'ä', 'ö'],
  };
  // Where it is from settles a close call (Bill, 2026-10-23: "it should know because the country is chosen
  // as Denmark"): the author's country, or a saying's origin, names a Latin-script language here, and the
  // guess takes it when the words fit it at least as well as any other (one hint at least) — so Danish
  // and Norwegian, which share most words, come out as the country says; a Dane quoted in English
  // (no Danish words at all) stays as the words say.
  const PLACE_LANG = {
    DK: 'da', GL: 'da', FO: 'da', NO: 'no', SE: 'sv', AX: 'sv', DE: 'de', AT: 'de', LI: 'de', FR: 'fr', MC: 'fr',
    ES: 'es', MX: 'es', AR: 'es', CO: 'es', PE: 'es', CL: 'es', VE: 'es', EC: 'es', GT: 'es', CU: 'es', BO: 'es', DO: 'es',
    HN: 'es', PY: 'es', SV: 'es', NI: 'es', CR: 'es', PA: 'es', UY: 'es', PR: 'es', PT: 'pt', BR: 'pt', AO: 'pt', MZ: 'pt',
    IT: 'it', SM: 'it', NL: 'nl', SR: 'nl', PL: 'pl', TR: 'tr', VN: 'vi',
    Danish: 'da', Norwegian: 'no', Swedish: 'sv', German: 'de', French: 'fr', Spanish: 'es', Mexican: 'es', Portuguese: 'pt',
    Brazilian: 'pt', Italian: 'it', Dutch: 'nl', Polish: 'pl', Turkish: 'tr', Vietnamese: 'vi', Latin: 'la',
  };
  const placeOf = () => (data.author.country && data.author.country !== 'unsure' ? data.author.country : data.author.origin || ''); // (called once data is there)
  function detectLang(text, from = '') { // from: the author's country code, or a saying's origin
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
    const near = PLACE_LANG[from], own = near ? (scores.find(([c]) => c === near) || [, 0])[1] : 0;
    if (own >= 1 && own >= scores[0][1]) return near;
    return scores[0][1] >= 2 && scores[0][1] > scores[1][1] ? scores[0][0] : 'other';
  }

  // What is sent of the author: only the fields its kind asks for.
  function authorOut() {
    const a = data.author, t = (s) => s.trim(), kind = a.kind;
    const named = NAMED.has(kind);
    return {
      kind,
      name: named ? t(a.name) || null : null,
      nativeName: kind === 'person' && NON_LATIN.has(a.country) ? (t(a.nativeName) || null) : null,
      country: named ? sure(a.country) : null,
      origin: kind === 'saying' ? sure(t(a.origin)) : null,
    };
  }
  // Each kind's own check: a known person needs a name — the English or the one in its original
  // language, either will do; someone known, oneself, a fictional character and "Other", a name; a
  // saying, where it is from; "Not sure", nothing. The country is never required (Bill, 2026-10-24:
  // "let's not make the country mandatory"; it was for a known person, someone known and oneself):
  // left empty it is sent as none, as "Not sure" is, and the Worker takes it (workers/lib/entry.js).
  function authorOk() {
    const a = data.author;
    if (a.kind === 'saying') return !!a.origin.trim();
    if (a.kind === 'unknown') return true;
    return !!a.name.trim() || (a.kind === 'person' && NON_LATIN.has(a.country) && !!a.nativeName.trim());
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
      originalLanguage: original ? { lang: detectLang(original, placeOf()), text: original } : null,
      categories: CATEGORIES.map((c) => c.key).filter((k) => data.categories.includes(k)),
      author: authorOut(),
      // One link: the site plays it if it is a video (YouTube), otherwise links the source title to it.
      source: (data.source.title || data.source.kind || data.source.year || data.source.link)
        ? { title: hasSource ? (t(data.source.title) || null) : null, year: data.source.year ? Number(data.source.year) : null, kind: data.source.kind || null, link: hasSource ? (t(data.source.link) || null) : null }
        : null,
      context: capParas(t(data.context)) || null,
      annotations: data.annotations.filter((a) => a.word.trim() && (!a.in || original)).map((a) => ({ word: a.word.trim(), explanation: a.explanation.trim(), ...(a.in ? { in: a.in } : {}) })), // in: 'original' — a word of the original-language words
      reflection: capParas(t(data.reflection)),
      keptBy: t(data.keptBy) || null,
      submittedAt: new Date().toISOString(),
      approvedAt: null,
      website: $('fWebsite').value, // honeypot: must be empty
      elapsed: Math.round(performance.now()), // how long the page has been open: the Worker keeps nothing sent sooner than a person could
    };
  }

  /* ---------- Steps: validity, Next buttons, the counter ---------- */

  const valid = [
    () => data.text.trim().length > 0,
    () => data.categories.length > 0,
    authorOk,
    () => true,
    () => data.reflection.trim().length > 0,
  ];
  // The required fields of each step (for the warning state).
  const required = [
    () => [$('fText')],
    () => [],
    () => { // (with neither name, the warning goes on the English one)
      const a = data.author;
      if (a.kind === 'saying') return [$('fOrigin').querySelector('.field')];
      if (a.kind === 'unknown') return [];
      const native = a.kind === 'person' && NON_LATIN.has(a.country) && a.nativeName.trim();
      return [native ? null : $('fName')]; // (the country is never required)
    },
    () => [],
    () => [$('fReflection')],
  ];

  function refresh() {
    steps.forEach((s, i) => {
      const next = s.querySelector('[data-next]');
      if (!next) return;
      next.disabled = !valid[i]();
      const wrap = next.closest('.next-wrap');
      if (wrap) wrap.classList.toggle('is-in', valid[i]()); // steps 1–3: Next appears once there is what it needs, in its kept space
    });
    $('submitBtn').disabled = !valid[4]();
    // Step 5, as the thoughts box: the name, then "Add words" and its line, appear once there are
    // words, and go if they are deleted (Bill, 2026-10-10) — in space kept for them (css .reveal).
    $('fKeptByWrap').classList.toggle('is-in', valid[4]()); $('submitWrap').classList.toggle('is-in', valid[4]());
    // Step 1: "In original language +" appears once the words in English are typed, and goes if they
    // are deleted (Bill, 2026-10-22) — in its kept space, so Next below it never moves.
    $('origToggleIn').classList.toggle('is-in', !!data.text.trim()); $('ideaIn').classList.toggle('is-in', !data.text.trim()); // (while it is empty, "Need an idea" in that place: ideas)
    // Step 3: "Where can we find this quote?" appears once "Who said or wrote it?" is answered, and
    // goes if it is undone (Bill, 2026-10-17) — in its kept space, so nothing moves; what was
    // chosen there stays. Arrived, it drops the slide's translate (a translate makes a layer, and
    // its dropdowns' lists must open over what follows, as in a settled fold).
    const src = $('sourceGroup'), srcIn = valid[2]();
    if (srcIn !== src.classList.contains('is-in')) {
      src.classList.toggle('is-in', srcIn);
      clearTimeout(refresh.srcT);
      src.classList.remove('is-settled');
      if (srcIn) refresh.srcT = setTimeout(() => src.classList.add('is-settled'), reduceMotion.matches ? 0 : FOLD_MS);
    }
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

  // Has anything been entered on the step? A fresh step is never warned about (its Next is not
  // there yet, the arrow is grey): the warning is for a step begun and left short. "Who said or
  // wrote it?" starts picked, so it does not count; a ticked category does.
  function touched(step) {
    const el = steps[step];
    return [...el.querySelectorAll('.field')].some((f) => !f.closest('#fWho') && f.value.trim())
      || !!el.querySelector('input[type="checkbox"]:checked, [aria-checked="true"]');
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

  // A required question's asterisk comes in after its screen has: from nothing to full size
  // while it makes half a turn and fades in, over REQ_IN_MS, REQ_WAIT_MS after the screen
  // started to come in (the step's slide and step 1's blocks on arriving are both over well
  // before). Unseen until then.
  const REQ_IN_MS = 300, REQ_WAIT_MS = 1000;
  function reqIn(step, wait = REQ_WAIT_MS) {
    if (reduceMotion.matches) return;
    const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease').trim() || 'ease';
    step.querySelectorAll('.req').forEach((el) => {
      el.getAnimations().forEach((a) => a.cancel());
      el.animate([{ scale: 0, rotate: '-180deg', opacity: 0 }, { scale: 1, rotate: '0deg', opacity: 1 }], { duration: REQ_IN_MS, delay: wait, easing, fill: 'backwards' });
    });
  }

  // Desktop: once a step is in, the cursor waits in its first empty required field (Bill,
  // 2026-10-11: one sees where to type) — and on step 4 in the context, optional as it is (Skip
  // is right there). Only a typing field — never a dropdown, whose list focus
  // would open — and only if nothing else has been clicked into meanwhile. Not with a touch
  // screen: a phone would throw its keyboard up over every step.
  const FINE_POINTER = window.matchMedia('(hover: hover) and (pointer: fine)');
  function focusStep(step, wait) {
    clearTimeout(focusStep.t);
    if (!FINE_POINTER.matches || step >= STEPS) return;
    focusStep.t = setTimeout(() => {
      const a = document.activeElement;
      if (cur !== step || !sheet.hidden || (a && a !== document.body)) return;
      const field = (step === 3 ? [$('fContext')] : required[step]()).find((f) => f && f.matches('input, textarea') && !f.closest('.combo') && !f.value.trim() && f.offsetParent);
      if (field) field.focus({ preventScroll: true });
    }, wait);
  }

  // A browser that clearly cannot keep up gets no "Words submitted" sound (Bill, 2026-10-16: "for low
  // performance browser also we can remove the sound"), as the notes play theirs only with the full scan.
  // Slow = the archive has already stepped this tab down (sessionStorage wwk-scan, js/app.js watchScan), or
  // two of the form's own step slides were slow by the notes' rule: past the first frame, one held
  // SLOW_HOLD_MS or the median over SLOW_FRAME_MS (under 25 fps). The form's verdict is its own
  // (wwk-form-slow), for the tab; the archive is not told. Only rAF timestamps are read: nothing written.
  const SLOW_HOLD_MS = 100, SLOW_FRAME_MS = 40, SLOW_TO_QUIET = 2, STEP_SLIDE_MS = 600;
  let slowSeen = 0;
  const slowTab = () => { try { return Number(sessionStorage.getItem('wwk-scan')) >= 1 || sessionStorage.getItem('wwk-form-slow') === '1'; } catch (e) { return false; } };
  function watchSlide() {
    if (reduceMotion.matches || slowTab()) return;
    const gaps = []; let last = 0, until = 0;
    const tick = (now) => {
      if (last) gaps.push(now - last); else until = now + STEP_SLIDE_MS;
      last = now;
      if (now < until) { requestAnimationFrame(tick); return; }
      const after = gaps.slice(1);
      if (document.hidden || after.length < 4 || Math.max(...after) > 1000) return; // a tab put away meanwhile: no verdict
      const median = after.slice().sort((a, b) => a - b)[after.length >> 1];
      if (Math.max(...after) < SLOW_HOLD_MS && median <= SLOW_FRAME_MS) return;
      if (++slowSeen >= SLOW_TO_QUIET) { try { sessionStorage.setItem('wwk-form-slow', '1'); } catch (e) {} }
    };
    requestAnimationFrame(tick);
  }

  let sliding = false;
  // The step with the source link: going on waits for its check (LINK_WAIT_MS at most; no answer
  // = no warning). A warning keeps the visitor here; the next Next goes on (the link is gone).
  const LINK_STEP = 2, LINK_WAIT_MS = 5000;
  let linkGate = false;
  function go(i, { force = false } = {}) {
    if (i < 0 || i > STEPS || i === cur || sliding) return;
    if (i > cur && !force) {
      if (!valid[cur]()) { if (touched(cur)) warn(cur); return; }
      if (cur === LINK_STEP && !linkGate && !$('fSourceLinkWrap').hidden && $('fSourceLink').value.trim()) {
        linkGate = true;
        Promise.race([checkSourceLink(), new Promise((done) => setTimeout(() => done(false), LINK_WAIT_MS))])
          .then((warned) => { if (!warned) go(i); linkGate = false; });
        return;
      }
      i = cur + 1; // one step at a time going forward: each gate in turn
    }
    if (i >= STEPS && !force) return; // the done screen is reached by submit() only
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    cur = i;
    if (i === STEPS - 1 && window.Music) Music.unlock(); // the last step: the sound's audio woken now (a click or key of the visitor's brought them here), so Add words finds it awake — woken at that click, the speakers took a moment and the bell came late
    stepsEl.style.transform = `translateY(${-cur * 100}%)`;
    steps[cur].scrollTop = 0;
    reqIn(steps[cur]); // its asterisks come in once the step has slid in
    sliding = !reduceMotion.matches;
    setTimeout(() => { sliding = false; }, reduceMotion.matches ? 0 : 600);
    if (i < STEPS) watchSlide(); // (the slide to "Words submitted" comes with its sound: judged before)
    focusStep(cur, reduceMotion.matches ? 0 : 600); // once it has slid in
    refresh();
  }

  /* ---------- Navigation: buttons, keys, wheel, swipe ---------- */

  document.querySelectorAll('[data-next]').forEach((b) => b.addEventListener('click', () => go(cur + 1)));
  // A pressed arrow rolls as the archive's do (js/app.js → press), in time with the step's
  // slide: it leaves its box (.arrow-crop) the way it points, the box is empty for a moment,
  // and the same arrow comes in from the other side, landing as the step does (600ms in all).
  // Only when the step really changed. (`translate`: the lower arrow is turned by a transform.)
  const ARROW_ROLL_MS = 200, STEP_MS = 600; // each half; the slide (css --step-ms)
  function press(btn, dir) {
    const from = cur;
    go(cur + dir);
    if (cur === from || reduceMotion.matches) return;
    const icon = btn.querySelector('.arrow-crop .icon');
    const timing = { duration: ARROW_ROLL_MS, easing: getComputedStyle(document.documentElement).getPropertyValue('--ease').trim() || 'ease', fill: 'both' };
    icon.getAnimations().forEach((a) => a.cancel());
    icon.animate([{ translate: '0 0' }, { translate: `0 ${dir * 100}%` }], timing);
    setTimeout(() => {
      icon.getAnimations().forEach((a) => a.cancel());
      icon.animate([{ translate: `0 ${dir * -100}%` }, { translate: '0 0' }], timing);
      setTimeout(() => icon.getAnimations().forEach((a) => { if (a.playState === 'finished') a.cancel(); }), ARROW_ROLL_MS + 30);
    }, STEP_MS - ARROW_ROLL_MS);
  }
  $('prevBtn').addEventListener('click', (e) => press(e.currentTarget, -1));
  $('nextBtn').addEventListener('click', (e) => press(e.currentTarget, 1));

  // An Enter (or arrow) that belongs to an IME — picking a candidate in Chinese, Japanese, Korean —
  // is not ours. Safari reports the confirming Enter with isComposing false, but keyCode 229.
  const composing = (e) => e.isComposing || e.keyCode === 229;
  // Return starts a new paragraph in any text box (Bill, 2026-10-09): a blank line — what the site
  // reads as one (js/app.js → paragraphs), so the box shows the paragraphs as they will be.
  // Shift+Return breaks the line inside the paragraph. Never more than one blank line between two
  // paragraphs, none before the first; a Return beside a blank line already there just moves on to
  // the next paragraph. (The same in js/form.js and js/admin.js: change both.)
  document.addEventListener('keydown', (e) => {
    const ta = e.target;
    if (e.key !== 'Enter' || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey || composing(e) || !ta.matches || !ta.matches('textarea.field') || ta.readOnly) return;
    e.preventDefault();
    const v = ta.value, s0 = ta.selectionStart, s1 = ta.selectionEnd;
    if (!v.slice(0, s0).trim()) return; // nothing before it yet
    const nb = v.slice(0, s0).match(/\n*$/)[0].length, na = v.slice(s1).match(/^\n*/)[0].length;
    const add = '\n'.repeat(Math.max(0, 2 - nb - na));
    if (add || s0 !== s1) { if (!document.execCommand('insertText', false, add)) { ta.setRangeText(add, s0, s1, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); } } // (insertText keeps the box's own undo)
    const at = s0 + add.length + na; ta.setSelectionRange(at, at);
  });
  // sessionStorage throws when site data is blocked (strict privacy settings, some in-app browsers).
  const session = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
    remove(k) { try { sessionStorage.removeItem(k); } catch (e) {} },
  };
  const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  document.addEventListener('keydown', (e) => {
    if (composing(e)) return;
    if (!sheet.hidden) { if (e.key === 'Escape') { if (sheet.classList.contains('is-ref-open')) setRefOpen(false); else closeSheet(); } return; } // (the words to look back at close first)
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
  const WHEEL_MIN = 100, WHEEL_COOLDOWN_MS = 700; // (100, not 40, since 2026-10-05: a light trackpad touch turned the page — Bill)
  let wheelAcc = 0, wheelLock = 0, wheelTimer = 0;
  function canScroll(el, dir) {
    if (!el) return false;
    return dir > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0;
  }
  // A tall step scrolls itself first; the page turns only from a fresh gesture once the content
  // has rested at its edge for SCROLL_REST_MS (trackpad inertia otherwise runs straight through).
  const SCROLL_REST_MS = 400;
  let lastScrollAt = 0;
  // Any scrolling in the form counts — a step, a textarea, a dropdown's list — so a gesture's
  // inertia that runs out of a field never turns the page. (scroll does not bubble: caught on the way down.)
  form.addEventListener('scroll', () => { lastScrollAt = performance.now(); }, { passive: true, capture: true });
  document.addEventListener('wheel', (e) => {
    if (!sheet.hidden || cur >= STEPS || e.ctrlKey) return;
    if (e.target.closest('.combo.is-open')) return; // an open dropdown owns the wheel, even at the end of its list (a page turn would close it)
    // A field that scrolls (a long textarea) owns the wheel, even at its top or bottom: scrolling in
    // a field never turns the page (Bill, 2026-10-05). A field too short to scroll is the page's.
    const fieldEl = e.target.closest('.fw') && e.target.closest('textarea, .combo-list');
    if (fieldEl && fieldEl.scrollHeight > fieldEl.clientHeight + 1) {
      if (!canScroll(fieldEl, Math.sign(e.deltaY))) e.preventDefault(); // at its end: stays put (no page scroll, no page turn)
      return;
    }
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
    wheelAcc += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1); // lines / pages → px (a mouse wheel in Firefox can report lines)
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { wheelAcc = 0; }, 180);
    if (Math.abs(wheelAcc) >= WHEEL_MIN) {
      wheelAcc = 0;
      wheelLock = now + WHEEL_COOLDOWN_MS;
      go(cur + dir);
    }
  }, { passive: false });

  let touchY = null, touchT = 0, touchInField = false;
  document.addEventListener('touchstart', (e) => {
    touchY = e.touches[0].clientY; touchT = performance.now();
    const f = e.target.closest && e.target.closest('.fw') && e.target.closest('textarea, .combo-list');
    touchInField = !!f && f.scrollHeight > f.clientHeight + 1; // a swipe in a field that scrolls never turns the page
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (touchY === null || !sheet.hidden || cur >= STEPS) return;
    const dy = touchY - e.changedTouches[0].clientY;
    touchY = null;
    const dir = Math.sign(dy);
    if (Math.abs(dy) < 60 || performance.now() - touchT > 600) return;
    if (touchInField || canScroll(steps[cur], dir) || isTyping(document.activeElement)) return;
    go(cur + dir);
  }, { passive: true });

  /* ---------- Curly quotes, as typed ----------
     A straight ' or " typed or pasted into a text field becomes a curly one (Bill, 2026-10-05),
     by the library's Auto cleanup rule (js/admin.js → cleanup): after the start, a space, an
     opening bracket or another opening quote it opens (“ ‘); anywhere else it closes (” ’ — an
     apostrophe too). A ' before a digit is an apostrophe: ’90s. Not in the link, nor in a
     dropdown's search (it would no longer match "Côte d'Ivoire"), nor mid-composition (an IME).
     One character for one, so the caret stays where it was. Caught first (capture), so the
     field's own handler reads the curly text. */
  function curlyQuotes(t) {
    return t
      .replace(/(^|[\s(\[“‘—–-])'(?=\d)/g, '$1’')
      .replace(/(^|[\s(\[“‘—–-])"/g, '$1“').replace(/"/g, '”')
      .replace(/(^|[\s(\[“‘—–-])'/g, '$1‘').replace(/'/g, '’');
  }
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (e.isComposing || !el.matches || !el.matches('textarea.field, input.field[type="text"]') || el.closest('.combo') || el.id === 'fWebsite') return;
    if (!/['"]/.test(el.value)) return;
    const a = el.selectionStart, b = el.selectionEnd;
    el.value = curlyQuotes(el.value);
    el.setSelectionRange(a, b);
  }, true);

  /* ---------- Textareas: the dropdown's 2px overlay scrollbar ---------- */
  // Same bar as the combobox list: the native one is hidden (css), a 2px black bar over the
  // right edge shows the visible fraction, never shorter than 24px, gone when nothing scrolls.
  // (Also for each annotation's explanation as its row is drawn: textareaBar.)
  function textareaBar(ta) {
    if (ta.dataset.bar) return;
    ta.dataset.bar = '1';
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
  }
  document.querySelectorAll('textarea.field').forEach(textareaBar);

  // Traditional or simplified Chinese (js/app.js → isHant: change both).
  const HANT_ONLY = /[說這們過時會來個為與學國對開關麼見現發經長點無還將當動從實後問進間頭東車門書話認樣電種總體歲氣讓應議處覺親邊雖萬誰聽廣際隊陽燈愛歡飛龍風馬鳥魚謂緣遠漸塊積塵習樂淚夢聲憶戀讀寫語衛華葉燒紅綠線給結終錯鐘難歷戰爭張紀記許該誤調請謝識變義藝劇嗎麗歐傳價優億盡屬歸斷雙舊雜響顏顯驗滿漢灣熱爾獨環畫盤確禮離筆節糧級細網練織臉興舉藥虛蘭術補視觀計訴詩詞試誠論證讚貝負財貨貴買費賣質輕載輪農運達遲選遺郵鄉醫釋鐵錢閉陳隨險雞靜韓頁順須預領題願類飯館驚齊齒]/g;
  const HANS_ONLY = /[说这们过时会来个为与学国对开关么见现发经长点无还将当动从实后问进间头东车门书话认样电种总体岁气让应议处觉亲边虽万谁听广际队阳灯爱欢飞龙风马鸟鱼谓缘远渐块积尘习乐泪梦声忆恋读写语卫华叶烧红绿线给结终错钟难历战争张纪记许该误调请谢识变义艺剧吗丽欧传价优亿尽属归断双旧杂响颜显验满汉湾热尔独环画盘确礼离笔节粮级细网练织脸兴举药虚兰术补视观计诉诗词试诚论证赞贝负财货贵买费卖质轻载轮农运达迟选遗邮乡医释铁钱闭陈随险鸡静韩页顺须预领题愿类饭馆惊齐齿]/g;
  const isHant = (text) => (text.match(HANT_ONLY) || []).length > (text.match(HANS_ONLY) || []).length;
  // Typed text in its own script's font (Bill, 2026-10-07), as the archive sets typed text: every
  // field has Crimson Pro first and then each script's Noto (css: --font-field), so the browser
  // takes each letter from the first font that has it — "The Analects 論語" works. Traditional
  // Chinese takes Noto Sans TC, Japanese JP, Korean KR (data-cjk). And every field reads in the
  // direction of what is typed (dir="auto").
  // The same helper is in js/admin.js: change both.
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
  // letters, so its Noto fonts are copies drawn smaller: the page reads the Google fonts' @font-face rules (served by workers/fonts)
  // and adds them again as "Field Noto …" with size-adjust — Chinese, Japanese, Korean at the
  // site's 80% (--quote-native-scale), every other script at the script scale (--script-scale):
  // Greek and Cyrillic in Noto Serif (ahead of Crimson Pro, as the archive sets them), Arabic,
  // Hebrew, Thai, Devanagari, and the Notos of the other scripts someone may type (fetched here:
  // the pages don't load them). Only each script's own letters are copied — Latin stays Crimson
  // Pro at full size. Nothing changes size while typing: while a piece of one loads, its letter
  // shows in a system font at the same scale (form.css: Field Local), never at full size; those
  // stand in for good if those can't be read. The same copies are made in js/admin.js: change both.
  (function fieldFonts() {
    const CJK = ['Noto Sans SC', 'Noto Sans TC', 'Noto Sans JP', 'Noto Sans KR'];
    const SCRIPT = ['Noto Serif', 'Noto Sans Arabic', 'Noto Sans Hebrew', 'Noto Sans Thai', 'Noto Sans Devanagari', // (as the archive: nativeRuns)
      'Noto Sans Bengali', 'Noto Sans Tamil', 'Noto Sans Telugu', 'Noto Sans Kannada', 'Noto Sans Malayalam', 'Noto Sans Gujarati', 'Noto Sans Gurmukhi', 'Noto Sans Oriya', 'Noto Sans Sinhala', 'Noto Sans Georgian', 'Noto Sans Armenian', 'Noto Sans Ethiopic', 'Noto Sans Khmer', 'Noto Sans Lao', 'Noto Sans Myanmar']; // (any other script someone may type)
    const root = getComputedStyle(document.documentElement);
    const scaleOf = (fam) => (CJK.includes(fam) ? parseFloat(root.getPropertyValue('--quote-native-scale')) || 0.8 : SCRIPT.includes(fam) ? parseFloat(root.getPropertyValue('--script-scale')) || 0.78 : 0);
    const hrefs = [...document.querySelectorAll('link[href*="fonts.wordswekeep.org/css2"]')].map((l) => l.href);
    const missing = [...CJK, ...SCRIPT].filter((fam) => !hrefs.some((h) => h.includes(`family=${fam.replace(/ /g, '+')}:`) || h.includes(`family=${fam.replace(/ /g, '+')}&`)));
    if (missing.length) hrefs.push(`https://fonts.wordswekeep.org/css2?${missing.map((fam) => `family=${fam.replace(/ /g, '+')}`).join('&')}&display=swap`);
    const whole = (css, h) => css.replace(/url\((\/[^)]+)\)/g, (m, u) => `url(${new URL(u, h).href})`); // the sheets' /g/… addresses are on the fonts host, not this page's
    Promise.all(hrefs.map((h) => fetch(h).then((r) => (r.ok ? r.text() : '')).then((css) => whole(css, h)).catch(() => ''))).then((sheets) => {
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

  /* ---------- Fields that appear and go (css .fold) ---------- */
  const FOLD_MS = 200;
  const foldTimers = new WeakMap();
  function fold(el, open) {
    clearTimeout(foldTimers.get(el));
    // is-settled (css): once open, what is inside may reach out of the fold — the country's list,
    // under the name row that folds with "Who said or wrote it?", would be cut at its edge.
    if (open) {
      if (!el.hidden && el.classList.contains('is-open')) return;
      el.hidden = false;
      void el.offsetHeight; // commit the folded state, then unfold
      el.classList.add('is-open');
      foldTimers.set(el, setTimeout(() => el.classList.add('is-settled'), reduceMotion.matches ? 0 : FOLD_MS));
    } else {
      if (el.hidden) return;
      el.classList.remove('is-open', 'is-settled');
      foldTimers.set(el, setTimeout(() => { el.hidden = true; }, reduceMotion.matches ? 0 : FOLD_MS));
    }
  }

  /* ---------- Already in the collection (Bill, 2026-10-11) ----------
     Two cases, both against the live quotes (data/quotes.json; a quote still waiting in the
     library is not looked at — the library sees those):
     · The same words (step 1): the words, or the words in their original language, against
       every live quote's, loosely — a line typed a little differently, or only part of one,
       still counts (sameWords). Then (Bill, 2026-10-18; it was a line under Next) "We found
       matching or similar words in our collection." fades in above the buttons, and Next gives
       way to "Continue" (Next, by another name) + "Add thoughts instead": that quote's notes in
       this tab with its thoughts box open (js/app.js → wwk-thought); "matching or similar words",
       its notes in a new tab (./<id>?notes, 404.html → wwk-notes). Nothing is blocked, and the
       library warns about such an entry (js/admin.js → sameWords, a copy: keep in step).
     · The same source, another line (step 3): the source link, or the source name with the same
       author, matches a live quote's. What they have left empty of the source (year, name,
       link) is filled from it, and a grey line unfolds under the source to say so (no space kept:
       these are one-line fields, nothing is being typed out under it — Bill); "already in the
       collection" opens that quote in a new tab (sameSource). */
  const SAME_MIN = 5;     // fewer words than this (CJK: characters) is never a match
  const SAME_RUN = 3;     // words are compared in runs of this many…
  const SAME_SHARE = 0.6; // …and a match is this share of the shorter one's runs found in the other
  let liveQuotes = [];
  fetch('data/quotes.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : [])).then((list) => { liveQuotes = list.filter((q) => q.status === 'live'); showSameWords(); }).catch(() => {});
  // Words, case and punctuation aside; a CJK character is a word of its own.
  const unitsOf = (s) => ((s || '').normalize('NFKC').toLowerCase().replace(/[‘’ʼ`´]/g, "'")
    .match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]|[\p{L}\p{N}']+/gu) || [])
    .map((w) => w.replace(/^'+|'+$/g, '')).filter(Boolean);
  function runsOf(units) {
    const out = new Set();
    for (let i = 0; i + SAME_RUN <= units.length; i++) out.add(units.slice(i, i + SAME_RUN).join(' '));
    return out;
  }
  function likeness(a, b) {
    const ua = unitsOf(a), ub = unitsOf(b);
    if (Math.min(ua.length, ub.length) < SAME_MIN) return 0;
    const ra = runsOf(ua), rb = runsOf(ub);
    const [small, big] = ra.size <= rb.size ? [ra, rb] : [rb, ra];
    let common = 0;
    small.forEach((r) => { if (big.has(r)) common++; });
    return common / small.size;
  }
  // → the live quote these words are, or null
  function sameWords(text, original) {
    let best = null, top = 0;
    liveQuotes.forEach((q) => {
      const theirs = [q.text, q.originalLanguage && q.originalLanguage.text];
      [text, original].forEach((mine) => theirs.forEach((t) => {
        if (!mine || !t) return;
        const v = likeness(mine, t);
        if (v >= SAME_SHARE && v > top) { top = v; best = q; }
      }));
    });
    return best;
  }
  let sameQuote = null;
  function showSameWords() {
    sameQuote = sameWords(data.text, data.original);
    // The line's room (css .next-wrap.has-dup): measured as it comes, so the step keeps its height.
    const note = $('dupNote'), wrap = note.parentElement;
    if (sameQuote) wrap.style.setProperty('--dup-h', `${note.querySelector('p').scrollHeight}px`);
    note.classList.toggle('is-in', !!sameQuote); wrap.classList.toggle('has-dup', !!sameQuote);
    $('nextBtns').classList.toggle('is-dup', !!sameQuote);
    $('dupPair').inert = !sameQuote;
    steps[0].querySelector('[data-next]').tabIndex = sameQuote ? -1 : 0; // (Next, faded: out of Tab's way)
    if (sameQuote) $('dupSee').dataset.href = `./${sameQuote.id}?notes`;
  }
  // Side by side while "Add thoughts instead" fits its half; one above the other, the primary on
  // top (moved, so Tab follows it), when it does not — measured as the column's width changes.
  function fitDupPair() {
    const pair = $('dupPair'), b = $('dupGo');
    pair.classList.remove('is-stacked'); pair.append(b);
    const cs = getComputedStyle(b), room = b.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const r = document.createRange(); r.selectNodeContents(b);
    if (!room || r.getBoundingClientRect().width <= room) return;
    pair.classList.add('is-stacked'); pair.prepend(b);
  }
  if (window.ResizeObserver) new ResizeObserver(fitDupPair).observe($('nextBtns'));
  if (document.fonts) document.fonts.ready.then(fitDupPair);
  // "Add thoughts instead": home, in this tab, the way the logo goes (the form fades out around
  // it), with that quote and the word to open its thoughts box.
  $('dupGo').addEventListener('click', (e) => {
    e.preventDefault();
    if (!sameQuote) return;
    keptWords.clear(); // they chose that quote's thoughts over these words: not kept for next time
    session.set('wwk-quote', String(sameQuote.id));
    session.set('wwk-thought', String(sameQuote.id));
    session.set('wwk-home', '1');
    form.classList.add('is-leaving');
    setTimeout(() => { location.href = './'; }, reduceMotion.matches ? 0 : 100);
  });
  $('dupGo').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.stopPropagation(); }); // (a button: Enter clicks it; it never turns the page)
  $('dupSee').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.stopPropagation(); e.target.click(); } }); // (a new tab: data-out, js → follow)

  // A link, as a key that ignores what does not change the page: www., a YouTube video by its
  // id (youtu.be, watch, shorts, embed; the time and tracking dropped), Apple Music's song (?i=).
  function linkKey(raw) {
    let u;
    try { u = new URL((raw || '').trim()); } catch (e) { return ''; }
    const host = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
    const yt = host === 'youtu.be' ? u.pathname.slice(1) : /(^|\.)youtube\.com$/.test(host) ? (u.searchParams.get('v') || (u.pathname.match(/^\/(shorts|embed|live)\/([^/]+)/) || [])[2]) : '';
    if (yt) return `yt:${yt}`;
    if (host === 'music.apple.com' && u.searchParams.get('i')) return `am:${u.searchParams.get('i')}`;
    return host + u.pathname.replace(/\/+$/, '').toLowerCase();
  }
  const nameKey = (s) => unitsOf(s).join(' ');
  // → the live quote with this source, or null
  function sameSource() {
    const src = data.source;
    if (!src.kind || src.kind === 'personal') return null;
    const link = linkKey(src.link), title = nameKey(src.title), who = nameKey(data.author.name);
    return liveQuotes.find((q) => {
      const s = q.source; if (!s) return false;
      if (link && s.link && linkKey(s.link) === link) return true;
      const theirs = nameKey(q.author && q.author.name);
      return !!title && nameKey(s.title) === title && (!who || !theirs || who === theirs);
    }) || null;
  }
  let sourceFrom = null; // the quote the source was last filled from: filled once, so a field they empty stays empty
  function showSameSource() {
    const q = sameSource();
    fold($('sourceNote'), !!q);
    if (q === sourceFrom) return;
    sourceFrom = q;
    if (!q) return;
    $('sourceGo').dataset.href = `./${q.id}`; // the quote's own address, in a new tab
    const s = q.source;
    if (!data.source.year && s.year) { year.set(String(s.year)); data.source.year = String(s.year); }
    if (!$('fTitle').value.trim() && s.title) { $('fTitle').value = data.source.title = s.title; fieldLook($('fTitle')); }
    if (!$('fSourceLink').value.trim() && s.link) { $('fSourceLink').value = data.source.link = s.link; fieldLook($('fSourceLink')); }
  }

  /* ---------- Step 1 ---------- */

  $('fText').addEventListener('input', (e) => { data.text = e.target.value; refresh(); showSameWords(); });
  $('fOriginal').addEventListener('input', (e) => { data.original = e.target.value; showSameWords(); clearTimeout(guessWhere.t); guessWhere.t = setTimeout(guessWhere, 400); }); // (once the typing pauses: where it is from)
  /* ---------- Step 1: "Need an idea" ----------
     (Bill, 2026-10-22; tuned on md/checks/idea.) While the field is empty, "Need an idea" sits where
     "In original language +" goes once it is not (css .idea-row: one at a time). A tap: the question
     (or the prompt before) and the link fade up and out; then a prompt fades up in the question's
     place while the field and what follows glide to keep its gap (transform only); then the link comes
     back, reading "Another idea". The prompts are Bill's (md/form-prompts.md — keep the two in step),
     drawn as the archive deals its quotes (js/app.js → deal): the categories take turns evenly — the
     one shown least this visit, at random among equals, never the same twice running — and within
     one, a prompt never shown on this device first, then the one shown longest ago (localStorage
     wwk-prompts-seen: prompt → minutes when last shown), so someone back to add more words gets ones
     they have not seen. Two that read alike never follow each other (IDEA_APART). The last two words
     are tied (noOrphans): no word alone on a line. */
  const IDEAS = {
    Perspective: [
      'What did someone say that changed how you see things?',
      'What’s a sentence you underlined in a book?',
      'What lyric changed how you think about life?',
      'What did someone older say that only made sense later?',
      'What did you read once and never forget?',
    ],
    Growth: [
      'What did someone say that helped you at your lowest?',
      'What words helped you start over?',
      'What speech said exactly what you needed to hear?',
      'What advice did you only understand later?',
      'What words helped you forgive someone?',
      'What words got you through a hard time?',
    ],
    Drive: [
      'What words get you out of bed?',
      'What words get you ready for a big moment?',
      'What did someone say that kept you going?',
      'What words remind you why you started?',
      'What words push you to finally go for it?',
    ],
    Community: [
      'What did a friend say that made you feel less alone?',
      'What did your parents say that you now say too?',
      'What’s the kindest thing a stranger ever said to you?',
      'What words changed how you treat people?',
      'What’s a saying from your culture that everyone should hear?',
    ],
    Romance: [
      'What words helped you through a breakup?',
      'What lyric sounds like your love story?',
      'What did someone say that made you feel loved?',
      'What words taught you what love is?',
      'What did someone you loved say that still makes you smile?',
    ],
    Anytime: [
      'What words have you remembered for years?',
      'What words did you once copy into a notebook?',
      'What’s a line you still say to yourself?',
      'What did someone tell you that you never forgot?',
    ],
  };
  const IDEA_APART = [['What did someone tell you that you never forgot?', 'What’s the kindest thing a stranger ever said to you?']];
  const IDEA_SEEN_KEY = 'wwk-prompts-seen';
  const ideas = (() => {
    const all = Object.entries(IDEAS).flatMap(([cat, list]) => list.map((text) => ({ cat, text })));
    const perCat = {};
    let shown = null, lastCat = null, busy = false;
    const seenMap = () => { try { return JSON.parse(localStorage.getItem(IDEA_SEEN_KEY) || '{}') || {}; } catch (e) { return {}; } };
    const any = (list) => list[Math.floor(Math.random() * list.length)];
    function next() {
      const seen = seenMap();
      const apart = new Set(IDEA_APART.filter((pair) => pair.includes(shown)).flat());
      let pool = all.filter((p) => p.text !== shown && !apart.has(p.text));
      if (!pool.length) pool = all.filter((p) => p.text !== shown);
      const fresh = pool.filter((p) => !seen[p.text]); if (fresh.length) pool = fresh; // (never shown here: these first, whatever their category)
      const cats = [...new Set(pool.map((p) => p.cat))], others = cats.filter((c) => c !== lastCat), open = others.length ? others : cats;
      const least = Math.min(...open.map((c) => perCat[c] || 0));
      const cat = any(open.filter((c) => (perCat[c] || 0) === least));
      const inCat = pool.filter((p) => p.cat === cat), oldest = Math.min(...inCat.map((p) => seen[p.text] || 0));
      const p = any(inCat.filter((x) => (seen[x.text] || 0) === oldest));
      perCat[cat] = (perCat[cat] || 0) + 1; lastCat = cat; shown = p.text;
      seen[p.text] = Math.floor(Date.now() / 60000);
      try { localStorage.setItem(IDEA_SEEN_KEY, JSON.stringify(seen)); } catch (e) {}
      return p.text;
    }
    const step = steps[0], group = step.querySelector('.group'), q = group.querySelector('.q');
    const own = $('qOwn'), idea = $('qIdea'), need = $('ideaNeed'), more = $('ideaMore');
    const after = () => [q, ...[...group.children].filter((el) => q.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING),
      ...[...step.querySelector('.content').children].filter((el) => group.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)]; // (the step's content is centred: a shorter question moves itself too)
    function swap(text) {
      busy = true;
      const ms = reduceMotion.matches ? 0 : FOLD_MS;
      const going = idea.hidden ? own : idea;
      going.classList.add('is-out'); need.classList.add('is-out'); more.classList.add('is-out');
      setTimeout(() => {
        const els = after(), before = els.map((el) => el.getBoundingClientRect().top);
        own.hidden = true; own.classList.remove('is-out');
        idea.classList.remove('is-out'); idea.classList.add('is-entering'); idea.hidden = false;
        idea.querySelector('p').textContent = noOrphans(text);
        void idea.offsetWidth; idea.classList.remove('is-entering');
        if (ms) els.forEach((el, i) => { // from where it was to where it is, on the compositor
          const dy = before[i] - el.getBoundingClientRect().top;
          if (!dy) return;
          el.classList.remove('idea-glide'); el.style.transform = `translateY(${dy}px)`;
          void el.offsetWidth;
          el.classList.add('idea-glide'); el.style.transform = '';
          setTimeout(() => el.classList.remove('idea-glide'), ms);
        });
        setTimeout(() => { more.classList.remove('is-out'); }, ms); // the link, once the prompt is in
        setTimeout(() => { busy = false; }, 2 * ms);
      }, ms);
    }
    $('ideaBtn').addEventListener('click', () => { if (!busy) swap(next()); });
    return {
      // The question as the page opens (reset, "Start over"): at once, no motion.
      reset() {
        own.hidden = false; idea.hidden = true; [own, idea].forEach((f) => f.classList.remove('is-out', 'is-entering'));
        need.classList.remove('is-out'); more.classList.add('is-out');
      },
    };
  })();

  // Figma frame 1-2: the toggle row goes away and the second field appears under the first.
  // The toggle and the field fold in opposite directions at the same time, so the column's
  // height only ever changes smoothly and nothing below it jumps.
  $('origToggle').addEventListener('click', () => {
    fold($('origToggleWrap'), false);
    fold($('fOriginalWrap'), true);
    setTimeout(() => $('fOriginal').focus({ preventScroll: true }), FOLD_MS);
  });
  // The × in its corner: the field folds shut, its words are dropped, the toggle comes back.
  $('origClose').addEventListener('click', async () => {
    const own = data.annotations.filter((a) => a.in === 'original'); // words annotated in the original go with it — asked first
    if (own.length && !(await ask(`Removing the original language also removes ${own.length === 1 ? `the annotation of “${own[0].word}”` : `its ${own.length} annotations`}.`, 'Remove', 'Keep it'))) return;
    data.annotations = data.annotations.filter((a) => a.in !== 'original');
    fold($('fOriginalWrap'), false);
    fold($('origToggleWrap'), true);
    $('fOriginal').value = '';
    data.original = '';
    guessWhere(); // (a guess from those words goes with them)
    refresh(); // ("N words annotated")
  });
  // Asking first: the white box in the middle (add.html #popup), resolved true by its main
  // button, false by the other, Escape or a click beside it.
  let popupResolve = null;
  function ask(text, yes, no) {
    $('popupText').textContent = text; $('popupYes').textContent = yes; $('popupNo').textContent = no;
    $('popup').hidden = false;
    $('popupNo').focus({ preventScroll: true });
    return new Promise((res) => { popupResolve = res; });
  }
  function answer(v) { if (!popupResolve) return; $('popup').hidden = true; const r = popupResolve; popupResolve = null; r(v); }
  $('popupYes').addEventListener('click', () => answer(true));
  $('popupNo').addEventListener('click', () => answer(false));
  $('popup').addEventListener('click', (e) => { if (e.target === $('popup')) answer(false); });
  document.addEventListener('keydown', (e) => { if (popupResolve && e.key === 'Escape') { e.stopImmediatePropagation(); answer(false); } }, true);

  /* ---------- Step 2 ---------- */

  $('catList').innerHTML = CATEGORIES.map((c) => `
    <button type="button" class="cat" role="checkbox" aria-checked="false" data-key="${c.key}">
      <span class="icon icon-mark" data-sym="${c.key}" aria-hidden="true"></span>
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
  // `keep`: a choice that is never empty (who said it): no ×, the arrow stays, and a field left
  // blank goes back to what was chosen. `select`: picked from the list only, never typed into
  // (who said it: five choices) — the field is read-only, so a phone shows no keyboard.
  function combo(host, { options, placeholder, free = false, keep = false, select = false, onChange, label }) {
    host.classList.add('combo');
    host.innerHTML = `<input class="field" type="text" placeholder="${placeholder}" autocomplete="off" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-label="${label || placeholder}">
      <button type="button" class="combo-btn" tabindex="-1" aria-label="Open"><span class="icon icon-chevron"></span></button>`;
    const input = host.querySelector('input'), btn = host.querySelector('.combo-btn'), icon = btn.querySelector('.icon');
    if (select) { input.readOnly = true; host.classList.add('combo--select'); input.removeAttribute('aria-autocomplete'); }
    let list = null, bar = null, value = '', kept = '', hover = -1, shown = [];
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
      value = v; if (v) kept = v; input.value = lbl || '';
      host.classList.toggle('has-value', !!v);
      if (v) host.classList.remove('is-warn');
      icon.className = 'icon ' + (v && !keep ? 'icon-x' : 'icon-chevron');
      btn.setAttribute('aria-label', v && !keep ? 'Clear' : 'Open');
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
      else if (keep && (!t || !value)) setValue(kept, options.find((o) => o.value === kept)?.label || '');
      else if (!t) setValue('', '');
      else setValue(value, options.find((o) => o.value === value)?.label || (free ? value : ''));
      close();
    };

    input.addEventListener('focus', () => { host.classList.remove('is-warn'); render(value ? '' : input.value); });
    input.addEventListener('click', () => { if (!list) render(value ? '' : input.value); });
    input.addEventListener('input', () => { if (value) { value = ''; host.classList.remove('has-value'); icon.className = 'icon icon-chevron'; if (!keep) onChange(''); } render(input.value); });
    input.addEventListener('blur', settle);
    input.addEventListener('keydown', (e) => {
      if (composing(e)) return;
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) e.stopPropagation(); // the list's keys never turn the page
      if (e.key === 'ArrowDown') { e.preventDefault(); if (!list) render(input.value); setHover(hover + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHover(hover - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); if (list && hover >= 0) pick(hover); else if (list && shown.length === 1) pick(0); else settle(); }
      else if (e.key === 'Escape') { e.preventDefault(); settle(); }
      else if (e.key === 'Tab') settle();
    });
    btn.addEventListener('pointerdown', (e) => e.preventDefault());
    btn.addEventListener('click', () => {
      if (value && !keep) { setValue('', ''); input.focus(); render(''); }
      else if (list) close();
      else { input.focus(); }
    });
    return { input, set: (v) => { const o = options.find((x) => x.value === v); setValue(v, o ? o.label : (free ? v : '')); } };
  }

  /* ---------- Step 3 ---------- */

  $('fName').addEventListener('input', (e) => { data.author.name = e.target.value; refresh(); showSameSource(); });
  $('fNative').addEventListener('input', (e) => { data.author.nativeName = e.target.value; if (e.target.value.trim()) $('fName').closest('.fw').classList.remove('is-warn'); refresh(); });
  $('fTitle').addEventListener('input', (e) => { data.source.title = e.target.value; showSameSource(); });
  // A link's shape: http(s), a real domain, no bare IP address or localhost, no user name or
  // password (workers/lib/link.js → shapeOf, which the Workers check again: keep in step).
  function linkShapeOk(raw) {
    let u;
    try { u = new URL(raw.trim()); } catch (e) { return false; }
    if (!/^https?:$/.test(u.protocol) || u.username || u.password) return false;
    const host = u.hostname.toLowerCase();
    return host.includes('.') && !/^\[|^\d+(\.\d+){3}$/.test(host) && !/(^|\.)(localhost|local|internal|lan|home|test|invalid|example)$/.test(host);
  }
  const LINK_NOTE = { shape: 'This doesn’t look like a link.', unreachable: 'We can’t reach this link.', unsafe: 'This link is flagged as unsafe.' };
  // A warning in the link field, as every warning in the form (Bill, 2026-10-05): the link goes,
  // the warning takes the placeholder's place, with the ⓘ. '' puts the category's hint back.
  function warnLink(text) {
    const field = $('fSourceLink');
    field.closest('.fw').classList.toggle('is-warn', !!text);
    if (!text) return linkHint(data.source.kind);
    field.value = ''; data.source.link = '';
    field.placeholder = text; field.setAttribute('aria-label', text);
  }
  // The source link is checked when the visitor leaves the field, and on Next (not as it is
  // typed): its shape here, then whether it can be reached and whether its site is flagged, by
  // the Worker (/check). A warning holds the step once; Next again goes on, without the link.
  const linkNotes = new Map(); // a link → Promise of its warning ('' = none)
  function noteFor(v) {
    if (!linkNotes.has(v)) linkNotes.set(v, (async () => {
      if (!linkShapeOk(v)) return LINK_NOTE.shape;
      if (!SUBMIT_URL) return ''; // a local preview: no Worker to ask
      try {
        const r = await (await fetch(`${SUBMIT_URL}check`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: v }) })).json();
        return r.unsafe ? LINK_NOTE.unsafe : r.reach === 'unreachable' ? LINK_NOTE.unreachable : r.shape === 'bad' ? LINK_NOTE.shape : '';
      } catch (e) { linkNotes.delete(v); return ''; } // no answer: no warning (asked again next time)
    })());
    return linkNotes.get(v);
  }
  // → true when it warned (and the link is gone)
  async function checkSourceLink() {
    const field = $('fSourceLink'), v = field.value.trim();
    if (!v) return false;
    const note = await noteFor(v);
    if (!note || field.value.trim() !== v) return false; // fine, or typed on meanwhile
    warnLink(note);
    return true;
  }
  $('fSourceLink').addEventListener('input', (e) => {
    data.source.link = e.target.value;
    if (e.target.closest('.fw').classList.contains('is-warn')) warnLink('');
    showSameSource();
  });
  $('fSourceLink').addEventListener('change', checkSourceLink); // on leaving the field
  /* Where the words are from, guessed from the original language (Bill, 2026-10-08): once the
     words in their original language are typed, the country is filled in for a language of
     essentially one country (Japanese → Japan), and a saying's origin for a language that names
     one (Japanese, Chinese, Latin…). Simplified Chinese → China (Bill); a language of several countries (traditional Chinese, Spanish, French,
     German, Portuguese, Dutch, Arabic, Russian…) leaves the country to them. Only a field they
     have not set themselves (own*) is filled; what was filled follows the words, and goes with
     them. detectLang's codes; the regions are REGION_CODES', the origins ORIGINS'. */
  const LANG_COUNTRY = { ja: 'JP', ko: 'KR', th: 'TH', he: 'IL', el: 'GR', hi: 'IN', it: 'IT', vi: 'VN', pl: 'PL', tr: 'TR' };
  const LANG_ORIGIN = { ja: 'Japanese', ko: 'Korean', zh: 'Chinese', th: 'Thai', he: 'Hebrew', el: 'Greek', hi: 'Indian', it: 'Italian', vi: 'Vietnamese', pl: 'Polish', tr: 'Turkish', la: 'Latin', ar: 'Arabic' };
  const guess = { country: '', origin: '', ownCountry: false, ownOrigin: false };
  function guessWhere() {
    clearTimeout(guessWhere.t);
    const lang = data.original.trim() ? detectLang(data.original, placeOf()) : '';
    const hans = lang === 'zh' && (data.original.match(HANS_ONLY) || []).length > (data.original.match(HANT_ONLY) || []).length; // simplified: China (traditional: Taiwan, Hong Kong, Macau… theirs to pick)
    const c = hans ? 'CN' : LANG_COUNTRY[lang] || '', o = LANG_ORIGIN[lang] || '';
    if (!guess.ownCountry && data.author.country !== c) { guess.country = c; country.set(c); }
    if (!guess.ownOrigin && data.author.origin !== o) { guess.origin = o; origin.set(o); }
  }
  // "Not sure", last in the country and the origin lists (Bill, 2026-10-11): stored as no country /
  // no origin — the site then shows none ("A proverb" for a saying) and the region count skips it.
  const UNSURE = 'unsure', NOT_SURE = { value: UNSURE, label: 'Not sure' };
  const sure = (v) => (v && v !== UNSURE ? v : null); // what is stored: "Not sure" is none
  const country = combo($('fCountry'), { options: [...REGIONS, NOT_SURE], placeholder: 'Country or region', label: 'Country or region', onChange: (v) => { if (v !== guess.country) guess.ownCountry = true; data.author.country = v; fold($('fNativeWrap'), data.author.kind === 'person' && NON_LATIN.has(v)); refresh(); } });
  // Who said it: the fields follow the kind. A name and a country for a person (the native name
  // too, for a known person from a country not written in Latin letters); where it is from for a
  // saying; nothing for "Not sure". What was typed stays, should the kind be changed back.
  const origin = combo($('fOrigin'), { options: [...ORIGINS, NOT_SURE], placeholder: 'Where is it from', label: 'Where is it from', onChange: (v) => { if (v !== guess.origin) guess.ownOrigin = true; data.author.origin = v; refresh(); } });
  function showWho(kind) {
    const w = WHO.find((x) => x.value === kind) || WHO[0], named = !!w.name;
    $('fName').placeholder = w.name || 'Name'; $('fName').setAttribute('aria-label', w.name || 'Name');
    fold($('fNameRowWrap'), named);
    fold($('fNativeWrap'), kind === 'person' && NON_LATIN.has(data.author.country));
    fold($('fOriginWrap'), kind === 'saying');
    // A fictional character's country is the film's, show's or book's: it moves under the source's
    // category and year (Bill), and the name has the row to itself; back beside the name otherwise.
    const character = kind === 'character', host = $('fCountry');
    if (character) $('fSrcCountrySlot').appendChild(host);
    else if (host.parentElement !== $('fName').closest('.row')) $('fName').closest('.row').appendChild(host);
    fold($('fSrcCountryWrap'), character);
    const countryLabel = character ? 'Source country or region' : 'Country or region'; // (Bill)
    country.input.placeholder = countryLabel; country.input.setAttribute('aria-label', countryLabel);
    kindOptions.splice(0, kindOptions.length, ...(character ? KINDS.filter((k) => !CHARACTER_SKIP.has(k.value)) : KINDS));
    if (character && CHARACTER_SKIP.has(data.source.kind) && sourceKind) sourceKind.set('');
    document.querySelectorAll('#fNameRowWrap .fw, #fOriginWrap .fw, #fSrcCountryWrap .fw').forEach((f) => f.classList.remove('is-warn'));
  }
  const kindOptions = KINDS.slice(); // the source categories offered: all, or a fictional character's (showWho)
  let sourceKind = null; // the source category's dropdown, once made (below)
  const who = combo($('fWho'), { options: WHO, placeholder: 'Who said or wrote it', label: 'Who said or wrote it', keep: true, select: true, onChange: (v) => { if (!v || v === data.author.kind && who) return; data.author.kind = v; showWho(v); refresh(); } });
  who.set('person');
  // Source name and link appear once a kind other than Personal is chosen, one after the other.
  const SOURCE_STAGGER_MS = 50;
  function showSourceFields(on) {
    const name = $('fTitleWrap'), link = $('fSourceLinkWrap');
    clearTimeout(showSourceFields.t);
    if (on) { fold(name, true); showSourceFields.t = setTimeout(() => fold(link, true), SOURCE_STAGGER_MS); }
    else { fold(link, false); showSourceFields.t = setTimeout(() => fold(name, false), SOURCE_STAGGER_MS); }
  }
  // The link field's hint (and what a screen reader hears) follows the kind.
  function linkHint(v) { // (and the name field's: "Song title", "Event or show name"…; Bill, 2026-10-10)
    const k = KINDS.find((x) => x.value === v) || {}, hint = k.hint || 'Source link', name = k.name || 'Source name';
    $('fSourceLink').placeholder = hint; $('fSourceLink').setAttribute('aria-label', hint);
    $('fTitle').placeholder = name; $('fTitle').setAttribute('aria-label', name);
  }
  const kind = combo($('fKind'), { options: kindOptions, placeholder: 'Source category', label: 'Source category', onChange: (v) => { data.source.kind = v; linkHint(v); showSourceFields(!!v && v !== 'personal'); showSameSource(); } });
  sourceKind = kind;
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
  // The sheet shows the quote in English or, with the language button, in its original language
  // (`sheetOrig`; Bill, 2026-10-09). A word is checked against the one showing and belongs to it
  // (a row's `orig`, stored as in: 'original'); each language's rows only take its own words.
  let sheetOrig = false;
  const sheetText = (orig = sheetOrig) => (orig ? data.original : data.text).trim();
  function findInQuote(word, taken = [], orig = sheetOrig) {
    const q = sheetText(orig), w = normalise(word);
    if (!w) return { at: -1 };
    const hay = q.toLowerCase();
    // whole words when the phrase starts/ends with a Latin letter or digit; CJK etc. as a plain substring
    const re = new RegExp((/^[\p{L}\p{N}]/u.test(w) && /[a-z0-9]$/i.test(w) ? '(^|[^\\p{L}\\p{N}])' : '()') + w.split(' ').map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+') + (/[a-z0-9]$/i.test(w) ? '(?![\\p{L}\\p{N}])' : ''), 'gu');
    const free = (a, b) => !taken.some(([s0, s1]) => a < s1 && b > s0);
    let m;
    while ((m = re.exec(hay))) { const at = m.index + m[1].length, end = m.index + m[0].length; if (free(at, end)) return { at, text: q.slice(at, end) }; if (end === at) re.lastIndex++; } // m[1]: the character before the word, matched rather than looked behind for (lookbehind needs Safari 16.4)
    for (let i = hay.indexOf(w); i >= 0; i = hay.indexOf(w, i + 1)) { if (free(i, i + w.length)) return { at: i, text: q.slice(i, i + w.length) }; }
    return { at: -1 };
  }
  const takenBy = (rows, orig = sheetOrig) => rows.filter((a) => a.matched && a.at >= 0 && !!a.orig === orig).map((a) => [a.at, a.at + a.word.length]);
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
          <div class="fold${matched ? ' is-open' : ''}"${matched ? '' : ' hidden'}><div class="fw"><textarea class="field" data-f="explanation" placeholder="Explain the word" aria-label="Explain word ${i + 1}">${esc(a.explanation)}</textarea></div></div>
        </div>
      </div></div>`;
  }
  function renderRows() { $('annRows').innerHTML = draft.map((a, i) => rowHTML(a, i)).join(''); $('annRows').querySelectorAll('textarea.field').forEach(textareaBar); renderQuote(); syncTail(); }
  // The quote with every matched word highlighted. A new highlight wipes in left→right
  // (MARK_MS); one being taken away wipes out left→right, then the span goes (`leaving`).
  const MARK_MS = 300;
  // The quote's look for the language showing: the original in the fields' Noto, with its
  // language and direction (Arabic and Hebrew right to left).
  function quoteLook(el, q) {
    el.classList.toggle('is-native', sheetOrig);
    if (sheetOrig) { const lang = detectLang(q, placeOf()); el.lang = lang === 'other' ? '' : lang; el.dir = /^[^\p{L}]*[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/u.test(q) ? 'rtl' : 'ltr'; const look = /[\u3040-\u30ff]/.test(q) ? 'jpan' : /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/.test(q) ? 'kore' : /[\u3400-\u9fff]/.test(q) && isHant(q) ? 'hant' : ''; if (look) el.dataset.cjk = look; else delete el.dataset.cjk; }
    else { el.lang = ''; el.dir = ''; delete el.dataset.cjk; }
  }
  function renderQuote(leaving = []) {
    const q = sheetText(), el = $('annQuote');
    quoteLook(el, q);    const spans = takenBy(draft).concat(leaving.map(([s0, s1]) => [s0, s1, 'off'])).sort((x, y) => x[0] - y[0]);
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
    drawRef();
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
  // A field the sheet moves the typing to (a new row, an explanation unfolding) is scrolled into
  // view, clear of the fades at the top and bottom (Bill, 2026-10-09: "Another" added rows under
  // the bottom fade, out of sight).
  function reveal(el) {
    const sc = sheet.querySelector('.ann-scroll'), box = sc.getBoundingClientRect(), r = el.getBoundingClientRect();
    const guard = (sheet.querySelector('.guard--bottom') || {}).offsetHeight || 80, top = (sheet.querySelector('.guard--top') || {}).offsetHeight || 80;
    let by = 0;
    if (r.bottom > box.bottom - guard) by = r.bottom - (box.bottom - guard);
    if (r.top - by < box.top + top) by = r.top - (box.top + top);
    if (by) sc.scrollBy({ top: by, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  }
  const annMs = () => (reduceMotion.matches ? 0 : 200);
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const rowOf = (el) => { const row = el.closest('.ann-row'); return row ? { row, a: draft[Number(row.dataset.i)] } : null; };
  function confirmWord(row, a) {
    const wrap = row.querySelector('.ann-field'), input = wrap.querySelector('input');
    const m = findInQuote(input.value, takenBy(draft.filter((x) => x !== a)));
    if (m.at < 0) { // no match (in the language showing) (or every occurrence already taken): empty, warning state, "Word must match"
      a.word = ''; input.value = ''; input.placeholder = 'Word must match';
      wrap.classList.add('is-warn'); wrap.querySelector('.ann-confirm').hidden = true;
      const rm = wrap.querySelector('.ann-remove'); if (rm) rm.hidden = false; // empty again: the extra row can be removed
      return;
    }
    a.word = m.text; a.at = m.at; a.matched = true; a.orig = sheetOrig; input.value = m.text; input.readOnly = true;
    wrap.classList.remove('is-warn'); wrap.querySelector('.ann-confirm').hidden = true; wrap.querySelector('.ann-unlock').hidden = false; // row 1: unlock ×; an added row: its remove ×
    row.classList.add('is-matched');
    const exp = row.querySelector('.fold');
    fold(exp, true);
    renderQuote(); syncTail();
    setTimeout(() => { const f = exp.querySelector('.field'); f.focus({ preventScroll: true }); reveal(row); }, FOLD_MS);
  }
  function unlockWord(row, a) {
    const wrap = row.querySelector('.ann-field'), input = wrap.querySelector('input');
    const gone = a.at >= 0 && !!a.orig === sheetOrig ? [[a.at, a.at + a.word.length]] : []; // (a word of the other language: no highlight to take away here)
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
    if (e.key !== 'Enter' || composing(e) || e.target.dataset.f !== 'word' || e.target.readOnly) return;
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
    const gone = r.a.matched && r.a.at >= 0 && !!r.a.orig === sheetOrig ? [[r.a.at, r.a.at + r.a.word.length]] : [];
    r.a.matched = false; r.a.at = -1;
    renderQuote(gone);
    setTimeout(() => { draft.splice(Number(r.row.dataset.i), 1); renderRows(); }, annMs());
  });
  $('annAnother').addEventListener('click', () => {
    draft.push({ word: '', explanation: '', matched: false, at: -1 });
    $('annRows').insertAdjacentHTML('beforeend', rowHTML(draft[draft.length - 1], draft.length - 1, ' is-new')); // fades in and unfolds
    const row = $('annRows').lastElementChild;
    row.querySelectorAll('textarea.field').forEach(textareaBar);
    syncTail();
    setTimeout(() => { row.classList.remove('is-new'); row.querySelector('input').focus({ preventScroll: true }); reveal(row); }, annMs());
  });

  // The language button: the other language's label (the original's, as on the archive; "EN"
  // back), in that label's own face — loaded for just its letters. A word typed but not yet
  // checked goes when the language changes (Bill: it would be checked against the other words).
  const LANG_BUTTON = { // js/app.js → LANG_BUTTON (copied: change both)
    en: { label: 'EN', font: 'Inter', weight: 500, size: 10, tracking: 4, nudge: 0 },
    zh: { label: '中', font: 'Noto Sans SC', weight: 500, size: 12, tracking: 0, nudge: -3 },
    ja: { label: 'JP', font: 'Inter', weight: 500, size: 10.5, tracking: 1.5, nudge: -1 },
    ko: { label: '한', font: 'Noto Sans KR', weight: 500, size: 13, tracking: 0, nudge: -7 },
    el: { label: 'ΕΛ', font: 'Inter', weight: 500, size: 10, tracking: 4, nudge: 0 },
    ru: { label: 'РУ', font: 'Manrope', weight: 600, size: 11, tracking: 2.5, nudge: 2 },
    uk: { label: 'УКР', font: 'Inter', weight: 500, size: 9.5, tracking: 0.5, nudge: 0 },
    ar: { label: 'عربي', font: 'Noto Sans Arabic', weight: 500, size: 9.5, tracking: 0, nudge: -17 },
    fa: { label: 'فا', font: 'IBM Plex Sans Arabic', weight: 400, size: 13.5, tracking: 0, nudge: 7 },
    ur: { label: 'اردو', font: 'Noto Sans Arabic', weight: 500, size: 11.5, tracking: 0, nudge: -5 },
    he: { label: 'עב', font: 'IBM Plex Sans Hebrew', weight: 400, size: 13, tracking: 2, nudge: -8 },
    th: { label: 'ไทย', font: 'Bai Jamjuree', weight: 500, size: 11, tracking: 0, nudge: 0 },
    hi: { label: 'हिं', font: 'Poppins', weight: 400, size: 12.5, tracking: 0, nudge: 11 },
    bn: { label: 'বাং', font: 'Hind Siliguri', weight: 400, size: 13.5, tracking: 0, nudge: 6 },
    ta: { label: 'த', font: 'Noto Sans Tamil', weight: 400, size: 13, tracking: 0, nudge: 0 },
  };
  const labelFonts = new Set();
  function drawLangBtn() {
    const btn = $('annLang'), has = !!data.original.trim();
    btn.hidden = !has;
    if (!has) return;
    const code = sheetOrig ? 'en' : detectLang(data.original, placeOf());
    const b = LANG_BUTTON[code] || { ...LANG_BUTTON.en, label: /^[a-z]{2}$/.test(code) ? code.toUpperCase() : 'Aa' };
    const key = `${b.font}:${b.weight}`;
    if (!labelFonts.has(key)) { // the label's face (only the pieces with its letters load)
      labelFonts.add(key);
      const l = document.createElement('link'); l.rel = 'stylesheet';
      l.href = `https://fonts.wordswekeep.org/css2?family=${b.font.replace(/ /g, '+')}:wght@${b.weight}&display=swap`;
      document.head.appendChild(l);
    }
    Object.entries({ '--lb-font': `'${b.font}'`, '--lb-weight': b.weight, '--lb-size': `${b.size}px`, '--lb-track': `${b.tracking / 100}em`, '--lb-nudge': `${b.nudge / 10}px` }).forEach(([k, v]) => btn.style.setProperty(k, v)); // (not cssText: that would undo the hiding while it is out)
    btn.innerHTML = `<span>${esc(b.label)}</span>`;
    btn.setAttribute('aria-label', sheetOrig ? 'Show the words in English' : 'Show the words in their original language');
    btn.setAttribute('aria-pressed', String(sheetOrig));
  }
  /* The words to look back at (Bill, 2026-10-09; Figma 516:9, 522:153, 523:254): once the rows
     have scrolled the words away under the top fade, a copy of them — the language showing, its
     highlights on, its language button — comes in. Desktop: on the left under Cancel (css). Tablet
     and phone: a button top right opens it in the top bar; it, or a click anywhere else, closes it. */
  const refWide = matchMedia('(min-width: 1024px)');
  function drawRef() {
    const q = sheetText(), el = $('annRefQuote');
    quoteLook(el, q);
    const had = new Set([...el.querySelectorAll('.ann-mark')].map((m) => m.dataset.at)); // (a highlight already there stays; a new one wipes in, as over the rows)
    let html = '', at = 0;
    takenBy(draft).sort((x, y) => x[0] - y[0]).forEach(([s0, s1]) => { if (s0 < at) return; html += esc(q.slice(at, s0)) + `<span class="ann-mark${had.has(String(s0)) ? ' is-on' : ''}" data-at="${s0}">${esc(q.slice(s0, s1))}</span>`; at = s1; });
    el.innerHTML = html + esc(q.slice(at));
    requestAnimationFrame(() => el.querySelectorAll('.ann-mark:not(.is-on)').forEach((m) => m.classList.add('is-on')));
    const main = $('annLang'), b = $('annRefLang');
    b.hidden = main.hidden; b.innerHTML = main.innerHTML;
    ['--lb-font', '--lb-weight', '--lb-size', '--lb-track', '--lb-nudge'].forEach((k) => b.style.setProperty(k, main.style.getPropertyValue(k)));
    b.setAttribute('aria-label', main.getAttribute('aria-label') || ''); b.setAttribute('aria-pressed', main.getAttribute('aria-pressed') || 'false');
  }
  function refShown() { $('annRef').inert = !(sheet.classList.contains('is-ref') && (refWide.matches || sheet.classList.contains('is-ref-open'))); }
  function setRefOpen(on) {
    sheet.classList.toggle('is-ref-open', on);
    $('annRefBtn').setAttribute('aria-expanded', String(on)); $('annRefBtn').setAttribute('aria-label', on ? 'Hide the words' : 'Show the words');
    refShown();
  }
  function refCheck() {
    if (sheet.hidden) return;
    const sc = sheet.querySelector('.ann-scroll'), head = sheet.querySelector('.ann-head'), fade = sheet.querySelector('.guard--top').offsetHeight || 80;
    const out = head.getBoundingClientRect().bottom < sc.getBoundingClientRect().top + fade; // the words gone under the top fade
    sheet.classList.toggle('is-ref', out);
    if (!out) setRefOpen(false); else refShown();
  }
  sheet.querySelector('.ann-scroll').addEventListener('scroll', refCheck, { passive: true });
  window.addEventListener('resize', refCheck);
  refWide.addEventListener('change', () => { setRefOpen(false); refCheck(); });
  $('annRefBtn').addEventListener('click', () => setRefOpen(!sheet.classList.contains('is-ref-open')));
  sheet.addEventListener('pointerdown', (e) => { if (sheet.classList.contains('is-ref-open') && !e.target.closest('#annRef, #annRefBtn')) setRefOpen(false); }); // a click anywhere else closes it
  // The change of language, as on the archive (js/app.js → sweep; Bill, 2026-10-09): each letter of
  // the words showing blurs away while each letter of the other language blurs in over the same
  // spot, left to right, within LANG_MS; the height eases between the two; the other language's
  // highlights wipe in once its words are in. Arabic, Hebrew, Thai, Devanagari go a word at a time.
  const LANG_MS = 400, LANG_CHAR_MS = 160, LANG_BLUR = 8;
  let langBusy = false;
  function spanChars(el) {
    const text = el.textContent, byWord = /[\u0590-\u08ff\u0900-\u097f\u0e00-\u0e7f\ufb1d-\ufdff\ufe70-\ufeff]/.test(text), chars = [];
    el.textContent = '';
    (byWord ? text.match(/\s|\S+/g) || [] : [...text]).forEach((ch) => {
      if (/\s/.test(ch)) { el.appendChild(document.createTextNode(ch)); return; }
      const span = document.createElement('span'); span.textContent = ch; el.appendChild(span); chars.push(span);
    });
    return chars;
  }
  function sweep(chars, show) {
    const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease').trim() || 'ease';
    const ink = getComputedStyle(chars[0] || document.body).color;
    const clear = { opacity: 1, color: ink, textShadow: `0 0 0 ${ink}` }, gone = { opacity: 0, color: 'transparent', textShadow: `0 0 ${LANG_BLUR}px ${ink}` };
    const span = Math.max(0, LANG_MS - LANG_CHAR_MS);
    chars.forEach((c, i) => c.animate(show ? [gone, clear] : [clear, gone], { duration: LANG_CHAR_MS, delay: chars.length > 1 ? (i / (chars.length - 1)) * span : 0, easing, fill: 'both' }));
  }
  // The button itself, as the archive's (css .lang; Bill, 2026-10-09): pressed, it slips towards the
  // quote and fades (LANG_BTN_OUT_MS), and only then do the words change; it stays out of sight
  // meanwhile and comes back with the other label, bouncing in from where it went (.is-back). It
  // comes in the same way once the sheet is down (.is-in).
  const LANG_BTN_OUT_MS = 50;
  const langBtns = () => [$('annLang'), $('annRefLang')]; // the one over the words, and the one in the words to look back at
  function langBtnIn(cls, btns = langBtns()) { btns.forEach((btn) => { btn.style.visibility = ''; btn.classList.remove('is-out', 'is-in', 'is-back'); void btn.offsetWidth; btn.classList.add(cls); }); }
  function pressLang() {
    if (langBusy) return;
    if (reduceMotion.matches) return changeLanguage();
    langBusy = true;
    langBtns().forEach((btn) => { btn.classList.remove('is-in', 'is-back'); btn.classList.add('is-out'); });
    setTimeout(() => { langBtns().forEach((btn) => { btn.style.visibility = 'hidden'; }); changeLanguage(); }, LANG_BTN_OUT_MS);
  }
  $('annLang').addEventListener('click', pressLang);
  $('annRefLang').addEventListener('click', pressLang);
  // The words going, laid over their own spot (the quote over the rows, and the copy to look back at).
  function ghostOf(el) {
    const g = el.cloneNode(false); g.removeAttribute('id'); g.setAttribute('aria-hidden', 'true'); g.textContent = el.textContent;
    Object.assign(g.style, { position: 'absolute', left: `${el.offsetLeft}px`, top: `${el.offsetTop}px`, width: `${el.offsetWidth}px`, margin: '0', pointerEvents: 'none' });
    return { el, g, from: el.offsetHeight };
  }
  function changeLanguage() {
    const swaps = reduceMotion.matches ? [] : [$('annQuote'), $('annRefQuote')].map(ghostOf);
    sheetOrig = !sheetOrig;
    draft.forEach((a, i) => { // a word not yet checked goes; an explanation being written stays
      if (a.matched || !a.word) return;
      a.word = '';
      const row = $('annRows').querySelector(`.ann-row[data-i="${i}"]`); if (!row) return;
      const wrap = row.querySelector('.ann-field'), input = wrap.querySelector('input');
      input.value = ''; input.placeholder = 'Word'; wrap.classList.remove('is-warn');
      wrap.querySelector('.ann-confirm').hidden = true;
      const rm = wrap.querySelector('.ann-remove'); if (rm) rm.hidden = false;
    });
    drawLangBtn(); syncTail();
    const afresh = () => { $('annQuote').innerHTML = ''; $('annRefQuote').innerHTML = ''; renderQuote(); }; // (every highlight of this language wipes in, in both)
    if (!swaps.length) return afresh();
    swaps.forEach((w) => { // the words coming, plain for the sweep; the height eases from the one to the other
      quoteLook(w.el, sheetText()); w.el.textContent = sheetText();
      w.el.parentNode.appendChild(w.g);
      const to = w.el.offsetHeight;
      w.el.style.height = `${w.from}px`; w.el.getBoundingClientRect();
      w.el.style.transition = `height ${LANG_MS}ms var(--ease)`; w.el.style.height = `${to}px`;
      sweep(spanChars(w.g), false); sweep(spanChars(w.el), true);
    });
    setTimeout(() => {
      swaps.forEach((w) => { w.g.remove(); w.el.style.height = w.el.style.transition = ''; });
      afresh(); langBtnIn('is-back'); langBusy = false;
    }, LANG_MS + 30);
  }

  function openSheet() {
    draft = [];
    sheetOrig = false;
    data.annotations.forEach((a) => { const orig = a.in === 'original'; const m = findInQuote(a.word, takenBy(draft, orig), orig); draft.push({ word: a.word, explanation: a.explanation, orig, matched: m.at >= 0, at: m.at }); });
    drawLangBtn();
    if (!reduceMotion.matches && !$('annLang').hidden) { $('annLang').style.visibility = 'hidden'; setTimeout(() => { if (!sheet.hidden) langBtnIn('is-in', [$('annLang')]); }, sheetMs()); } // (in once the sheet is down)
    if (!draft.length) draft.push({ word: '', explanation: '', matched: false, at: -1 });
    renderRows();
    sheet.classList.remove('is-out', 'is-ref'); setRefOpen(false);
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
    setRefOpen(false);
    setChrome(getComputedStyle(document.documentElement).getPropertyValue('--paper').trim());
    refresh();
    setTimeout(() => { if (sheet.classList.contains('is-out')) { sheet.hidden = true; sheet.classList.remove('is-out'); } }, sheetMs());
  }
  $('annToggle').addEventListener('click', openSheet);
  $('annCancel').addEventListener('click', closeSheet);
  $('annSave').addEventListener('click', () => {
    data.annotations = draft.filter((a) => a.matched && a.word.trim() && a.explanation.trim()).map((a) => ({ word: a.word.trim(), explanation: a.explanation.trim(), ...(a.orig ? { in: 'original' } : {}) }));
    closeSheet();
  });

  /* ---------- Step 5: submit ---------- */

  $('fReflection').addEventListener('input', (e) => { data.reflection = e.target.value; refresh(); });
  $('fKeptBy').addEventListener('input', (e) => { data.keptBy = e.target.value; });

  /* ---------- A field above the phone's keyboard ----------
     When a field takes focus, and again whenever the phone's visible area changes while it has
     it (the keyboard rising, the page panned), the nearest scroller moves so the field sits in
     view: its bottom KEYBOARD_GAP above the keyboard, its top below the chrome. Every page here
     is absolute boxes with an inner scroller, which iOS does not scroll for a focused field by
     itself (Bill, 2026-10-09: the thoughts box stayed under the keyboard). While the keyboard is
     up the scroller is given the keyboard's height of room at its foot (a spacer, below), or a field at
     the end of the page could never rise above it (Bill's second screenshot, the same day). The
     same in js/app.js, js/form.js and js/admin.js: change all three. */
  // Room at a scroller's foot: a spacer element, its last child (`.kb-room`), never padding on
  // the scroller — Safari on iOS does not count a scroll container's own bottom padding as
  // scrollable space, so the page could not move into it (the simulator, 2026-10-09: a 486px
  // move asked for, none taken; Chrome counts it, which is why the pane always passed).
  const roomEl = (sc, make) => { let el = sc.querySelector(':scope > .kb-room'); if (!el && make) { el = document.createElement('div'); el.className = 'kb-room'; el.setAttribute('aria-hidden', 'true'); sc.appendChild(el); } return el; };
  const setRoom = (sc, px) => { const el = roomEl(sc, px > 0); if (el) el.style.height = px > 0 ? `${px}px` : '0px'; };
  const KEYBOARD_GAP = 20, KEYBOARD_TOP = 80, KEYBOARD_MIN = 100; // a visible area shorter than the window by this much = the keyboard is up
  const scrollerOf = (el) => { for (el = el.parentElement; el && el !== document.body; el = el.parentElement) { if (/auto|scroll/.test(getComputedStyle(el).overflowY)) return el; } return null; };
  let keyboardRoom = null; // the scroller given room, while the keyboard is up
  const keyboardHeight = () => { const vv = window.visualViewport; const h = vv ? window.innerHeight - vv.height : 0; return h >= KEYBOARD_MIN ? h : 0; };
  function keepAboveKeyboard(field) {
    const sc = scrollerOf(field);
    if (!sc) { field.scrollIntoView({ block: 'nearest' }); return; } // nothing of ours scrolls here: the browser pans its visible area instead
    if (window.scrollY > 0 || (window.visualViewport && window.visualViewport.pageTop > 0)) window.scrollTo(0, 0); // iOS panned the whole page to reveal a tapped field: undone, the scroller does the work (js/app.js)
    const kb = keyboardHeight();
    if (keyboardRoom && keyboardRoom !== sc) { setRoom(keyboardRoom, 0); keyboardRoom = null; }
    if (kb) { setRoom(sc, kb); keyboardRoom = sc; } else if (keyboardRoom) { setRoom(keyboardRoom, 0); keyboardRoom = null; }
    const vv = window.visualViewport, top = (vv ? vv.offsetTop : 0) + KEYBOARD_TOP, bottom = (vv ? vv.offsetTop + vv.height : window.innerHeight) - KEYBOARD_GAP;
    const r = field.getBoundingClientRect();
    let by = 0;
    if (r.bottom > bottom) by = r.bottom - bottom;
    if (r.top - by < top) by = r.top - top; // too tall for the room: its top wins
    if (Math.abs(by) > 1) sc.scrollTo({ top: sc.scrollTop + by, behavior: reduceMotion.matches ? 'auto' : 'smooth' }); // a glide, not a jump (js/app.js: the notes' own)
  }
  let keyboardTimer = 0;
  const keyboardSettle = () => { // whatever has focus now (not an event's target: a window without focus fires no focus events)
    const f = document.activeElement;
    if (f && f.matches && f.matches('input, textarea')) keepAboveKeyboard(f);
    else if (keyboardRoom) { setRoom(keyboardRoom, 0); keyboardRoom = null; } // the keyboard went with the focus: the room goes too
  };
  const keyboardSoon = () => { clearTimeout(keyboardTimer); keyboardTimer = setTimeout(keyboardSettle, 350); }; // once the keyboard has risen (iOS: ~300ms) and a fold has opened
  document.addEventListener('focusin', (e) => { if (e.target.matches && e.target.matches('input, textarea')) keyboardSoon(); });
  document.addEventListener('focusout', keyboardSoon);
  if (window.visualViewport) ['resize', 'scroll'].forEach((t) => window.visualViewport.addEventListener(t, keyboardSettle));

  // The sound as "Words submitted" comes in (Bill, 2026-10-15: always, music or not): decoded once
  // the page has settled (as the symbols are); woken on arriving at the last step (go()) and again by
  // the Add words click itself (a browser lets sound start only from a click), played by sent() as soon as
  // the words have gone; the slide follows its bell (SOUND_LEAD_MS) (js/music.js → effect).
  setTimeout(() => { if (window.Music) Music.loadEffects(); }, 1200);

  /* ---------- Sending (Bill, 2026-10-18; it was a white spinner) ----------
     "Add words" erases as on hover and "Adding" loops in its place (js: adding, below) until the
     Worker answers — and for as long as there is no connection: offline at the click, or no answer
     within SEND_LIMIT_MS (a train between stations). Then the words wait on this device and go by
     themselves as soon as they can: at the browser's 'online', and with a try every RETRY_MS (a
     phone can say it is online with nothing getting through). Refused (too many from here today,
     anything else): "Adding" erases, "Add words" types back. The line under the button says what is
     happening, in place of its usual words. The words are kept on this device all along (keptWords,
     below) until they have gone. md/checks/adding has every case on a test page; on localhost,
     add.html?send=slow|offline|drop|tooFast|tooMany|ourSide plays one of them with the real form. */
  const SEND_LIMIT_MS = 15000, RETRY_MS = 10000;
  const SEND_SAY = {
    offline: 'You’re offline. The words will be sent once you’re back.', // (Bill: offline and a dropped connection alike)
    tooFast: 'That’s a lot at once. Your words are saved on this device; try again in a few minutes.', // (more than 3 in 2 minutes: workers/submit BURST_MAX)
    tooMany: 'Too many submissions today. Your words are saved on this device; try again tomorrow.', // (the whole site's day: workers/submit PER_DAY)
    ourSide: 'Something went wrong on our side. Your words are saved on this device; try again in a minute.',
  };
  const sendNote = $('sendNote'), SEND_NOTE_USUAL = sendNote.innerHTML;
  let sendNoteNow = SEND_NOTE_USUAL;
  // The line under the button fades to its new words (out NOTE_OUT_MS, in NOTE_IN_MS); `now`: at once.
  const NOTE_OUT_MS = 150, NOTE_IN_MS = 250;
  function sayUnderButton(html, now) {
    html = html || SEND_NOTE_USUAL;
    if (html === sendNoteNow) return;
    sendNoteNow = html;
    sendNote.getAnimations().forEach((a) => a.cancel());
    if (now || reduceMotion.matches) { sendNote.innerHTML = html; return; }
    sendNote.animate([{ opacity: 1 }, { opacity: 0 }], { duration: NOTE_OUT_MS, fill: 'forwards' }).finished.then(() => {
      sendNote.innerHTML = html;
      sendNote.animate([{ opacity: 0 }, { opacity: 1 }], { duration: NOTE_IN_MS, fill: 'forwards' });
    }).catch(() => {});
  }

  // On localhost, nothing is sent (SUBMIT_URL ''): ?send= plays an answer instead.
  const FAKE_SEND = LOCAL ? new URLSearchParams(location.search).get('send') : null;
  let fakeTries = 0;
  const later = (ms) => new Promise((r) => setTimeout(r, ms));
  async function post(entry) { // → 'ok' | 'net' (no connection, no answer in time) | 'tooFast' | 'tooMany' | 'ourSide'
    if (!SUBMIT_URL) {
      fakeTries += 1;
      if (FAKE_SEND === 'slow') await later(6000);
      if (FAKE_SEND === 'offline' && fakeTries === 1) return 'net';
      if (FAKE_SEND === 'drop' && fakeTries === 1) { await later(SEND_LIMIT_MS); return 'net'; }
      if ((FAKE_SEND === 'tooFast' || FAKE_SEND === 'tooMany' || FAKE_SEND === 'ourSide') && fakeTries === 1) { await later(1500); return FAKE_SEND; }
      // Kept in this browser so the entry can be inspected.
      const key = 'wwk-pending';
      try { const pending = JSON.parse(localStorage.getItem(key) || '[]'); pending.push(entry); localStorage.setItem(key, JSON.stringify(pending)); } catch (e) {}
      console.log('[Words We Keep] submission (local, saved to localStorage "wwk-pending"):', entry);
      return 'ok';
    }
    const stop = new AbortController(), limit = setTimeout(() => stop.abort(), SEND_LIMIT_MS);
    try {
      const r = await fetch(SUBMIT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry), signal: stop.signal });
      if (r.ok) return 'ok';
      console.error(`Submit refused: ${r.status}`);
      if (r.status !== 429) return 'ourSide';
      const why = await r.json().catch(() => ({}));
      return why && why.wait === 'minutes' ? 'tooFast' : 'tooMany';
    } catch (err) {
      return 'net';
    } finally { clearTimeout(limit); }
  }

  // Each entry carries a `sendId`, made at the click: the Worker keeps the first that arrives and
  // ignores the same id again (workers/submit → sent:<id>), so a send retried after its answer was
  // lost is never kept twice. Pressed again after a refusal with the words unchanged, the same id
  // (it may have been kept after all); changed words are a new entry, with a new id.
  const newSendId = () => (crypto.randomUUID ? crypto.randomUUID() : [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join(''));
  const sameEntry = (e) => JSON.stringify({ ...e, submittedAt: 0, elapsed: 0, sendId: 0 });
  let sending = false, sendEntry = null, trying = false, retryTimer = 0;
  async function submit() {
    if (sending || !valid.every((v) => v())) return;
    if (window.Music) Music.unlock();
    const entry = payload(); // the words as they were at the click, however long they wait
    entry.sendId = sendEntry && sameEntry(sendEntry) === sameEntry(entry) ? sendEntry.sendId : newSendId();
    sendEntry = entry;
    sending = true;
    adding.start();
    sayUnderButton(null);
    attempt();
  }
  async function attempt() {
    clearTimeout(retryTimer);
    if (!sending || trying) return;
    if (SUBMIT_URL && navigator.onLine === false) return waitForConnection();
    trying = true;
    const answer = await post(sendEntry);
    trying = false;
    if (!sending) return;
    if (answer === 'ok') return sent();
    if (answer === 'net') return waitForConnection();
    // Refused: "Add words" is back, and the line says why.
    sending = false;
    adding.stop();
    sayUnderButton(SEND_SAY[answer]);
  }
  function waitForConnection() {
    sayUnderButton(SEND_SAY.offline);
    clearTimeout(retryTimer);
    retryTimer = setTimeout(attempt, RETRY_MS);
  }
  window.addEventListener('online', () => { if (sending) attempt(); });
  // The bell first, then the page (Bill, 2026-10-23): the sound waits for the words to have gone,
  // however long that takes ("Adding" loops meanwhile — "the ding waits until it's set"), and starts as
  // they have; the slide to "Words submitted" starts SOUND_LEAD_MS after it ("we can set the slide
  // starting after the bell"; 160ms, Bill's value on md/checks/sounds/last-two.html's dial). The sound
  // is never cut. No sound (a browser that cannot keep up, or the file not decoded): the slide at once.
  const SOUND_LEAD_MS = 160;
  function sent() {
    sending = false; sendEntry = null;
    keptWords.clear();
    const sounding = !!(window.Music && !slowTab() && Music.effect('submitted'));
    setTimeout(() => {
      go(STEPS, { force: true });
      showDone();
      // Once step 5 is out of sight: the button and its line as they were.
      setTimeout(() => { adding.putBack(); sayUnderButton(null, true); }, reduceMotion.matches ? 0 : 600);
    }, sounding ? (LOCAL && Number.isFinite(window.WWK_SOUND_LEAD) ? window.WWK_SOUND_LEAD : SOUND_LEAD_MS) : 0); // (on localhost, md/checks/sounds/last-two.html's dial may set another)
  }
  $('submitBtn').addEventListener('click', submit);

  // Every field empty, as the page opens (reset, and "Start over" for kept words).
  function clearFields() {
    data = blank();
    ['fText', 'fOriginal', 'fName', 'fNative', 'fTitle', 'fSourceLink', 'fContext', 'fReflection', 'fKeptBy', 'fWebsite'].forEach((id) => { $(id).value = ''; });
    typedFields().forEach(fieldLook);
    fold($('fOriginalWrap'), false); fold($('origToggleWrap'), true); fold($('fNativeWrap'), false); showSourceFields(false);
    who.set('person'); origin.set(''); showWho('person');
    document.querySelectorAll('.cat').forEach((b) => b.setAttribute('aria-checked', 'false'));
    document.querySelectorAll('.fw.is-warn').forEach((w) => w.classList.remove('is-warn'));
    warnLink('');
    country.set(''); kind.set(''); year.set(''); linkHint('');
    sameQuote = null; sourceFrom = null; showSameWords(); fold($('sourceNote'), false);
    Object.assign(guess, { country: '', origin: '', ownCountry: false, ownOrigin: false });
    keptNote(false);
    ideas.reset();
  }
  function reset(landed) {
    clearFields();
    keptWords.fresh();
    // From "Words submitted", a fresh step 1 comes in from below (one slide down, like every
    // other step), not by rewinding up through all five. Step 1 is parked under the done screen
    // for the slide, then everything is put back in place without a transition.
    const first = steps[0], ms = reduceMotion.matches ? 0 : 600;
    first.style.setProperty('--i', STEPS + 1);
    stepsEl.style.transform = `translateY(${-(STEPS + 1) * 100}%)`;
    sliding = true;
    cur = 0;
    refresh();
    reqIn(first);
    setTimeout(() => {
      stepsEl.style.transition = 'none';
      first.style.setProperty('--i', 0);
      stepsEl.style.transform = 'translateY(0)';
      void stepsEl.offsetHeight;
      stepsEl.style.transition = '';
      sliding = false;
      if (landed) landed(); // in the same moment: one change to the page, not two (a watching extension wakes per change)
    }, ms);
  }
  $('againBtn').addEventListener('click', () => {
    // Once the page has slid back to step 1: the confirmation is put away and the logo draws in.
    reset(() => {
      $('done').classList.remove('is-in');
      if (doneStop) doneStop();
      homeDraw();
    });
  });

  /* ---------- The words kept on this device until they have gone (Bill, 2026-10-18) ----------
     Everything typed or chosen is kept in localStorage (KEPT_KEY), once KEPT_WAIT_MS after the
     last change (nothing is written while one types) and as the page is left, and put back when
     the form opens again — a reload, a closed tab, a phone that dropped the page, a send still
     waiting for a connection. Step 1 then says so, with "Start over". Gone once the words have
     been sent, or after KEPT_DAYS. */
  const KEPT_KEY = 'wwk-draft', KEPT_DAYS = 30, KEPT_WAIT_MS = 400;
  const keptWords = (() => {
    const get = () => { try { return localStorage.getItem(KEPT_KEY); } catch (e) { return null; } };
    const put = (v) => { try { if (v === null) localStorage.removeItem(KEPT_KEY); else localStorage.setItem(KEPT_KEY, v); } catch (e) {} };
    const empty = JSON.stringify(blank());
    let timer = 0, sent = false; // sent: nothing is kept until the form is started again ("Add another")
    const save = () => { clearTimeout(timer); if (sent) return; put(JSON.stringify(data) === empty ? null : JSON.stringify({ at: Date.now(), data, guess })); };
    const soon = () => { if (sent) return; clearTimeout(timer); timer = setTimeout(save, KEPT_WAIT_MS); };
    ['input', 'change', 'click', 'pointerup', 'keyup'].forEach((t) => document.addEventListener(t, soon, true));
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
    return {
      clear() { clearTimeout(timer); sent = true; put(null); },
      fresh() { sent = false; },
      load() {
        try { const k = JSON.parse(get()); if (k && k.data && Date.now() - k.at < KEPT_DAYS * 864e5) return k; } catch (e) {}
        put(null); return null;
      },
    };
  })();
  // Step 1's line under its question: "We kept your words from last time. Start over", or as usual.
  const TEXT_DESC = noOrphans($('textDesc').textContent);
  function keptNote(on) {
    $('textDesc').innerHTML = on ? 'We kept your words from last time. <span role="link" tabindex="0" id="startOver">Start over</span>' : TEXT_DESC;
  }
  $('textDesc').addEventListener('click', (e) => { if (e.target.id === 'startOver') startOver(); });
  $('textDesc').addEventListener('keydown', (e) => { if (e.target.id === 'startOver' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); startOver(); } });
  async function startOver() {
    if (!(await ask('Start over? The words you kept will be cleared.', 'Start over', 'Keep them'))) return;
    clearFields(); refresh();
    keptWords.clear(); keptWords.fresh();
    $('fText').focus({ preventScroll: true });
  }
  // The kept words back in their fields, as if chosen and typed again.
  function putBackKept(k) {
    const b = blank(), d = k.data, str = (v) => (typeof v === 'string' ? v : '');
    data = {
      ...b, text: str(d.text), original: str(d.original), context: str(d.context), reflection: str(d.reflection), keptBy: str(d.keptBy),
      categories: (Array.isArray(d.categories) ? d.categories : []).filter((c) => CATEGORIES.some((x) => x.key === c)),
      author: { ...b.author, ...d.author }, source: { ...b.source, ...d.source },
      annotations: (Array.isArray(d.annotations) ? d.annotations : []).filter((a) => a && typeof a.word === 'string' && typeof a.explanation === 'string'),
    };
    const a = { ...data.author }, src = { ...data.source };
    if (!WHO.some((w) => w.value === a.kind)) a.kind = data.author.kind = 'person';
    [['fText', data.text], ['fOriginal', data.original], ['fName', a.name], ['fNative', a.nativeName], ['fTitle', src.title], ['fSourceLink', src.link], ['fContext', data.context], ['fReflection', data.reflection], ['fKeptBy', data.keptBy]]
      .forEach(([id, v]) => { $(id).value = str(v); });
    if (data.original.trim()) { fold($('fOriginalWrap'), true); fold($('origToggleWrap'), false); }
    document.querySelectorAll('.cat').forEach((el) => el.setAttribute('aria-checked', String(data.categories.includes(el.dataset.key))));
    who.set(a.kind); showWho(a.kind); // (who's onChange skips a kind already in data)
    country.set(str(a.country)); origin.set(str(a.origin));
    kind.set(str(src.kind)); year.set(str(src.year));
    Object.assign(guess, { country: '', origin: '', ownCountry: true, ownOrigin: true }, k.guess || {});
    typedFields().forEach(fieldLook);
    keptNote(true);
    refresh();
  }
  { const k = keptWords.load(); if (k) putBackKept(k); }

  /* ---------- Words submitted: the symbols ----------
     The category symbols' drawing code and data (assets/symbols, as the archive uses them: js/app.js
     → "Symbols"). Fetched a moment after the page has loaded, well before anything is submitted.
     Without them the still images stand: the logo simply goes and comes, the large symbol is
     simply there. */
  const SYM_DIR = 'assets/symbols/'; // the drawing code (no shapes in it)
  const SYM_DATA = 'https://fonts.wordswekeep.org/s/'; // the symbols' shapes and motion: the fonts Worker, not the public repo (2026-10-10)
  const HOME_OUT_MS = 300; // the logo drawing itself out (the archive's MENU_ICON_MS)
  let sym = null;          // { lib, model, home, done } once the files are in
  // The drawing writes into its svg every frame (paths, gradients, blur), and an extension watching the page
  // is woken by each write — on the thread that draws the page: with a stand-in spending 20ms a time, the
  // logo's draw-out and the large symbol held frames 30–90ms (2026-10-16; md/checks/form-lag). So each svg
  // is drawn inside a closed shadow root, which a watcher of the document does not see; the host keeps the
  // svg's class, so the page's css places and sizes it as before. The same drawing, the same look.
  function unwatched(svg) {
    const host = document.createElement('span');
    host.className = svg.getAttribute('class'); host.setAttribute('aria-hidden', 'true');
    svg.replaceWith(host);
    svg.removeAttribute('id'); svg.style.cssText = 'display: block; width: 100%; height: 100%; overflow: visible;'; // (app.css .sym, out of the page's css reach in there)
    host.attachShadow({ mode: 'closed' }).appendChild(svg);
    return svg;
  }
  const symReady = new Promise((r) => setTimeout(r, 1200))
    .then(() => Promise.all([import(new URL(SYM_DIR + 'ribbon-draw.js', document.baseURI).href), fetch(SYM_DATA + 'symbol-draw-in.json').then((r) => { if (!r.ok) throw new Error(`symbols: ${r.status}`); return r.json(); })]))
    .then(([lib, data]) => {
      const model = lib.createModel(data);
      sym = { lib, model, home: lib.createRenderer(unwatched($('homeSym')), model, { levels: 2, pieces: 10 }), done: lib.createRenderer(unwatched($('doneSym')), model) };
    });
  symReady.catch((err) => console.error(err));
  const home = document.querySelector('.home');
  let homeStop = null, doneStop = null;
  // The logo undraws itself, thin tip back to thick tip, on the site's curve run forwards
  // (as the archive's mark does when the menu opens: js/app.js → undrawMark).
  function homeUndraw() {
    home.classList.add('is-out');
    if (homeStop) homeStop();
    homeStop = null;
    if (!sym || reduceMotion.matches) { home.style.visibility = 'hidden'; return; }
    const ease = sym.model.ease, t0 = performance.now();
    const at = (left) => { let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (ease(mid) < left) lo = mid; else hi = mid; } return (lo + hi) / 2; };
    sym.home.rest('All');
    home.classList.add('is-live');
    let raf = 0;
    const tick = (now) => {
      const t = Math.min((now - t0) / HOME_OUT_MS, 1);
      sym.home.drawIn('All', t < 1 ? at(1 - ease(t)) : 0, 3);
      if (t < 1) raf = requestAnimationFrame(tick); else homeStop = null;
    };
    raf = requestAnimationFrame(tick);
    homeStop = () => cancelAnimationFrame(raf);
  }
  function homeDraw() { // …and draws back in
    home.classList.remove('is-out');
    if (homeStop) homeStop();
    homeStop = null;
    home.style.visibility = '';
    if (!sym || !home.classList.contains('is-live')) return; // the still logo, simply back
    sym.home.drawIn('All', 0);
    homeStop = sym.lib.play(sym.model, (t) => sym.home.drawIn('All', t, 3)); // reduced motion: straight to the end
  }
  // The confirmation comes in once the page has slid to it: the symbol draws in, the text and
  // the buttons fade up (css .done.is-in).
  $('doneText').lastChild.textContent = noOrphans($('doneText').lastChild.textContent); // (its last line: the text breaks after each sentence)
  function showDone() {
    const done = $('done'), box = done.querySelector('.done-sym');
    homeUndraw();
    box.classList.toggle('is-static', !sym);
    if (sym) sym.done.drawIn('All', 0);
    setTimeout(() => {
      done.classList.add('is-in');
      if (doneStop) doneStop();
      doneStop = null;
      if (sym) doneStop = sym.lib.play(sym.model, (t) => sym.done.drawIn('All', t));
    }, reduceMotion.matches ? 0 : 600); // the step's slide (css --step-ms)
  }

  /* ---------- "Add words": the landing page's label animation ----------
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
    // Each letter's going and coming back is one Web Animation (nothing written into the page as it
    // runs: a watching extension woke on each of the letters' 2 × n timed changes). Played again
    // midway, a letter already gone stays gone until its turn to come back, as before.
    const play = () => {
      if (btn.disabled || btn.classList.contains('is-adding') || reduceMotion.matches) return;
      const gone = cells.map((cell) => getComputedStyle(cell).opacity === '0');
      const eraseDone = cells.length * LABEL_STEP_MS, total = eraseDone + cells.length * LABEL_STEP_MS;
      cells.forEach((cell, i) => {
        cell.getAnimations().forEach((a) => a.cancel());
        const out = (i * LABEL_STEP_MS) / total, back = (eraseDone + i * LABEL_STEP_MS) / total, from = gone[i] ? 0 : 1;
        cell.animate([{ opacity: from, offset: 0 }, { opacity: from, offset: out }, { opacity: 0, offset: out }, { opacity: 0, offset: back }, { opacity: 1, offset: back }, { opacity: 1, offset: 1 }], { duration: total });
      });
    };
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      btn.addEventListener('mouseenter', play);
      btn.addEventListener('mouseleave', play);
    } else {
      // Touch: once, as the button turns from disabled to ready.
      new MutationObserver(() => { if (!btn.disabled) play(); }).observe(btn, { attributes: true, attributeFilter: ['disabled'] });
    }
    return { play, cells };
  }
  const addLabel = typewriterLabel($('submitBtn'));

  /* ---------- "Add words" while sending: "Adding" (Bill, 2026-10-18) ----------
     The click erases "Add words" left→right, ADD_STEP_MS a letter; a step later "Adding" (laid over
     it, never setting the button's width: css .label--busy) types in left→right, stays whole
     ADD_HOLD_MS, erases left→right, and a step later types in again, until stop() or putBack().
     Every letter is one Web Animation and the loop is its own iterations: nothing is written into
     the page while it runs. Reduced motion: "Adding" simply there. */
  const ADD_STEP_MS = 50, ADD_HOLD_MS = 600;
  const adding = (() => {
    const btn = $('submitBtn'), cells = addLabel.cells;
    const over = document.createElement('span');
    over.className = 'label label--busy'; over.setAttribute('aria-hidden', 'true');
    const busy = [...'Adding'].map((ch) => { const c = document.createElement('span'); c.className = 'cell'; c.textContent = ch; over.appendChild(c); return c; });
    btn.appendChild(over);
    const cancel = (els) => els.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    const shown = (el) => getComputedStyle(el).opacity !== '0';
    // Each letter steps to `to` (0 or 1), a step apart, from wherever it stands → when the last has.
    const wipe = (els, to, delay = 0) => {
      const from = els.map((el) => (shown(el) ? 1 : 0));
      cancel(els);
      if (reduceMotion.matches) { els.forEach((el) => el.animate([{ opacity: to }, { opacity: to }], { duration: 1, fill: 'forwards' })); return 0; }
      els.forEach((el, i) => el.animate([{ opacity: from[i] }, { opacity: from[i], offset: 0.999 }, { opacity: to }], { duration: i * ADD_STEP_MS + 1, delay, fill: 'both' }));
      return delay + els.length * ADD_STEP_MS;
    };
    // Letter i in at i·step, out ADD_HOLD_MS after the last came in; a step, and round again.
    const loop = (delay) => {
      cancel(busy);
      if (reduceMotion.matches) { busy.forEach((c) => c.animate([{ opacity: 1 }, { opacity: 1 }], { duration: 1, fill: 'forwards' })); return; }
      const n = busy.length, turn = (2 * n - 1) * ADD_STEP_MS + ADD_HOLD_MS;
      busy.forEach((c, i) => {
        const on = (i * ADD_STEP_MS) / turn, off = ((n - 1) * ADD_STEP_MS + ADD_HOLD_MS + i * ADD_STEP_MS) / turn;
        c.animate([{ opacity: 0, offset: 0 }, { opacity: 0, offset: on }, { opacity: 1, offset: on }, { opacity: 1, offset: off }, { opacity: 0, offset: off }, { opacity: 0, offset: 1 }], { duration: turn, delay, iterations: Infinity });
      });
    };
    const busyOn = (on) => {
      btn.classList.toggle('is-adding', on);
      if (on) { btn.setAttribute('aria-busy', 'true'); btn.setAttribute('aria-label', 'Adding your words'); }
      else { btn.removeAttribute('aria-busy'); btn.removeAttribute('aria-label'); }
    };
    return {
      start() { busyOn(true); loop(wipe(cells, 0)); },
      stop() { wipe(cells, 1, wipe(busy, 0)); busyOn(false); }, // "Adding" erases, "Add words" types back
      putBack() { cancel(cells); cancel(busy); busyOn(false); }, // at once (out of sight)
    };
  })();

  /* ---------- Box buttons: pressed (Bill, 2026-10-15; css: form.css → .btn.is-pressed) ----------
     The public pages only (not the library). Held down, a box button's box shrinks a little and its
     words stay their size; let go, it comes back — but never before the way in (--press-down) is over, so a quick tap shows the whole dip. */
  document.documentElement.classList.add('btn-press'); // (the box drawn behind the words: css → .btn-press)
  const PRESS_IN_MS = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--press-down')) || 100;
  const pressBtn = (b) => { if (!b || b.disabled) return; b._pressedAt = performance.now(); b.classList.add('is-pressed'); };
  const releaseBtns = () => document.querySelectorAll('.btn.is-pressed').forEach((b) => {
    setTimeout(() => b.classList.remove('is-pressed'), Math.max(0, PRESS_IN_MS - (performance.now() - b._pressedAt)));
  });
  document.addEventListener('pointerdown', (e) => { if (e.button === 0 && e.target.closest) pressBtn(e.target.closest('.btn')); }, true);
  ['pointerup', 'pointercancel'].forEach((t) => window.addEventListener(t, releaseBtns, true));
  window.addEventListener('blur', (e) => { if (e.target === window) releaseBtns(); }); // the window losing focus mid-press (not a field's blur)
  document.addEventListener('keydown', (e) => { if (!e.repeat && (e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.btn')) pressBtn(e.target); }, true);
  document.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') releaseBtns(); }, true);

  /* ---------- Browser chrome colour (see js/app.js → syncChromeColor) ---------- */

  function setChrome(color) {
    document.documentElement.style.backgroundColor = document.body.style.backgroundColor = color;
    $('themeColor').setAttribute('content', color);
  }
  setChrome(getComputedStyle(document.documentElement).getPropertyValue('--paper').trim());

  document.querySelectorAll('.q-desc').forEach((p) => { if (!p.children.length) p.textContent = noOrphans(p.textContent); }); // (step 1's "Start over" line is already set: keptNote)
  steps.forEach((s, i) => s.style.setProperty('--i', i));
  refresh();

  // Links are buttons with a data-href, not <a href>: a browser shows an <a>'s address in a
  // strip at the foot of the window whenever the pointer is over it. This is what a click on
  // one does (unless its own handler has dealt with it): go there; in a new tab with ⌘ / Ctrl,
  // a middle click, or for a link out of the site (data-out).
  const follow = (el, e) => {
    const href = el.dataset.href;
    if (el.hasAttribute('data-out') || e.metaKey || e.ctrlKey || e.button === 1) window.open(href, '_blank', 'noopener');
    else location.href = href;
  };
  document.addEventListener('click', (e) => { const el = e.target.closest('[data-href]'); if (el && !e.defaultPrevented) follow(el, e); });
  document.addEventListener('auxclick', (e) => { const el = e.target.closest('[data-href]'); if (el && e.button === 1) follow(el, e); });
  document.addEventListener('keydown', (e) => { // a span with role="link" (the notes' source) answers Enter like a link
    if (e.key === 'Enter' && e.target.matches && e.target.matches('span[data-href]')) follow(e.target, e);
  });

  // The logo goes home: the form fades out around it first (css .is-leaving).
  document.querySelector('.home').addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // a new tab: `follow` opens it
    e.preventDefault();
    const href = e.currentTarget.dataset.href;
    session.set('wwk-home', '1');
    form.classList.add('is-leaving');
    setTimeout(() => { location.href = href; }, reduceMotion.matches ? 0 : 100);
  });
  window.addEventListener('pageshow', () => form.classList.remove('is-leaving'));

  // Opened from the archive's "Add words": play the entrance (css .is-arriving).
  if (session.get('wwk-arrive')) {
    session.remove('wwk-arrive');
    const blocks = steps[0].querySelectorAll('.content > .group > *, .content > .btn');
    blocks.forEach((el, k) => { el.classList.add('rise'); el.style.setProperty('--k', k); });
    // The pager comes in once the last block has landed (css: 300ms each, 50ms apart; then the
    // pager's three parts, 100ms apart, 300ms each).
    const blocksDone = 300 + Math.max(0, blocks.length - 1) * 50;
    form.style.setProperty('--pager-at', `${blocksDone}ms`);
    form.classList.add('is-arriving');
    reqIn(steps[0]); // the asterisk, once the blocks have landed
    setTimeout(() => { form.classList.remove('is-arriving'); document.documentElement.classList.remove('is-arriving', 'is-from-menu'); }, blocksDone + 600);
    focusStep(0, blocksDone); // the cursor, once the blocks have landed
  } else { reqIn(steps[0]); focusStep(0, 0); } // opened directly: the asterisk the same wait; the cursor at once
})();
