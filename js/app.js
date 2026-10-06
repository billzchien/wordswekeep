/* Words We Keep — main experience. Plain JS, renders from data/quotes.json. */
(() => {
  const DATA_URL = 'data/quotes.json';
  const FACES_URL = 'data/faces.json'; // the quote faces' tuned settings (the library's Fonts tab)

  const CATEGORIES = [
    { key: 'perspective', name: 'Perspective', desc: 'The lens we bring to life. Values, time, presence, and the search for meaning.' },
    { key: 'growth',      name: 'Growth',      desc: 'The hardships, changes, and realizations that shape who we become.' },
    { key: 'drive',       name: 'Drive',       desc: 'The work, ambition, and craft we pour into building something that matters.' },
    { key: 'community',   name: 'Community',   desc: 'The family, friends, and connections that remind us we’re not alone.' },
    { key: 'romance',     name: 'Romance',     desc: 'The joy and heartbreak of loving and being loved.' },
  ];
  const ALL = {
    key: 'all', name: 'All words',
    desc: 'Words We Keep is a collection of words from every culture, time, and corner of life, shared by the people who hold them close. Words that found you at the right time, changed how you see, and stayed engraved. It hopes to revive the good spirit of the internet, where wisdom from strangers can inspire and heal. A side project by Bill, a designer based in Brooklyn. Thoughts go to hello@wordswekeep.org',
    links: [ // the first of each text in desc becomes a link (js → setDesc)
      { text: 'Bill', href: 'https://www.billchien.net' },
      { text: 'hello@wordswekeep.org', href: 'mailto:hello@wordswekeep.org' },
    ],
  };
  const CAT_BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));
  // Titles are set in italics for a book or a film / TV work only; everything else stays upright.
  // (Form kinds: book · film · song · poem · speech · writing · personal · other.)
  const ITALIC_KINDS = new Set(['book', 'film']);
  // The language button (tuned by Bill on a temporary page, 2026-10-06): for each language not in
  // Latin letters, the short label its own sites use, in a font of its script; size in px,
  // tracking in % of the size, nudge in tenths of a px (− up, + down: scripts sit differently in
  // the box). EN — the way back — and any Latin-script language's two-letter code (ES, FR…) are
  // set alike, by `en`; "Aa" when the language is not known. Its fonts are in index.html's links.
  const LANG_BUTTON = {
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
  const langLabel = (code) => (LANG_BUTTON[code] ? LANG_BUTTON[code].label : /^[a-z]{2}$/i.test(code || '') ? code.toUpperCase() : 'Aa');
  // The button's face (css .lang reads these), and its label inside a span that takes the nudge.
  function langButtonInner(code) {
    const b = LANG_BUTTON[code] || { ...LANG_BUTTON.en, label: langLabel(code) };
    const style = `--lb-font: '${b.font}'; --lb-weight: ${b.weight}; --lb-size: ${b.size}px; --lb-track: ${b.tracking / 100}em; --lb-nudge: ${b.nudge / 10}px`;
    return { style, html: `<span>${esc(b.label)}</span>` };
  }

  // The quote faces (css/fonts.css; Figma: Type 310:3916). A quote names one in `font`.
  // `not`: the length tiers the face is not drawn for (Figma's boards at 20%).
  const FONTS = [
    { key: 'instrument', name: 'Instrument', not: [],
      latin: 'A1-A3 A5 A7-AB AE-B0 B4 B6-B8 BA-BB BF-107 10A-113 116-11B 11E-123 126-127 12A-12B 12E-133 136-137 139-13E 141-148 14A-14D 150-15B 15E-161 164-165 16A-17E 1CD-1CE 218-21B 237 1E80-1E85 1E9E 1EF2-1EF3 2013-2014 2018-201A 201C-201E 2022 2026 2039-203A 20AC' },
    { key: 'story',      name: 'Story',      not: [],
      latin: 'A1-AC AE-B4 B6-13E 141-148 14A-17E 181 186 18A 18E-190 192 197-199 19D 1A0-1A1 1AF-1B0 1B3-1B4 1CD-1DD 1E2-1E3 1E6-1E7 218-21B 232-233 237 245 1E04-1E05 1E0C-1E0F 1E20-1E21 1E24-1E2B 1E32-1E3B 1E40-1E49 1E56-1E5F 1E62-1E63 1E6C-1E6F 1E80-1E85 1E88-1E89 1E8C-1E8F 1E92-1E96 1E9E 1EA0-1EF9 2013-2014 2018-201A 201C-201E 2020-2022 2026 2039-203A 2044 2070 2074-2079 2080-2089 20A1 20A6 20A9-20AC' },
    { key: 'print',      name: 'Print',      not: [],
      latin: 'A1-AC AE-B4 B6-131 134-137 139-13E 141-148 14A-165 168-17E 181 186 18A 18E-190 197-199 19D 1A0-1A1 1AF-1B0 1B3-1B4 1CD-1DD 1E2-1E3 1E6-1E7 218-21B 232-233 237 245 1E04-1E05 1E0C-1E0F 1E20-1E21 1E24-1E2B 1E32-1E3B 1E40-1E49 1E56-1E5F 1E62-1E63 1E6C-1E6F 1E80-1E85 1E88-1E89 1E8C-1E8F 1E92-1E96 1E9E 1EA0-1EF9 2013-2014 2018-201A 201C-201E 2020-2022 2026 2039-203A 2044 2070 2074-2079 2080-2089 20A1 20A6 20A9 20AB-20AC' },
    { key: 'grotesk',    name: 'Grotesk',    not: [],
      latin: 'A1-A3 A5-B4 B6-137 139-148 14A-17E 192 1FC-1FF 218-21B 237 1E80-1E85 1EBC-1EBD 1EF2-1EF3 1EF8-1EF9 2013-2014 2018-201A 201C-201E 2020-2022 2026 2030 2039-203A 2044 20AC' },
    { key: 'round',      name: 'Round',      not: [],
      latin: 'A1-AC AE-B1 B4-B8 BA-113 116-12B 12E-13E 141-148 14A-14D 150-165 168-17E 18F 192 1A0-1A1 1AF-1B0 1E2-1E3 218-21B 237 1E0C-1E0D 1E20-1E21 1E24-1E25 1E2A-1E2B 1E34-1E3B 1E40-1E49 1E5C-1E5F 1E62-1E63 1E6C-1E6F 1E80-1E85 1E8E-1E8F 1E92-1E96 1E9E 1EA0-1EF9 2013-2014 2018-201A 201C-201E 2020 2022 2026 2032-2033 2039-203A 2044 20AC' },
    { key: 'poet',       name: 'Poet',       not: [],
      latin: 'A1-A3 A5 A7 A9-AB AD-AE B0 B2-B3 B9-BB BF-F6 F8-10F 112-121 124-125 128-131 134-137 139-13E 141-148 14C-14F 152-155 158-165 168-16F 172-17E 218-21B 237 1E9E 2013-2014 2018-201A 201C-201E 2022 2039-203A 20AC' },
    { key: 'goudy',      name: 'Goudy',      not: [],
      latin: 'A1-137 139-149 14C-17F 192 218-21B 237 2013-2014 2018-201A 201C-201E 2020 2022 2026 2039-203A 2044 20AC' },
    { key: 'sketch',     name: 'Sketch',     not: [],
      latin: 'A1-B4 B6-12B 12E-149 14C-17E 192 218-21B 237 1E80-1E85 1E9E 2013-2014 2018-201A 201C-201E 2020-2022 2026 2030 2039-203A 2044 20A3-20A4 20AC' },
    { key: 'rose',       name: 'Rose',       not: [],
      latin: 'A1-A9 AB-AC AE-B1 B4 B6-B8 BB BF-DD DF-FD FF-107 10C-10F 112-113 116-11B 122-123 12A-12B 12E-12F 136-137 139-13E 141-148 14C-14D 150-15B 15E-165 16A-16B 16E-17E 1E80-1E85 1E9E 1EF2-1EF3 2013-2014 2018-201A 201C-201E 2020-2022 2026 2030 2039-203A 20AC' },
    { key: 'author',     name: 'Author',     not: [],
      latin: 'A1-A9 AB AE-B1 B4 B6-B8 BB BF-107 10C-113 116-11B 122-123 12A-12B 12E-12F 131-133 136-137 139-13E 141-148 14C-14D 150-15B 15E-165 16A-16B 16E-17E 237 1E80-1E85 1E9E 1EF2-1EF3 2013-2014 2018-201A 201C-201E 2020-2022 2026 2030 2039-203A 20AC' },
    { key: 'fig',        name: 'Fig',        not: [],
      latin: 'A1-AC AE-B4 B6-127 12A-137 139-148 14A-167 16A-17E 18F 192 1FC-1FF 218-21B 237 1E80-1E85 1E9E 1EF2-1EF3 2013-2014 2018-201A 201C-201E 2020-2022 2026 2030 2039-203A 2044 20A9 20AC' },
    { key: 'stone',      name: 'Stone',      not: [],
      latin: 'A1-A9 AB AE-B1 B4 B6-B8 BB BF-EF F1-107 10A-113 116-11B 11E-123 126-127 12A-12B 12E-131 136-137 139-13E 141-148 14A-14D 150-15B 15E-167 16A-16B 16E-17E 218-21B 1E80-1E85 1EF2-1EF3 2013-2014 2018-201A 201C-201E 2020-2022 2026 2030 2039-203A 20AC' },
    { key: 'rondeau',    name: 'Rondeau',    not: [],
      latin: 'A1-AB AE-B4 B6-148 14A-17E 1E6-1E7 1FC-1FF 218-21B 232-233 237 1E80-1E85 1E9E 1EBC-1EBD 1EF2-1EF3 1EF8-1EF9 2010 2013-2014 2018-201A 201C-201E 2020-2022 2026 2030 2032-2033 2039-203A 2044 2070 2074-2079 2080-2089 20AC' },
  ];
  const FONT_BY_KEY = Object.fromEntries(FONTS.map((f) => [f.key, f]));
  // An original-language quote written in Latin letters (Spanish, French, Vietnamese, pinyin…)
  // is set in the quote's own face when the face has every character it needs; anything else —
  // another script, or a letter the face lacks — is set in Noto. `latin`: what a face has beyond
  // ASCII, as hex ranges (made by workers/fonts/tools/coverage.py; the same table is in
  // js/admin.js: change both). Poet's missing "…" is dealt with separately.
  const faceChars = new Map();
  function nativeInFace(text, key) {
    const face = FONT_BY_KEY[key];
    if (!face || !text) return false;
    if (!faceChars.has(key)) {
      const has = new Set();
      face.latin.split(' ').forEach((r) => { const [a, b = a] = r.split('-').map((h) => parseInt(h, 16)); for (let c = a; c <= b; c++) has.add(c); });
      faceChars.set(key, has);
    }
    const has = faceChars.get(key);
    return [...text].every((ch) => { const c = ch.codePointAt(0); return /\s/.test(ch) || (c >= 0x20 && c <= 0x7e) || has.has(c) || (ch === '…' && key === 'poet'); });
  }
  // The script an original-language quote is written in (css/fonts.css sets each in its own Noto,
  // at its own size): the one most of its letters are in. Chinese characters with any kana are
  // Japanese; with any hangul, Korean. Latin text set in Noto (a letter the face lacks) is 'latn'.
  // The same function is in js/admin.js: change both.
  const QUOTE_SCRIPTS = [['kana', /[\u3040-\u30ff]/g], ['hang', /[\uac00-\ud7af\u1100-\u11ff]/g], ['hani', /[\u3400-\u9fff]/g],
    ['cyrl', /[\u0400-\u052f]/g], ['grek', /[\u0370-\u03ff\u1f00-\u1fff]/g], ['arab', /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/g],
    ['hebr', /[\u0590-\u05ff\ufb1d-\ufb4f]/g], ['thai', /[\u0e00-\u0e7f]/g], ['deva', /[\u0900-\u097f\ua8e0-\ua8ff]/g]];
  // Traditional or simplified Chinese, told apart by characters that exist in one form only
  // (說/说, 這/这, 們/们…); a tie goes by the author's country (Taiwan, Hong Kong, Macau:
  // traditional). Set in Noto TC or SC (css/fonts.css, .n-hant).
  const HANT_ONLY = /[說這們過時會來個為與學國對開關麼見現發經長點無還將當動從實後問進間頭東車門書話認樣電種總體歲氣讓應議處覺親邊雖萬誰聽廣際隊陽燈愛歡飛龍風馬鳥魚謂緣遠漸塊積塵習樂淚夢聲憶戀讀寫語衛華葉燒紅綠線給結終錯鐘難歷戰爭張紀記許該誤調請謝識變義藝劇嗎麗歐傳價優億盡屬歸斷雙舊雜響顏顯驗滿漢灣熱爾獨環畫盤確禮離筆節糧級細網練織臉興舉藥虛蘭術補視觀計訴詩詞試誠論證讚貝負財貨貴買費賣質輕載輪農運達遲選遺郵鄉醫釋鐵錢閉陳隨險雞靜韓頁順須預領題願類飯館驚齊齒]/g;
  const HANS_ONLY = /[说这们过时会来个为与学国对开关么见现发经长点无还将当动从实后问进间头东车门书话认样电种总体岁气让应议处觉亲边虽万谁听广际队阳灯爱欢飞龙风马鸟鱼谓缘远渐块积尘习乐泪梦声忆恋读写语卫华叶烧红绿线给结终错钟难历战争张纪记许该误调请谢识变义艺剧吗丽欧传价优亿尽属归断双旧杂响颜显验满汉湾热尔独环画盘确礼离笔节粮级细网练织脸兴举药虚兰术补视观计诉诗词试诚论证赞贝负财货贵买费卖质轻载轮农运达迟选遗邮乡医释铁钱闭陈随险鸡静韩页顺须预领题愿类饭馆惊齐齿]/g;
  const isHant = (text, country, otherwise) => {
    const t = (text.match(HANT_ONLY) || []).length, s = (text.match(HANS_ONLY) || []).length;
    return t !== s ? t > s : otherwise != null ? otherwise : ['TW', 'HK', 'MO'].includes(country);
  };
  // A typed run that does not tell (目送, a name) follows the quote it belongs to: every field
  // and the original together (set as the notes are drawn).
  let quoteHant = false;
  const quoteIsHant = (q) => isHant([q.originalLanguage && q.originalLanguage.text, q.author && q.author.name, q.author && q.author.nativeName,
    q.source && q.source.title, q.context, q.reflection, q.keptBy, ...(q.annotations || []).map((a) => a.explanation)].filter(Boolean).join(' '), q.author && q.author.country);
  function quoteScript(text, country) {
    const n = Object.fromEntries(QUOTE_SCRIPTS.map(([k, re]) => [k, (text.match(re) || []).length]));
    if (n.kana) return 'jpan';
    if (n.hang) return 'kore';
    const [best, count] = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
    if (best === 'hani' && count) return isHant(text, country) ? 'hant' : 'hans';
    return count ? best : 'latn';
  }
  const RTL_SCRIPTS = new Set(['arab', 'hebr']);
  const DEFAULT_FONT = 'instrument', LONG_FONT = 'goudy'; // a quote with no face of its own: Instrument, or Goudy when it is long
  const FONT_FILES = ['story', 'print', 'grotesk', 'poet', 'sketch', 'rose', 'author', 'fig', 'stone', 'rondeau']; // served by the fonts Worker; the rest come from Google

  // A shuffled copy (Fisher–Yates). The deck is dealt once per visit / per category, so ↑ and ↓
  // stay consistent within it, but the order is never the archive's numbering.
  const shuffle = (list) => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const $ = (id) => document.getElementById(id);
  const app = $('app'), deck = $('deck'), track = $('track'), notes = $('notes');
  const mqMobile = window.matchMedia('(max-width: 599px)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mqHoverDesktop = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 1024px)');
  const regionNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
  // Names the browser's list gets wrong for this site: Apple's says "China mainland".
  const REGION_FIX = { CN: 'China' };
  const regionName = (c) => REGION_FIX[c] || (regionNames ? regionNames.of(c) : c);

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
  // The face a quote is set in: its own if it has one that is drawn for its length.
  function fontOf(q, t) {
    const own = FONT_BY_KEY[q.font];
    if (own && !own.not.includes(t)) return own.key;
    return t === 's' || t === 'xs' ? LONG_FONT : DEFAULT_FONT;
  }

  // Rose holds back an r's swash by what follows it (the font's own rule: ss06, built in
  // workers/fonts/tools/convert.py). A copy of one letter or of a scrap — the typing, the
  // cut-up, the language sweep — has lost what follows it, and would show the swash until the
  // real quote takes over. So the rule is repeated here, and such an r is asked for by itself
  // in the font's plain shape: a y within four characters, an r within two, or a q next.
  const ROSE_TAIL = /[yYýÿÝŸ]/, ROSE_PLAIN = '"ss04" 1';
  function plainLetters(quoteEl, text) {
    const at = new Set();
    if (!quoteEl || quoteEl.dataset.font !== 'rose' || quoteEl.hasAttribute('data-native')) return at;
    for (let i = 0; i < text.length; i++) {
      if (text[i] !== 'r') continue;
      const next = text.slice(i + 1, i + 5);
      if (ROSE_TAIL.test(next) || /r/.test(next.slice(0, 2)) || /[qQ]/.test(next[0] || '')) at.add(i);
    }
    return at;
  }
  // Fill `el` with `text` (which starts at `start` in the quote's text), plain letters apart.
  function setFaceText(el, text, plain, start) {
    if (![...plain].some((i) => i >= start && i < start + text.length)) { el.textContent = text; return; }
    el.textContent = '';
    let run = '';
    const flush = () => { if (run) { el.appendChild(document.createTextNode(run)); run = ''; } };
    for (let k = 0; k < text.length; k++) {
      if (!plain.has(start + k)) { run += text[k]; continue; }
      flush();
      const one = document.createElement('span');
      one.style.fontFeatureSettings = ROSE_PLAIN;
      one.textContent = text[k];
      el.appendChild(one);
    }
    flush();
  }

  // `cjkWeight`: what a CJK character counts as — 4 for the English words and the form's limits
  // (it carries about as much as a short word); 2 when sizing the original language, where it
  // is about as wide as two letters (Bill, 2026-10-06: a short original is set bigger).
  function tier(text, cjkWeight = 4) {
    const cjk = (text.match(/[぀-ヿ㐀-鿿가-힯]/g) || []).length;
    const weight = text.length + cjk * (cjkWeight - 1);
    if (weight <= 64) return 'l';
    if (weight <= 160) return 'm';
    if (weight <= 260) return 's';
    return 'xs';
  }

  // Anything typed, in a script Crimson Pro does not have (it has Latin and Vietnamese only), is
  // set in that script's Noto, sized to sit with Crimson Pro, and upright (css .n-native, .n-script):
  // · Chinese/Japanese/Korean set inside running Latin text looks oversized at the same font size,
  //   so those runs get the smaller native-script style (same as the author's native name);
  // · the others (since 2026-10-05): Cyrillic and Greek in Noto Serif, Arabic, Hebrew, Thai and
  //   Devanagari in Noto Sans — at 0.78 of the text, where Noto's x-height (53.6% of the em, the
  //   same across its scripts) meets Crimson Pro's (42.0%). Arabic and Hebrew runs read right to
  //   left on their own (dir, css isolate); a paragraph whose first letter is Arabic or Hebrew
  //   reads right to left (rtlFirst → dir="rtl"), so a full stop lands where it belongs. (Not
  //   dir="auto": it looks past the letters inside the runs' isolates and finds none.)
  const CJK_RUN = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\uff00-\uffef\u3000-\u303f]+/g;
  const SCRIPTS = [ // [class, letters, right to left]
    ['cyrl', '\\u0400-\\u052f\\u1c80-\\u1c8f\\u2de0-\\u2dff\\ua640-\\ua69f'],
    ['grek', '\\u0370-\\u03ff\\u1f00-\\u1fff'],
    ['arab', '\\u0600-\\u06ff\\u0750-\\u077f\\u08a0-\\u08ff\\ufb50-\\ufdff\\ufe70-\\ufeff', true],
    ['hebr', '\\u0590-\\u05ff\\ufb1d-\\ufb4f', true],
    ['thai', '\\u0e00-\\u0e7f'],
    ['deva', '\\u0900-\\u097f\\ua8e0-\\ua8ff'],
  ].map(([cls, letters, rtl]) => [cls, rtl, new RegExp(`[${letters}]+(?:[ \\u00a0${rtl ? '\\u060c\\u061b\\u061f\\u05be\\u05f3\\u05f4"\'.,:;!?()«»\\-' : '\'\\-'}]+[${letters}]+)*${rtl ? '[.!?…\\u061f\\u06d4]*' : ''}`, 'g')]); // (a right-to-left sentence keeps its full stop)
  // In a right-to-left paragraph, a stretch of Latin (with its own full stop) is kept left to right.
  const LTR_RUN = /[A-Za-z0-9\u00c0-\u024f][^\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]*?(?=\s*(?:[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]|$))/g;
  const ltrRuns = (escapedHtml) => escapedHtml.replace(LTR_RUN, (run) => `<span class="n-ltr" dir="ltr">${run}</span>`);
  const rtlFirst = (text) => /^[^A-Za-z\u00c0-\u024f\u0370-\u052f\u0900-\u0e7f\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]*[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/.test(text);
  const nativeRuns = (escapedHtml) => SCRIPTS.reduce(
    (html, [cls, rtl, re]) => html.replace(re, (run) => `<span class="n-script n-${cls}"${rtl ? ' dir="rtl"' : ''}>${run}</span>`),
    escapedHtml.replace(CJK_RUN, (run) => `<span class="n-native${!/[\u3040-\u30ff\uac00-\ud7af]/.test(run) && isHant(run, null, quoteHant) ? ' n-hant' : ''}">${run}</span>`)); // (traditional Chinese in Noto Sans TC)

  function paragraphs(text) {
    return text.split(/\n\s*\n/).map((p) => p.replace(/[​\s]+$/g, '').trim()).filter(Boolean)
      .map((p) => { const rtl = rtlFirst(p), html = esc(noOrphans(p)); return `<p${rtl ? ' dir="rtl"' : ''}>${nativeRuns(rtl ? ltrRuns(html) : html).replace(/\n/g, '<br>')}</p>`; }).join(''); // (an Arabic or Hebrew paragraph reads right to left)
  }

  /* ---------- Video: a source link to YouTube, Vimeo, TikTok or Instagram ----------
     Such a link gets the video spot in notes: a thumbnail that opens the platform's own player.
     Nothing is stored. Each platform has a public lookup (oEmbed) the page asks when the quote
     comes up: it says whether the video is there, and — Vimeo, TikTok — gives a thumbnail.
     YouTube's thumbnail has a fixed address; Instagram gives none. With no thumbnail (or none
     that loads) the spot shows the platform's logo instead (Figma 421:1179). A link to any other
     site is not a video here: the source's title is underlined and links to it.
     Music (since 2026-10-05, Figma 430:2508 / 2543 / 2603): a link to Spotify or Apple Music gets
     the same spot, square — the cover, else the platform's logo — and opens the platform's own
     player in its dark look, as wide as a video's, untouched. Spotify's lookup is its oEmbed;
     Apple's is the iTunes lookup, asked in the link's own country. */
  // Where a shared link says to start, in seconds: YouTube's "start at" (?t=90, &t=1m30s,
  // &start=90) and Vimeo's (#t=1m30s). 0 when it says nothing.
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
      player: (v) => `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&playsinline=1&rel=0${startOf(v.link) ? `&start=${startOf(v.link)}` : ''}`, // the link's own starting time is kept
      thumb: (v) => `https://i.ytimg.com/vi/${v.id}/hq720.jpg`,
      vertical: (l) => /\/shorts\//.test(l),
    },
    vimeo: {
      match: (l) => (l.match(/vimeo\.com\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/)?(\d+)/) || [])[1],
      lookup: (l) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(l)}`,
      player: (v) => `https://player.vimeo.com/video/${v.id}?autoplay=1&playsinline=1${startOf(v.link) ? `#t=${startOf(v.link)}s` : ''}`,
    },
    tiktok: {
      match: (l) => (/tiktok\.com\//.test(l) ? ((l.match(/\/video\/(\d+)/) || [])[1] || 'short') : null), // a short link (vm.tiktok.com/…) has no id: the lookup gives it
      lookup: (l) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(l)}`,
      player: (v) => `https://www.tiktok.com/player/v1/${v.id}?autoplay=1&rel=0`,
      vertical: () => true,
    },
    instagram: {
      match: (l) => { const m = l.match(/instagram\.com\/(?:[^/]+\/)?(p|reels?|tv)\/([\w-]+)/); return m ? `${m[1] === 'reels' ? 'reel' : m[1]}/${m[2]}` : null; },
      lookup: (l) => `https://graph.facebook.com/v25.0/instagram_oembed?url=${encodeURIComponent(l)}`,
      player: (v) => `https://www.instagram.com/${v.id}/embed/`,
      vertical: () => true,
    },
    // Music: `music` marks them; `height` is the player's (the platforms' own sizes: one song is
    // the short banner, an album or playlist the tall one with its tracks); `bg` its dark grey,
    // the container's (and the morph's) colour, so the player's rounded corners melt into it.
    spotify: {
      music: true,
      match: (l) => { const m = l.match(/open\.spotify\.com\/(?:intl-[\w-]+\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/); return m ? `${m[1]}/${m[2]}` : null; },
      lookup: (l) => `https://open.spotify.com/oembed?url=${encodeURIComponent(l)}`,
      player: (v) => `https://open.spotify.com/embed/${v.id}?theme=0`,
      bg: '#1f1f1f',
      height: (v) => (/^(track|episode)\//.test(v.id) ? 152 : 352),
    },
    apple: {
      music: true,
      match: (l) => { const m = l.match(/music\.apple\.com\/[a-z]{2}\/(album|song|playlist)\/(?:[^/?#]+\/)?([\w.-]+)/); return m ? ((l.match(/[?&]i=(\d+)/) || [])[1] || m[2]) : null; }, // a song in an album: its own id (?i=)
      // (a playlist, pl.…, has no lookup: its player is simply offered, with the logo)
      lookup: (l, v) => (/^\d+$/.test(v.id) ? `https://itunes.apple.com/lookup?id=${v.id}&country=${l.match(/music\.apple\.com\/([a-z]{2})\//)[1]}` : null),
      read: (d) => (d.resultCount ? { thumb: (d.results[0].artworkUrl100 || '').replace(/100x100bb/, '400x400bb') || null } : null),
      player: (v) => { const u = new URL(v.link), i = u.searchParams.get('i'); return `https://embed.music.apple.com${u.pathname}?${i ? `i=${i}&` : ''}theme=dark`; },
      bg: '#1c1c1e',
      height: (v) => (/[?&]i=\d+/.test(v.link) || /\/song\//.test(v.link) ? 175 : 450),
    },
  };
  const videoLink = (q) => (q.source && q.source.link) || '';
  function videoOf(q) {
    const link = videoLink(q);
    for (const [platform, p] of Object.entries(VIDEO)) {
      const id = p.match(link);
      if (!id) continue;
      if (p.music) return { platform, id, link, orientation: 'music' };
      const vertical = (q.source && q.source.orientation === 'vertical') || !!(p.vertical && p.vertical(link));
      return { platform, id, link, orientation: vertical ? 'vertical' : 'horizontal' };
    }
    return null;
  }
  // What the platform says about a video, asked once per link: state 'ok' | 'broken' (the
  // platform answered: no such video) | 'offline' (no answer in VIDEO_WAIT_MS: blocked, or no
  // connection), and what the lookup added (a thumbnail, the id of a short link, its shape).
  const VIDEO_WAIT_MS = 4000;
  const videoInfo = new Map(); // link → { state, thumb, id, vertical, done: Promise }
  function lookupVideo(video) {
    if (!video) return null;
    if (videoInfo.has(video.link)) return videoInfo.get(video.link);
    const p = VIDEO[video.platform];
    const info = { state: 'pending', thumb: p.thumb ? p.thumb(video) : null };
    videoInfo.set(video.link, info);
    const url = p.lookup(video.link, video);
    if (!url) { info.state = 'ok'; info.done = Promise.resolve(info); return info; } // nothing to ask
    const stop = new AbortController(), timer = setTimeout(() => stop.abort(), VIDEO_WAIT_MS);
    info.done = fetch(url, { signal: stop.signal })
      .then((r) => { if (!r.ok) { info.state = 'broken'; return null; } return r.json(); })
      .then((d) => {
        if (!d) return;
        if (p.read) { d = p.read(d); if (!d) { info.state = 'broken'; return; } d = { thumbnail_url: d.thumb }; } // (Apple's answer, in oEmbed's words)
        info.state = 'ok';
        if (d.thumbnail_url && !info.thumb) info.thumb = d.thumbnail_url;
        if (d.embed_product_id) info.id = String(d.embed_product_id);
        if (Number(d.height) > Number(d.width)) info.vertical = true;
        if (info.thumb) { const warm = new Image(); warm.src = info.thumb; } // so the notes thumbnail never pops in
      })
      .catch(() => { info.state = 'offline'; })
      .then(() => { clearTimeout(timer); return info; });
    return info;
  }

  /* ---------- Quote rendering ---------- */

  // No orphans — for every piece of running text on the site (quotes, notes, context, menu
  // descriptions, annotation notes): the last line (and each line of a poem) never holds a single
  // word, a new sentence never starts with a single word left at the end of a line, and no line
  // ends on "a", "an", "the", "of", "from" or "is". Latin: the last two words are tied with a no-break space. CJK: the last four
  // characters are tied with word joiners. Applied at render time; the data stays clean.
  const NBSP = '\u00a0', WJ = '\u2060';
  const OPENERS = 'I|we|you|he|she|it|they|my|our|your|his|her|its|their|me|us|them';
  const OPENER = new RegExp(`([.!?…:;][”’)\\]]*\\s+[“‘(\\[]*(?:[^\\s\\u00a0]{1,2}|(?:${OPENERS})(?:[’'][a-z]+)?)) (?=\\S)`, 'gi');
  // "a", "an", "the", "of", "from" and "is" never end a line: each is tied to the word after it
  // (Bill, 2026-10-06). Run until nothing changes, so a run of them ("is the", "from a star")
  // is tied all the way through.
  const TIED_WORD = /(^|[\s“‘(\[—–])(a|an|the|of|from|is) (?=\S)/gi;
  const tieWords = (line) => { for (let was; was !== line;) { was = line; line = line.replace(TIED_WORD, `$1$2${NBSP}`); } return line; };
  function noOrphans(text) {
    return text.split('\n').map((line) => {
      const chars = [...line];
      const cjk = chars.filter((ch) => CJK_CHAR.test(ch)).length;
      if (cjk > chars.length / 2) {
        if (chars.length < 8) return line;
        return chars.slice(0, -4).join('') + chars.slice(-4).join(WJ);
      }
      if (line.trim().split(/\s+/).length < 4) return tieWords(line);
      const words = tieWords(line).trimEnd().split(' ');
      const last = words.pop();
      const tied = `${words.join(' ')}${NBSP}${last}`;
      // …and no sentence may leave its opener stranded at the end of a line when the opener is
      // one or two letters, or a pronoun (OPENERS, with or without ’re ’ve ’ll…):
      // "stop. They / keep going." → the opener is tied to the word after it and both go to the
      // next line. Other openers ("The", "When") are left alone: tying every one left lines
      // short whenever the pair didn't fit.
      return tied.replace(OPENER, `$1${NBSP}`);
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
    const shown = quoteEl.textContent;
    const text = quoteEl._plain != null ? quoteEl._plain : shown; // as rendered, before evenLines wrote its breaks in (same length)
    let out = shown;
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

  // A short quote is meant to sit on one or two lines. Where it takes more — a wide face, a
  // narrow window — it is set in the medium size instead (and takes the medium quote's box).
  // Measured on the rendered quote, so it follows the face, the window and the language.
  const SHORT_MAX_LINES = 2;
  function lineCount(quoteEl) {
    let lines = 0, last = null;
    measureWords(quoteEl).forEach((w) => { if (last === null || Math.abs(w.top - last) > 4) { lines++; last = w.top; } });
    return lines;
  }
  function fitTier(quoteEl) {
    if (!quoteEl) return;
    evenLines.reset(quoteEl); // measured as plain text in the full box
    if (quoteEl.hasAttribute('data-short')) {
      quoteEl.dataset.tier = 'l';
      if (lineCount(quoteEl) > SHORT_MAX_LINES) quoteEl.dataset.tier = 'm';
    }
    evenLines(quoteEl);
  }
  const fitDeck = () => { flushLanding(); track.querySelectorAll('.quote').forEach(fitTier); };
  // After a change the page is free again before the new quote's slowest words have quite
  // finished fading in (HOME_FADE_DONE); they finish in peace. Whatever needs the quote as
  // plain text meanwhile — the next change, notes, the language, a new measuring — ends them
  // first (the words are simply there).
  let landing = null; // { finish, timer }
  // The quote in `wrap` fades in word by word, the way a new quote lands after a change
  // (random lengths, HOME_FADE_MIN_MS…HOME_FADE_MAX_MS, by colour) but with nothing scattered.
  // Returns how long until the words read as arrived (HOME_FADE_DONE), 0 if it cannot be done.
  function wordsIn(wrap) {
    flushLanding();
    const quoteEl = wrap.querySelector('.quote'), node = quoteEl && quoteEl.firstChild;
    if (!node || node.nodeType !== 3 || quoteEl.childNodes.length !== 1) return 0;
    const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease').trim() || 'ease';
    const ink = getComputedStyle(quoteEl).color, range = document.createRange(), spans = [];
    const unwrap = () => { spans.forEach((sp) => { if (sp.parentNode) sp.replaceWith(...sp.childNodes); }); quoteEl.normalize(); };
    try {
      cutScraps(measureWords(quoteEl)).reverse().forEach((sc) => { // one or two words at a time, last first: earlier offsets stay valid
        range.setStart(sc.node, sc.start); range.setEnd(sc.endNode, sc.end);
        const span = document.createElement('span');
        span.className = 'q-word';
        span.style.color = 'transparent';
        range.surroundContents(span);
        spans.push(span);
      });
    } catch (e) { unwrap(); return 0; }
    let slowest = 0;
    spans.forEach((span) => {
      const ms = Math.round(HOME_FADE_MIN_MS + (HOME_FADE_MAX_MS - HOME_FADE_MIN_MS) * Math.random());
      slowest = Math.max(slowest, ms);
      span.animate([{ color: 'transparent' }, { color: ink }], { duration: ms, easing, fill: 'forwards' });
    });
    drawWhole(quoteEl, slowest + 30);
    landing = { finish: () => { quoteEl.getAnimations().forEach((a) => a.cancel()); unwrap(); }, timer: setTimeout(flushLanding, slowest + 30) };
    return Math.round(easeTimeFor(HOME_FADE_DONE, easing) * slowest);
  }
  // While single words of the quote fade in by colour, iOS Safari redraws only each word's own
  // box — and in a script face a letter's tail reaches well into the line below (or above): when
  // a word there is redrawn, the tail inside its box is wiped and not put back until the line
  // it belongs to is next drawn. It showed as the descenders of a line flickering (Poet,
  // Author; Bill's recordings, 2026-10-04). Two measures: each wrapped word's box takes in the
  // room its ink may reach (css .q-word), so a redraw of one word redraws its neighbours on the
  // lines above and below too; and for as long as words are fading, the quote's own colour
  // moves by a hair, which has the whole block redrawn every frame.
  function drawWhole(quoteEl, ms) {
    const ink = getComputedStyle(quoteEl).color, rgb = (ink.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).join(', ');
    quoteEl.animate([{ color: `rgba(${rgb}, 1)` }, { color: `rgba(${rgb}, 0.97)` }], { duration: 120, iterations: Math.ceil(ms / 120), direction: 'alternate' });
  }
  function flushLanding() {
    if (!landing) return;
    const l = landing;
    landing = null;
    clearTimeout(l.timer);
    l.finish();
  }

  // A good rag, at every width — a soft unevenness, no line much longer or shorter than the
  // others. A column filled line by line as far as each goes leaves lines of very different
  // lengths (a long word dropping to the next line, the tied last words under a short one).
  // So the breaks are chosen for the whole quote at once: the same number of lines
  // as the plain filling takes, never more, and among all the ways to break it into that
  // many, the one whose lines fall least short of the box (the squares of what each line
  // leaves are summed, so one very short line costs more than several slightly short ones).
  // noOrphans' ties and the quote's own line breaks are kept. The chosen breaks are written
  // into the text as newlines (the quote is `white-space: pre-line`); the text as it was is
  // kept on the element (`_plain`) and put back before every new measuring.
  evenLines.reset = (quoteEl) => {
    quoteEl.style.width = '';
    if (quoteEl._plain != null && quoteEl.firstChild && quoteEl.childNodes.length === 1) quoteEl.firstChild.data = quoteEl._plain;
    quoteEl._plain = null;
  };
  const RAG_LAST = 0.5;      // how much the last line's shortfall counts (0 = it may be any length, 1 = like the others)
  const RAG_LAST_MIN = 0.33; // …but a last line under this share of the box counts in full
  function evenLines(quoteEl) {
    if (!quoteEl) return;
    quoteEl.style.width = '';
    const node = quoteEl.firstChild;
    const single = node && node.nodeType === 3 && quoteEl.childNodes.length === 1;
    if (single && quoteEl._plain != null) node.data = quoteEl._plain;
    quoteEl._plain = null;
    const words = measureWords(quoteEl);
    if (words.some((w) => w.cjk)) return; // Chinese, Japanese, Korean: every character is as wide as the next, the lines are even as they fall
    if (!single) return narrowBox(quoteEl); // annotations inside: the simpler rule
    const lines = new Set(words.map((w) => Math.round(w.top))).size;
    if (lines < 2) return;
    const text = node.data, box = quoteEl.getBoundingClientRect().width - 1;
    // What sits before each word: a space (a break may go there), a newline (a break is
    // there), or anything else — a no-break space, nothing at all — which ties it to the word before.
    const before = words.map((w, k) => (k ? text.slice(words[k - 1].end, w.start) : '\n'));
    const gapAt = words.findIndex((w, k) => k && before[k] === ' ' && Math.abs(w.top - words[k - 1].top) < 4);
    const space = gapAt > 0 ? Math.max(words[gapAt].left - words[gapAt - 1].right, words[gapAt - 1].left - words[gapAt].right) : parseFloat(getComputedStyle(quoteEl).fontSize) * 0.25; // (right to left, the word before is to the right)
    const width = words.map((w) => w.right - w.left);
    const breaks = []; // indices of the words that start a new line
    let from = 0;
    for (let k = 1; k <= words.length; k++) {
      if (k < words.length && !before[k].includes('\n')) continue;
      const cut = ragBreaks(width.slice(from, k), before.slice(from, k).map((b, i) => i > 0 && b === ' '), space, box);
      if (!cut) return narrowBox(quoteEl);
      cut.forEach((c) => breaks.push(from + c));
      from = k;
    }
    if (!breaks.length) return;
    const chars = [...text];
    if (chars.length !== text.length) return; // astral characters: offsets would not line up
    breaks.forEach((k) => { chars[words[k].start - 1] = '\n'; });
    const paragraphs = before.filter((b) => b.includes('\n')).length;
    node.data = chars.join('');
    quoteEl._plain = text;
    // The browser must agree line for line; if a line it was given does not fit after all, back to plain.
    if (lineCount(quoteEl) !== paragraphs + breaks.length) { node.data = text; quoteEl._plain = null; narrowBox(quoteEl); }
  }
  // (evenLines and ragBreaks are copied in js/admin.js for the library's preview: change both.)
  // One paragraph: `width` of each word, `open[i]` whether a line may start at word i. Returns
  // the words that start lines 2…n for the fewest lines that fit and the least raggedness, or
  // null when a word group is wider than the box (left to the browser).
  function ragBreaks(width, open, space, box) {
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
          const cost = prev[i] + (last ? (w < box * RAG_LAST_MIN ? short * short : RAG_LAST * short * short) : short * short);
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
  // The simpler rule, where the text cannot be rewritten (annotations inside) or a word group is
  // wider than the box (a script written without spaces, such as Thai): the box is
  // narrowed to the least width at which the quote takes the same number of lines.
  const EVEN_STEPS = 8; // halvings: finds the width to within 1/256 of the box
  function narrowBox(quoteEl) {
    quoteEl.style.width = '';
    const full = quoteEl.getBoundingClientRect().width, lines = lineCount(quoteEl);
    if (lines < 2 || !full) return;
    let lo = full / 2, hi = full; // at `hi` it fits in `lines`
    for (let i = 0; i < EVEN_STEPS; i++) {
      const mid = (lo + hi) / 2;
      quoteEl.style.width = `${mid}px`;
      if (lineCount(quoteEl) === lines) hi = mid; else lo = mid;
    }
    quoteEl.style.width = `${Math.ceil(hi)}px`;
    if (lineCount(quoteEl) !== lines) quoteEl.style.width = ''; // never at the cost of a line
  }
  // The size the main screen shows this quote in (the notes quote takes the same): tried on a
  // hidden copy in the main quote's place.
  function fittedTier(q, original) {
    const wrap = currentWrap();
    if (!wrap) return null;
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;left:0;top:0;width:100%;visibility:hidden;pointer-events:none';
    probe.innerHTML = quoteHTML(q, { original });
    wrap.appendChild(probe);
    const el = probe.querySelector('.quote');
    fitTier(el);
    const t = el.dataset.tier;
    probe.remove();
    return t;
  }

  function quoteHTML(q, { original = false, withAnnotations = false, keepLines = false, tierAs = null } = {}) {
    const orig = q.originalLanguage;
    const showOrig = original && orig;
    const size = showOrig ? tier(orig.text, 2) : tier(q.text);
    const font = fontOf(q, tier(q.text)); // the face goes by the English words' length, in either language
    // Poet has no ellipsis: three periods instead.
    const shown = showOrig ? orig.text : q.text;
    const inFace = !showOrig || nativeInFace(orig.text, font); // the original in the quote's own face, or in Noto
    const raw = inFace && font === 'poet' ? shown.replace(/…/g, '...') : shown;
    let text = noOrphans(raw);
    const locked = keepLines && lockedLines && lockedLines.text === text;
    if (locked) text = lockedLines.broken;
    const body = withAnnotations && !showOrig && q.annotations && q.annotations.length
      ? annotate(text, q.annotations) : esc(text);
    const langBtn = orig
      ? (() => { const b = langButtonInner(showOrig ? 'en' : orig.lang); return `<button class="lang" data-lang style="${b.style}" aria-pressed="${showOrig ? 'true' : 'false'}" aria-label="${showOrig ? 'Show English' : 'Show original language'}">${b.html}</button>`; })()
      : '';
    const script = showOrig && !inFace ? quoteScript(orig.text, q.author && q.author.country) : '';
    const nativeAttr = showOrig ? `${inFace ? '' : ` data-native data-script="${script}"`}${RTL_SCRIPTS.has(script) ? ' dir="rtl"' : ''} lang="${esc(orig.lang)}"` : ''; // data-native = set in Noto, in its script's (css/fonts.css); Arabic and Hebrew read right to left
    return `${langBtn}<blockquote class="quote${locked ? ' quote--locked' : ''}" data-tier="${tierAs || size}"${size === 'l' ? ' data-short' : ''} data-font="${font}"${nativeAttr}>${body}</blockquote>`;
  }

  /* ---------- Deck ---------- */

  // "No. 8": on a change the number rolls like the form's pager. The box shows one line; the old
  // number slides out of it and the next slides in, upward going forward, downward going back.
  const NUMBER_MS = 300;
  let numberDir = 0, numberShown = null, numberTimer = 0;
  function setNumber(id) {
    const el = $('number'), dir = numberDir, old = numberShown;
    numberDir = 0;
    numberShown = id;
    clearTimeout(numberTimer);
    const still = () => { el.innerHTML = `No. <span class="num"><span class="num-roll"><span>${id}</span></span></span>`; };
    if (!dir || old === null || old === id || reduceMotion.matches) return still();
    const lines = dir > 0 ? [old, id] : [id, old];
    el.innerHTML = `No. <span class="num"><span class="num-roll">${lines.map((n) => `<span${n === id ? '' : ' aria-hidden="true"'}>${n}</span>`).join('')}</span></span>`;
    const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease').trim() || 'ease';
    const up = 'translateY(-50%)', rest = 'translateY(0)'; // half the roll = one line
    el.querySelector('.num-roll').animate([{ transform: dir > 0 ? rest : up }, { transform: dir > 0 ? up : rest }], { duration: NUMBER_MS, easing, fill: 'forwards' });
    numberTimer = setTimeout(still, NUMBER_MS + 30); // a timer, not onfinish: animations stall in hidden tabs
  }

  function renderDeck() {
    track.style.transition = 'none';
    track.style.transform = '';
    track.innerHTML = [-1, 0, 1].map((pos) =>
      `<div class="slide" data-pos="${pos}"${pos ? ' aria-hidden="true"' : ''}><div class="q-wrap">${
        quoteHTML(at(pos), { original: pos === 0 && state.original })}</div></div>`).join('');
    fitDeck();
    const q = current();
    setNumber(q.id);
    const video = videoOf(q);
    if (video) { const info = lookupVideo(video); if (info.thumb) { const warm = new Image(); warm.src = info.thumb; } } // asked now, so the notes know what to show (and the thumbnail never pops in)
    else if (q.source && q.source.kind === 'book' && q.source.cover) { const warm = new Image(); warm.src = q.source.cover; } // a book's cover, likewise
    try { sessionStorage.setItem('wwk-quote', q.id); } catch (e) {} // a reload stays on this quote; the address stays clean (no #id)
  }

  const advance = (dir) => {
    state.idx = mod(state.idx + dir, state.list.length);
    state.original = false;
    numberDir = dir;
    renderDeck();
  };
  const currentWrap = () => track.querySelector('.slide[data-pos="0"] .q-wrap');

  /* The cut-up as a sequence of beats that can be stepped one at a time (the finger does that on
     a touch screen) or played at the normal pace (`play`). Beats 0..GROUPS-1: the leaving quote's
     groups jump out. Beat GROUPS: the swap — the words become the next quote, still scattered.
     Beats GROUPS+1..2*GROUPS: the new quote's groups jump home. Before the swap a beat can be
     undone (`back`); the swap is one-way. */
  const beats = () => 2 * GROUPS + 1; // (GROUPS is declared further down, with the cut-up)
  let cut = null; // the cut-up in progress
  function startCut(dir) {
    flushLanding();
    const c = { dir, n: 0, leaving: buildScraps(currentWrap(), false), arriving: null, playing: false, ended: false };
    currentWrap().style.visibility = 'hidden';
    state.animating = true;
    cut = c;
    const end = () => {
      if (c.ended) return;
      c.ended = true;
      // Hand over from the scraps to the real quote with a dissolve, not a swap: the scraps sit
      // on their words to a fraction of a pixel, but Safari snaps the two to whole pixels
      // differently, and a swap showed as a slight jump at the end of every change.
      currentWrap().style.visibility = '';
      (c.arriving || c.leaving).dissolve();
      state.animating = false;
      if (cut === c) cut = null;
      if (c.onLanded) { const back = c.onLanded; c.onLanded = null; back(); } // (a change undone before the swap: the arrow comes back all the same)
    };
    c.forward = () => {
      if (c.ended || c.n >= beats()) return;
      const b = c.n++;
      if (b < GROUPS) c.leaving.pose(b, true);                                   // out
      else if (b === GROUPS) {                                                   // swap
        advance(dir);
        c.arriving = buildScraps(currentWrap(), true);
        if (!c.arriving.real) currentWrap().style.visibility = 'hidden'; // (real: the quote itself is there, its words unseen until they land)
        c.leaving.dissolve();
      } else c.arriving.pose(b - GROUPS - 1, false, true);                       // home: the new quote's words fade into place
      if (c.n === beats() && c.onLanded) { const back = c.onLanded; c.onLanded = null; back(); } // the last words are landing: the pressed arrow comes back in
      if (c.n === beats()) setTimeout(end, c.arriving.homeMax + 60); // once the slowest word reads as arrived (HOME_FADE_DONE); slack: Safari runs the last fade a frame or two late
    };
    c.back = () => {
      if (c.n === 0 || c.n > GROUPS) return; // nothing to undo, or past the swap
      c.leaving.pose(--c.n, false);
      if (c.n === 0) setTimeout(() => { if (c.n === 0) end(); }, SCRAP_FADE_MS + 60); // all home again (and still so): no change after all
    };
    c.rewind = () => { // before the swap: the groups that are out jump home at the normal pace
      if (c.playing || c.ended || c.n > GROUPS) return;
      c.playing = true;
      const tick = () => { if (c.n === 0) return; const b = c.n; c.back(); setTimeout(tick, beatAt(b) - beatAt(b - 1)); };
      tick();
    };
    c.play = () => { // the rest of the beats at the normal pace
      if (c.playing || c.ended) return;
      c.playing = true;
      const tick = () => { if (c.n >= beats()) return; const b = c.n; c.forward(); setTimeout(tick, beatAt(b + 1) - beatAt(b)); };
      tick();
    };
    return c;
  }

  function go(dir) {
    if (cut) return cut.play(); // a change left mid-way by the finger completes first
    if (state.animating || modeBusy || langBusy || state.mode !== 'main' || state.list.length < 2) return;
    if (reduceMotion.matches) return advance(dir);
    startCut(dir).play();
  }

  // Wheel: exactly one step per gesture. A trackpad swipe is not one event but a stream that
  // keeps coming (inertia) for a second or more, fading unevenly. So:
  //  · a pause of WHEEL_GAP_MS ends the gesture — the next event may step again;
  //  · inside an unbroken stream, step again only for a clear new push: well after the last
  //    step, several times stronger than the weakest event since then (jitter never is) AND
  //    several times stronger than the stream was a moment ago (WHEEL_RECENT_MS). The second
  //    test is what tells a push from one long swipe that starts gently and speeds up: that
  //    one rises little by little, a push jumps. (It used to step twice on such a swipe.)
  const WHEEL_GAP_MS = 180, WHEEL_MIN = 12, WHEEL_COOLDOWN_MS = 500, WHEEL_PUSH_RATIO = 3, WHEEL_PUSH_MIN = 60, WHEEL_RECENT_MS = 120;
  const wheel = { lastAt: 0, steppedAt: -Infinity, floor: Infinity, recent: [] };
  deck.addEventListener('wheel', (e) => {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1; // lines / pages → px (a mouse wheel in Firefox can report lines: 3 a notch)
    const now = performance.now(), abs = Math.abs(e.deltaY * unit);
    const newGesture = now - wheel.lastAt > WHEEL_GAP_MS;
    wheel.lastAt = now;
    if (newGesture) { wheel.floor = Infinity; wheel.recent = []; }
    wheel.recent = wheel.recent.filter((r) => now - r.at <= WHEEL_RECENT_MS);
    const lately = wheel.recent.length ? wheel.recent.reduce((sum, r) => sum + r.abs, 0) / wheel.recent.length : Infinity;
    wheel.recent.push({ at: now, abs });

    const stepped = wheel.steppedAt > -Infinity && !newGesture; // already stepped during this stream
    const freshPush = stepped
      && now - wheel.steppedAt > WHEEL_COOLDOWN_MS
      && abs > Math.max(WHEEL_PUSH_MIN, wheel.floor * WHEEL_PUSH_RATIO, lately * WHEEL_PUSH_RATIO);
    wheel.floor = Math.min(wheel.floor, abs);

    if ((state.animating && !cut) || abs < WHEEL_MIN || (stepped && !freshPush)) return;
    wheel.steppedAt = now;
    wheel.floor = abs;
    go(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  /* ---------- Touch: the cut-up follows the finger ----------
     On a touch screen the change is not played but scrubbed: every SCRUB_TRAVEL / 7 beats of the
     screen height the finger travels fires the next beat (out, out, out, swap, home, home, home).
     Lift the finger and it settles: past the swap (or on a flick) the rest plays out at the normal
     pace; before it, the groups jump back home and nothing changes. Before the swap a drag back
     undoes beats; the swap is one-way. (Reduced motion: a swipe just changes the quote.) */
  const SCRUB_TRAVEL = 0.5;   // screen heights of travel for the whole change
  const FLICK_MIN_PX = 24, FLICK_VELOCITY = 0.5; // px, px/ms
  let touch = null;
  deck.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || e.target.closest('button') || state.mode !== 'main' || modeBusy || langBusy || state.list.length < 2) return;
    if (state.animating) return; // a change is playing out (a lifted cut always settles)
    touch = { y: e.touches[0].clientY, t: performance.now(), dy: 0, dir: 0, n0: 0, lastY: e.touches[0].clientY, lastT: performance.now(), v: 0 };
    lastBeat = 0;
  }, { passive: true });
  deck.addEventListener('touchmove', (e) => {
    if (!touch) return;
    const y = e.touches[0].clientY, now = performance.now();
    touch.v = (y - touch.lastY) / Math.max(1, now - touch.lastT); // latest velocity, for the flick
    touch.lastY = y; touch.lastT = now;
    touch.dy = y - touch.y;
    if (reduceMotion.matches) return;
    if (!touch.dir) { if (Math.abs(touch.dy) < 8) return; touch.dir = touch.dy < 0 ? 1 : -1; }
    const travel = -touch.dy * touch.dir; // in the direction of the change
    const beatPx = deck.clientHeight * SCRUB_TRAVEL / beats();
    const target = Math.max(0, Math.min(beats(), touch.n0 + Math.trunc(travel / beatPx))); // trunc: a beat back takes a full beat of travel too
    if (touch.done) return; // one drag, one change: past the last beat the finger is ignored until it lifts
    if (!cut && target > 0) startCut(touch.dir);
    if (!cut || cut.playing) return;
    touch.target = target;
    pace();
  }, { passive: true });
  // The finger says how far the change has got (touch.target); the beats follow it one at a
  // time and never closer together than they are when the change plays by itself (a wheel, a
  // key, an arrow: CUT_MS for the seven). A slow drag still scrubs beat by beat, as slowly as
  // the finger goes; a quick swipe no longer runs the whole change through in a few frames.
  let paceTimer = 0, lastBeat = 0;
  const beatGap = (n) => (n > 0 ? beatAt(n) - beatAt(n - 1) : 0); // from the beat before to beat n, at the normal pace
  function pace() {
    clearTimeout(paceTimer);
    if (!touch || !cut || cut.playing || cut.ended) return;
    const fwd = cut.n < touch.target, back = cut.n > touch.target && cut.n <= GROUPS;
    if (!fwd && !back) return;
    const now = performance.now(), wait = lastBeat + beatGap(cut.n) - now;
    if (wait > 0) { paceTimer = setTimeout(pace, wait); return; }
    if (fwd) cut.forward(); else cut.back();
    lastBeat = now;
    if (cut.n >= beats()) { touch.done = true; return; }
    pace(); // still behind the finger: the next beat in its turn
  }
  const endTouch = () => {
    if (!touch) return;
    const { dy, v, done, target = 0 } = touch;
    touch = null;
    clearTimeout(paceTimer);
    if (done) return; // this drag already made its change
    const flick = Math.abs(dy) > FLICK_MIN_PX && Math.abs(v) > FLICK_VELOCITY;
    if (reduceMotion.matches) { if (flick || Math.abs(dy) > deck.clientHeight * 0.12) go(dy < 0 ? 1 : -1); return; }
    if (!cut) { if (flick) go(dy < 0 ? 1 : -1); return; }
    if (cut.playing) return;
    // Lifted: it settles. A flick in the change's direction, or being past the swap, completes it;
    // otherwise the groups jump back home and nothing changes.
    // (The finger may be ahead of the beats: where it had got to counts, and what is left plays
    // on from the last beat at the normal pace, not on top of it.)
    const c = cut, settle = (flick && (dy < 0 ? 1 : -1) === c.dir) || Math.max(c.n, target) > GROUPS ? c.play : c.rewind;
    setTimeout(() => { if (cut === c) settle(); }, Math.max(0, lastBeat + beatGap(c.n) - performance.now()));
  };
  deck.addEventListener('touchend', endTouch);
  deck.addEventListener('touchcancel', endTouch);

  // A pressed arrow rolls like the number of "No. 8", in two halves that keep time with the
  // quote: it leaves its box (.arrow-crop) the way it points as the change starts, the box
  // stays empty while the words are out, and the same arrow comes in from the other side with
  // the last jump, as the last of the new quote's words start to land (CUT_MS after the press).
  // (Waiting until the words were 80% in, about a second, felt too slow.)
  // (`translate`, not `transform`: the lower arrow is the upper one turned by a transform.)
  const ARROW_ROLL_MS = 300; // each half
  function press(btn, dir) {
    const before = cut;
    go(dir);
    if (!cut || cut === before) return; // no change began (busy, one quote only, reduced motion)
    const icon = btn.querySelector('.arrow-crop .icon');
    const timing = { duration: ARROW_ROLL_MS, easing: getComputedStyle(document.documentElement).getPropertyValue('--ease').trim() || 'ease', fill: 'both' };
    icon.getAnimations().forEach((a) => a.cancel());
    icon.animate([{ translate: '0 0' }, { translate: `0 ${dir * 100}%` }], timing);
    cut.onLanded = () => {
      icon.getAnimations().forEach((a) => a.cancel());
      icon.animate([{ translate: `0 ${dir * -100}%` }, { translate: '0 0' }], timing);
      setTimeout(() => icon.getAnimations().forEach((a) => { if (a.playState === 'finished') a.cancel(); }), ARROW_ROLL_MS + 30);
    };
  }
  $('prevBtn').addEventListener('click', (e) => press(e.currentTarget, -1));
  $('nextBtn').addEventListener('click', (e) => press(e.currentTarget, 1));

  // A mouse click leaves focus on the button, so the next arrow-key press would draw a focus
  // ring around it. Drop focus after pointer clicks; Tab navigation keeps its (quiet) ring.
  document.addEventListener('pointerup', () => {
    const el = document.activeElement;
    if (el && el !== document.body && el.matches('button, a')) el.blur();
  });

  /* ---------- Notes mode ---------- */

  // The video spot: the video's own thumbnail when there is one, else the platform's logo on
  // black (a square-ish card, a smaller play mark in the palette's colour; YouTube's logo is a
  // play mark already and gets none). A thumbnail that fails to load turns into the logo card.
  const playLabel = (video) => (VIDEO[video.platform].music ? 'Play music' : 'Play video');
  const logoThumbHTML = (video) => `<button class="thumb thumb--logo" data-video data-platform="${video.platform}" aria-label="${playLabel(video)}">
      <img class="thumb-logo" src="assets/icons/${VIDEO[video.platform].music ? 'music' : 'video'}-${video.platform}.svg" alt="">
      ${video.platform === 'youtube' ? '' : '<span class="thumb-play thumb-play--sm"><span class="icon"></span></span>'}
    </button>`;
  function thumbHTML(video) {
    const info = lookupVideo(video);
    if (!info.thumb || info.state === 'offline' || info.state === 'broken') return logoThumbHTML(video);
    const second = video.platform === 'youtube' ? ` data-second="https://i.ytimg.com/vi/${video.id}/mqdefault.jpg"` : '';
    return `<button class="thumb" data-video data-platform="${video.platform}" data-orientation="${video.orientation}" aria-label="${playLabel(video)}">
      <img src="${esc(info.thumb)}"${second} alt="" decoding="sync">
      <span class="thumb-play"><img src="assets/icons/play.svg" alt=""></span>
    </button>`;
  }
  // A book's cover (since 2026-10-05; picked in the library, source.cover): in the video spot, as
  // wide as a thumbnail at its own height — a picture only, not a button (the source's title
  // carries any link). A cover that fails to load simply goes.
  function coverHTML(q) {
    const src = q.source || {};
    if (src.kind !== 'book' || !src.cover) return '';
    return `<span class="thumb thumb--cover"><img src="${esc(src.cover)}" alt="${src.title ? `Cover of ${esc(src.title)}` : 'Book cover'}" decoding="sync"></span>`;
  }
  // (error does not bubble: caught on the way down.) A YouTube thumbnail has a smaller second
  // address to try; after that, or for any other, the logo card takes the thumbnail's place.
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.parentNode || !img.parentNode.matches || !img.parentNode.matches('.thumb:not(.thumb--logo)')) return;
    if (img.parentNode.matches('.thumb--cover')) { img.parentNode.remove(); return; } // a book's cover: none, then
    if (img.dataset.second) { img.src = img.dataset.second; delete img.dataset.second; return; }
    const video = videoOf(current());
    if (video) img.parentNode.outerHTML = logoThumbHTML(video);
  }, true);

  const lastTheme = new Map(); // quote id → the palette notes last opened with
  function renderNotes() {
    const q = current();
    quoteHant = quoteIsHant(q);
    const cats = q.categories.length ? q.categories : ['perspective'];
    // The palette is one of the quote's categories, drawn at random each time notes open, and
    // never the same as the previous time for this quote — so a second look gets another colour.
    const pool = cats.length > 1 ? cats.filter((k) => k !== lastTheme.get(q.id)) : cats;
    const theme = pool[Math.floor(Math.random() * pool.length)];
    lastTheme.set(q.id, theme);
    // The notes layer and its Close link carry the palette themselves, so the layer can be
    // revealed over the still-grey page.
    app.dataset.theme = notes.dataset.theme = $('notesBtn').dataset.theme = theme;

    $('nCats').innerHTML = cats.map((k) =>
      `<li><svg class="sym" viewBox="0 0 60 60" data-sym="${k}" aria-hidden="true"></svg><span>${esc(CAT_BY_KEY[k].name)}</span></li>`).join('');
    noteSyms();

    const a = q.author;
    const country = a.country ? regionName(a.country) : '';
    // Row 1 author · its native name under it · the country · the source ("Title, Year"). The
    // native name always has its own row (Bill, 2026-10-06), so it sits in the same place at every
    // width and an Arabic or Hebrew one never shares a line with the English; each row wraps like
    // the source's when a name is too long for it. The native name goes through nativeRuns like
    // anything typed: its script's Noto, Arabic and Hebrew right to left (until 2026-10-06 it was
    // always the CJK sans, beside the English, on one line that never wrapped).
    let from = `<span class="n-source">${nativeRuns(esc(a.name))}</span>`;
    if (a.nativeName) from += `<span class="n-source n-native-name">${nativeRuns(esc(a.nativeName))}</span>`;
    if (country) from += `<span class="n-row">${esc(country)}</span>`;
    const src = q.source || {}, link = videoLink(q);
    if (src.title) {
      let label = ITALIC_KINDS.has(src.kind) ? `<i>${nativeRuns(esc(src.title))}</i>` : nativeRuns(esc(src.title)); // (Noto upright inside the italics: css .n-native)
      if (src.year) label += `, ${esc(src.year)}`;
      const linked = link && !videoOf(q); // a video plays in the video spot; any other link is the title's
      from += `<span class="n-source">${linked ? `<span role="link" tabindex="0" data-href="${esc(link)}" data-out>${label}</span>` : label}</span>`; // (a block: its own row)
    } else if (link && !videoOf(q)) {
      // A link with no name to show (and not a video, which has the video spot): the row reads
      // "Source link", with the year when there is one, underlined like a titled link.
      from += `<span class="n-source"><span role="link" tabindex="0" data-href="${esc(link)}" data-out>Source link${src.year ? `, ${esc(src.year)}` : ''}</span></span>`;
    } else if (src.year) {
      from += `<span class="n-source">${esc(src.year)}</span>`; // no name, no link of its own: the year alone
    }
    $('nFrom').innerHTML = from;

    renderNotesQuote();

    const video = videoOf(q);
    $('nVideoPin').innerHTML = $('nVideoCol').innerHTML = video ? thumbHTML(video) : coverHTML(q);

    $('nKept').innerHTML = q.keptBy ? nativeRuns(esc(q.keptBy)) : 'a fellow human';
    // The context first, then the personal note (the other way round until 2026-10-04).
    let body = q.context ? `<div class="n-context"><p>/Context/</p><div>${paragraphs(q.context)}</div></div>` : '';
    // With a context above it the personal note gets a title of its own, "/Note/" (set like
    // "/Context/"), so it still reads as the keeper's; alone under "Kept by" it needs none.
    if (q.reflection) body += q.context ? `<div class="n-context"><p>/Note/</p><div>${paragraphs(q.reflection)}</div></div>` : `<div>${paragraphs(q.reflection)}</div>`;
    $('nBody').innerHTML = body;
  }

  function renderNotesQuote() {
    const wrap = $('nQuoteWrap');
    const tierAs = fittedTier(current(), state.original);
    wrap.innerHTML = quoteHTML(current(), { original: state.original, withAnnotations: true, keepLines: true, tierAs });
    evenLines(wrap.querySelector('.quote:not(.quote--locked)')); // phone: an even rag (a locked quote already has the main quote's lines)
    // Belt and braces: if a locked line does not fit here after all (it would wrap into an
    // orphan), let the quote wrap naturally rather than show a broken line.
    const locked = wrap.querySelector('.quote--locked');
    if (locked) {
      const wanted = locked.textContent.split('\n').length;
      const got = new Set(measureWords(locked).map((w) => Math.round(w.top))).size;
      if (got !== wanted) { wrap.innerHTML = quoteHTML(current(), { original: state.original, withAnnotations: true, tierAs }); evenLines(wrap.querySelector('.quote')); }
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
     jump HOME one beat apart and the new quote is whole. At most DEPTH_MAX_SCRAPS scatter, each
     at its own distance (lens depth); the rest of the words fade where they stand. */
  const GROUPS = 3;
  const CUT_MS = 450;           // the whole cut-up, first jump to last (6 gaps of 75ms). 300 was the first pace:
                                // slowed against flashing; 600 was too slow
  const CUT_SLOWMO = 1;         // beat spacing: 1 = even; higher = faster ends, longer hold in the middle
                                // (tried 2.2 over 700ms: a held beat reads as a freeze/lag, not slow-mo, since nothing moves between jumps)
  function beatAt(n) {
    const x = n / (2 * GROUPS), p = CUT_SLOWMO;
    const f = x < 0.5 ? 0.5 * Math.pow(2 * x, p) : 1 - 0.5 * Math.pow(2 * (1 - x), p);
    return Math.round(CUT_MS * f);
  }
  const SCRAP_FADE_MS = 150;    // softness of each jump: a cross-dissolve that overlaps the next beat
  // The new quote's words, landing in their places, fade in slowly and not all alike: each
  // scrap draws its own length at random between the two, wherever it is in the quote (the
  // scattered copy still leaves at the jump's pace).
  const HOME_FADE_MIN_MS = 600, HOME_FADE_MAX_MS = 2000;
  // The site's curve is nearly all the way there long before it ends (a long, flat tail): the
  // words read as arrived while the fade is still running. The change is over, and the next
  // one may start, once every word is this far in — not when the last fade has run out.
  const HOME_FADE_DONE = 0.8;
  const SCRAP_GAP = 14;         // breathing room kept between scraps (px)
  const SCRAP_ROOM = 1;         // em of box around a scattered scrap's letters, so Safari's layer never crops them, whatever the face
  // Lens depth: each scattered scrap has its own distance. The closer it is, the larger, the more
  // out of focus and the fainter; home is sharp.
  const DEPTH_SCALE_MIN = 1;    // the farthest scrap: the landed size, sharp
  const DEPTH_SCALE_MAX = 8;    // the closest scrap
  const DEPTH_BLUR_MAX = 12;    // blur of the closest scrap (px)
  const DEPTH_ALPHA_MIN = 0.05; // opacity of the closest scrap; the farthest is 1
  const DEPTH_LINGER_MS = 250;  // extra time the closest scrap takes to disappear (the farthest: none)
  const DEPTH_MAX_SCRAPS = 12;  // how many scraps scatter at most; the rest fade in place
  const DEPTH_BIAS = 1.6;       // 1 = distances spread evenly; higher = fewer close ones
  let modeBusy = false;

  // A range's first box with ink in it. Safari lists, first, a zero-width box at the end of the
  // previous line for a word that follows a preserved line break (the break's own box) — taking
  // that put the word on the wrong line and joined lines in the scan-in stand-in.
  const inkRect = (range) => { const rects = range.getClientRects(); return [...rects].find((r) => r.width > 0) || rects[0]; };

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
          return p.text.match(/[^-]*-|[^-]+/g).map((piece) => { const part = { text: piece, start: p.start + at, cjk: false }; at += piece.length; return part; });
        });
        parts.forEach((p) => {
          range.setStart(node, p.start);
          range.setEnd(node, p.start + p.text.length);
          const r = inkRect(range);
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
      scraps.push({ text: group.map((w) => w.text).join(first.cjk ? '' : ' '), left: first.left, top: first.top, node: first.node, start: first.start, endNode: group[group.length - 1].node, end: group[group.length - 1].end });
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
      lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing, fontFeatureSettings: cs.fontFeatureSettings,
    });
    app.appendChild(layer);

    const vw = window.innerWidth, vh = window.innerHeight, range = document.createRange();
    const rgb = (cs.color.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).join(', ');
    const inkAt = (alpha) => `rgba(${rgb}, ${alpha.toFixed(3)})`; // the quote's colour, fainter
    // A scrap's distance (0 = farthest, 1 = closest) sets its size, blur and opacity.
    const setDepth = (p, near) => {
      p.near = near;
      p.scale = DEPTH_SCALE_MIN + (DEPTH_SCALE_MAX - DEPTH_SCALE_MIN) * near;
      p.w = p.w0 * p.scale;
      p.h = p.h0 * p.scale;
      p.dx = p.dy = 0;
      // Measured in the larger type, not worked out: at these sizes a rounding of the line box
      // is tens of pixels, enough to put one scrap on another.
      p.el.style.fontSize = `${p.scale.toFixed(3)}em`;
      range.selectNodeContents(p.el);
      const r = range.getBoundingClientRect();
      p.el.style.fontSize = '';
      if (r.width) { p.w = r.width; p.h = r.height; p.dx = r.left - p.scrap.left; p.dy = r.top - p.scrap.top; }
      // Never much wider than the window (a phone): it comes further away until it fits.
      p.spread = Math.ceil(near * DEPTH_BLUR_MAX * 3);
      if (p.w > 1.2 * vw && near > 0.02) return setDepth(p, near * 0.8);
      p.el.style.zIndex = Math.round(near * 1000); // the closer scrap is always in front of the farther
      // The blur is a text-shadow under transparent letters, not a `filter` (as in the language
      // sweep): iOS Safari draws a filtered scrap on a layer of its own and now and then leaves a
      // row of it unpainted — a pink hairline along the scrap's edge. Whole pixels and a clip
      // did not cure it; with no filter there is no such layer. The shadow's radius is twice
      // the blur's (a blur's radius is its standard deviation, a shadow's is two of them); the
      // scrap's faintness is the shadow's own alpha, clear of the jump's fade.
      p.blurPx = Math.round(near * DEPTH_BLUR_MAX);
      p.blur = p.blurPx >= 1
        ? `0 0 ${2 * p.blurPx}px ${inkAt(1 - (1 - DEPTH_ALPHA_MIN) * near)}` : '';
    };
    const pieces = scraps.map((scrap) => {
      const el = document.createElement('span');
      el.className = 'dada-scrap';
      setFaceText(el, scrap.text, plainLetters(quoteEl, scrap.node.data), scrap.start);
      el.style.left = `${scrap.left}px`;
      el.style.top = `${scrap.top}px`;
      layer.appendChild(el);
      // Line boxes and glyph boxes differ; nudge so the scrap's glyphs sit exactly on the word.
      range.selectNodeContents(el);
      const own = inkRect(range);
      if (own) { el.style.left = `${2 * scrap.left - own.left}px`; el.style.top = `${2 * scrap.top - own.top}px`; }
      const p = { el, scrap, w0: el.offsetWidth, h0: el.offsetHeight };
      setDepth(p, Math.pow(Math.random(), DEPTH_BIAS));
      return p;
    });

    // Scatter: spread over the whole screen — and a little past its edges, so some scraps get
    // cropped — without landing on each other or on the text already on the page.
    const taken = [...app.querySelectorAll('.chrome, .n-cats li, .n-from, .n-kept, .n-body, .thumb')]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width && r.height && r.top < vh && r.bottom > 0);
    // The quote itself is kept clear too: its words are still there, or already
    // there, while the scraps are out.
    range.selectNodeContents(quoteEl);
    taken.push(range.getBoundingClientRect());
    const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left) + SCRAP_GAP)
      * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) + SCRAP_GAP);
    // Only so many scraps scatter (picked at random); the rest stay where they are
    // and fade out, or in, on their group's beat.
    pieces.map((_, i) => i).sort(() => Math.random() - 0.5).slice(DEPTH_MAX_SCRAPS).forEach((i) => { pieces[i].stay = true; });
    // The largest are placed first, and a scrap that finds no clear spot comes
    // a step further away (smaller, sharper) and tries again.
    [...pieces].sort((a, b) => b.near - a.near).forEach((p) => {
      if (p.stay) return;
      let best = null;
      for (let attempt = 0, round = 0; attempt < 120; attempt++) {
        if (attempt === 119 && best.cost > 0 && round < 10 && p.near > 0.02) { setDepth(p, p.near * 0.75); best = null; attempt = 0; round++; }
        const left = -0.35 * p.w + Math.random() * (vw - 0.3 * p.w);
        const top = -0.25 * p.h + Math.random() * (vh - 0.5 * p.h);
        const box = { left, top, right: left + p.w, bottom: top + p.h };
        const cost = taken.reduce((sum, r) => sum + overlap(box, r), 0);
        if (!best || cost < best.cost) best = { box, cost };
        if (cost === 0) break;
      }
      taken.push(best.box);
      // The scrap is set in larger type, not scaled up: a scaled scrap is drawn small
      // and enlarged, which muddies the blur.
      p.out = `translate(${Math.round(best.box.left - p.scrap.left - p.dx)}px, ${Math.round(best.box.top - p.scrap.top - p.dy)}px)`; // whole pixels (see the blur)
      p.size = `${p.scale.toFixed(3)}em`;
    });

    // Deal the scraps into groups at random (as evenly as possible).
    pieces.forEach((p) => { p.homeMs = Math.round(HOME_FADE_MIN_MS + (HOME_FADE_MAX_MS - HOME_FADE_MIN_MS) * Math.random()); });
    const order = pieces.map((_, i) => i).sort(() => Math.random() - 0.5);
    order.forEach((pieceIndex, n) => { pieces[pieceIndex].group = n % GROUPS; });

    // A jump is still a jump — position changes in one frame — but the characters soften it:
    // the scrap dissolves out of its old spot while it dissolves into the new one.
    const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease').trim() || 'ease';
    const fade = (el, from, to, ms = SCRAP_FADE_MS) => el.animate([{ opacity: from }, { opacity: to }], { duration: ms, easing, fill: 'forwards' });
    // A scattered scrap takes longer to go the closer (more blurred) it is.
    const leaveMs = (p) => SCRAP_FADE_MS + (p.isOut ? Math.round(p.near * DEPTH_LINGER_MS) : 0);
    // A scrap that has finished fading in goes back to being plain text: while the (filled)
    // animation is attached, Safari keeps the scrap on a composited layer and shows a reused,
    // scaled, clipped raster of it — lighter and softer than the real quote, which then
    // "snapped" crisp at the handover. Cancelling the finished animation drops the layer.
    // One settle per scrap, the latest: an earlier one would cut a later fade short (a blink).
    const settling = new Map();
    const unsettle = (el) => { clearTimeout(settling.get(el)); settling.delete(el); };
    const settle = (el, ms) => { unsettle(el); settling.set(el, setTimeout(() => { el.getAnimations().forEach((a) => a.cancel()); el.style.opacity = ''; }, ms + 30)); };
    const fadeIn = (el, ms = SCRAP_FADE_MS) => { fade(el, 0, 1, ms); settle(el, ms); };
    // Where a scrap's fade has got to: what leaves starts from there, not from full strength.
    const shown = (el) => { const o = parseFloat(getComputedStyle(el).opacity); return Number.isFinite(o) ? o : 1; };
    // Safari draws a filtered scrap on a layer the size of its box and crops what falls outside:
    // the blur's spread, the italic overhang, the tall letters. A scattered scrap gets a wider
    // box (padding, with the same negative margin so the glyphs stay where they are).
    const room = (p, out) => {
      const spread = p.spread;
      // A full em on every side, whatever the face (the measured --ink-x / --ink-y still cropped
      // in places, and each new face reaches differently), plus the blur's spread.
      p.el.style.padding = out ? `calc(${SCRAP_ROOM}em + ${spread}px)` : '';
      p.el.style.margin = out ? `calc(-${SCRAP_ROOM}em - ${spread}px)` : '';
    };
    // Far or home: the scrap's blur and faintness (see setDepth).
    const depth = (p, out) => {
      p.el.style.color = out && p.blur ? 'transparent' : '';
      p.el.style.textShadow = out ? p.blur : '';
    };
    // The new quote's words do not land as copies: each scrap's words are the quote's own,
    // wrapped where they stand and unseen (transparent) until their scrap comes home, then
    // faded in by colour. So a word is in its final drawing from the moment it lands — its
    // ligatures, its spacing, its exact pixels — and nothing is left to settle when the
    // copies hand over. (A copy sits a fraction of a pixel off and is drawn on a layer of its
    // own while it fades; the handover showed as the whole quote adjusting.) Colour, not
    // opacity: iOS Safari does not animate opacity on a plain inline span.
    let real = false;
    if (startOut && pieces.length && pieces.every((p) => p.scrap.node === p.scrap.endNode && p.scrap.node === quoteEl.firstChild) && quoteEl.childNodes.length === 1) {
      try {
        [...pieces].reverse().forEach((p) => { // last first: earlier offsets stay valid
          range.setStart(p.scrap.node, p.scrap.start); range.setEnd(p.scrap.node, p.scrap.end);
          p.word = document.createElement('span');
          p.word.className = 'q-word';
          p.word.style.color = 'transparent';
          range.surroundContents(p.word);
        });
        real = true;
        drawWhole(quoteEl, CUT_MS + HOME_FADE_MAX_MS + 200); // from the swap until the slowest word is in
        wrap.classList.add('is-wiping'); // the language button waits for the last word, as before
      } catch (e) { unwrap(); }
    }
    function unwrap() { // the quote back to its one text node
      pieces.forEach((p) => { if (p.word && p.word.parentNode) p.word.replaceWith(...p.word.childNodes); p.word = null; });
      quoteEl.getAnimations().forEach((a) => a.cancel()); // (drawWhole)
      quoteEl.normalize();
    }
    const land = (p) => {
      p.word.animate([{ color: 'transparent' }, { color: cs.color }], { duration: p.homeMs, easing, fill: 'forwards' });
    };
    const pose = (group, out, landing = false) => pieces.forEach((p) => { // landing: the new quote coming home, at each scrap's own slow fade
      const inMs = landing ? p.homeMs : SCRAP_FADE_MS;
      if (landing && real) {
        if (p.group !== group) return;
        if (!p.stay) { const from = shown(p.el); unsettle(p.el); p.el.getAnimations().forEach((a) => a.cancel()); fade(p.el, from, 0, leaveMs(p)); } // the far copy goes, where it is
        land(p);
        return;
      }
      if (p.group !== group) return;
      if (p.stay) {
        if (out) { const from = shown(p.el); unsettle(p.el); p.el.getAnimations().forEach((a) => a.cancel()); fade(p.el, from, 0); p.el.style.opacity = '0'; }
        else { p.el.style.opacity = ''; fadeIn(p.el, inMs); }
        return;
      }
      const ghost = p.el.cloneNode(true);
      const from = shown(p.el);
      ghost.getAnimations?.().forEach((a) => a.cancel());
      layer.appendChild(ghost);
      fade(ghost, from, 0, leaveMs(p));
      setTimeout(() => ghost.remove(), leaveMs(p) + 30); // timers, not onfinish: animations stall in hidden tabs
      p.el.style.transform = out ? p.out : 'none';
      depth(p, out);
      p.el.style.fontSize = out ? p.size : '';
      room(p, out);
      p.isOut = out;
      fadeIn(p.el, inMs);
    });
    if (startOut) pieces.forEach((p) => { if (p.stay) { p.el.style.opacity = '0'; return; } p.el.style.transform = p.out; depth(p, true); p.el.style.fontSize = p.size; room(p, true); p.isOut = true; fadeIn(p.el); });
    const dissolve = () => {
      if (real) { // the page is free and the language button comes in; the words finish their fade, then the wrappers come off
        real = false;
        wrap.classList.remove('is-wiping');
        wrap.querySelector('.lang')?.classList.add('is-in');
        flushLanding();
        landing = { finish: unwrap, timer: setTimeout(flushLanding, Math.max(0, ...pieces.map((p) => p.homeMs)) + 30) }; // from the last beat's own start, give or take: every fade is over by then
      }
      pieces.forEach((p) => { const from = shown(p.el); unsettle(p.el); p.el.getAnimations().forEach((a) => a.cancel()); fade(p.el, from, 0, leaveMs(p)); });
      setTimeout(() => layer.remove(), SCRAP_FADE_MS + DEPTH_LINGER_MS + 30);
    };
    return { layer, pose, dissolve, homeMax: Math.round(easeTimeFor(HOME_FADE_DONE, easing) * Math.max(0, ...pieces.map((p) => p.homeMs))), get real() { return real; } };
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
      const own = inkRect(range) || el.getBoundingClientRect();
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
    // The stand-in is not taken away as soon as its lines have landed: scanIn does that
    // (`finish`) once the afterglow is gone. While the glow patches are animating behind the
    // page, iOS puts the real quote on a layer of its own and crops it at its box — the italic
    // J lost its tail for the rest of the scan. The stand-in's lines have room for it.
    const finish = () => {
      standIn.remove();
      quoteEl.style.visibility = '';
      animateDashes(quoteEl, true); // the underlines draw in once the quote is handed over
    };
    return { standIn, ends: at + longest + 30, finish };
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

    // The category symbols draw in as the edge reaches them, one after another.
    items.filter(({ el }) => el.parentNode === $('nCats')).forEach(({ el, at }, i) => drawNoteSym(el.querySelector('.sym'), at + i * NOTE_SYM_STAGGER_MS));

    risers.forEach(({ el, at }) => el.animate(
      [{ transform: `translateY(${RISE_PX}px)` }, { transform: 'translateY(0)' }],
      { duration: RISE_MS, delay: at, easing, fill: 'backwards' },
    ));

    let ends = Math.max(0, ...risers.map((r) => r.at + RISE_MS));
    let handOver = null; // the quote's stand-in → the real quote
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
        handOver = lines.finish;
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
    setTimeout(() => { glowLayer.remove(); if (handOver) handOver(); }, ends + 60); // the glow goes first, then the real quote takes over, in one frame
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
    flushLanding();
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
      // Room for the letters' ink on the layer (app.css, --ink-x / --ink-y), at the larger of the two sizes.
      const em = Math.max(fromSize, parseFloat(cs.fontSize));
      float.style.setProperty('--overhang', `${Math.ceil(0.8 * em)}px`);
      float.style.setProperty('--overhang-y', `${Math.ceil(0.5 * em)}px`);
      const pad = getComputedStyle(float);
      float.style.transformOrigin = `${pad.paddingLeft} ${pad.paddingTop}`; // the text's corner (the layer is larger than the text)
      float.style.scale = fromSize / parseFloat(cs.fontSize);
      float.style.translate = `${from.left - to.left}px ${from.top - to.top}px`;
      float.getBoundingClientRect(); // commit the start pose
      float.style.transition = `translate ${EXIT_TRAVEL_MS}ms var(--ease) ${lift}ms, scale ${EXIT_TRAVEL_MS}ms var(--ease) ${lift}ms`;
      float.style.translate = '0px 0px';
      float.style.scale = 1;
      // The language button makes the trip with the quote: a copy on the same layer, from its
      // place in the notes to its place on the page (it kept out of sight until the page's own
      // appeared at the end, a jump).
      const fromBtn = $('nQuoteWrap').querySelector('.lang'), toBtn = wrap.querySelector('.lang');
      if (fromBtn && toBtn) {
        const a = fromBtn.getBoundingClientRect(), b = toBtn.getBoundingClientRect();
        const btn = toBtn.cloneNode(true);
        btn.classList.remove('is-in');
        Object.assign(btn.style, { left: `${b.left}px`, top: `${b.top}px`, translate: `${a.left - b.left}px ${a.top - b.top}px` });
        layer.appendChild(btn);
        btn.getBoundingClientRect(); // commit the start pose
        btn.style.transition = `translate ${EXIT_TRAVEL_MS}ms var(--ease) ${lift}ms`;
        btn.style.translate = '0px 0px';
      }
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
  const WORD_SWEEP = new Set(['arab', 'hebr', 'thai', 'deva']);
  function spanify(quoteEl) {
    const chars = [];
    const walker = document.createTreeWalker(quoteEl, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    // Arabic, Hebrew, Thai and Devanagari sweep a word at a time: their letters join, or carry
    // marks, and a letter alone in its own span would fall apart for the length of the sweep.
    const byWord = WORD_SWEEP.has(quoteEl.dataset.script);
    nodes.forEach((node) => {
      const frag = document.createDocumentFragment();
      const plain = plainLetters(quoteEl, node.data);
      let at = 0;
      (byWord ? node.data.match(/\s|\S+/g) || [] : [...node.data]).forEach((ch) => {
        const i = at; at += ch.length;
        if (/\s/.test(ch)) { frag.appendChild(document.createTextNode(ch)); return; }
        const span = document.createElement('span');
        if (plain.has(i)) span.style.fontFeatureSettings = ROSE_PLAIN;
        span.textContent = ch;
        frag.appendChild(span);
        chars.push(span);
      });
      node.replaceWith(frag);
    });
    return chars;
  }

  // Stagger the characters left to right so the last one finishes exactly at LANG_MS.
  // The blur is a text-shadow, not a filter: a filter animation on each of a hundred-odd inline
  // spans is composited per span, and Safari drops most of them (only a few characters blurred,
  // at random). A text-shadow is painted in place and animates reliably everywhere: the glyph's
  // colour goes to transparent while its shadow spreads, so it reads as the glyph blurring away.
  function sweep(chars, show) {
    const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease').trim() || 'ease';
    const ink = getComputedStyle(chars[0] || document.body).color;
    const clear = { opacity: 1, color: ink, textShadow: `0 0 0 ${ink}` };
    const gone = { opacity: 0, color: 'transparent', textShadow: `0 0 ${LANG_BLUR}px ${ink}` };
    const span = Math.max(0, LANG_MS - LANG_CHAR_MS);
    chars.forEach((c, i) => {
      c.animate(show ? [gone, clear] : [clear, gone], {
        duration: LANG_CHAR_MS, delay: chars.length > 1 ? (i / (chars.length - 1)) * span : 0, easing, fill: 'both',
      });
    });
  }

  function toggleLanguage() {
    if (langBusy || modeBusy || state.animating) return;
    flushLanding();
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
    Object.assign(ghost.style, { left: `${old.offsetLeft}px`, top: `${old.offsetTop}px`, width: `${old.offsetWidth}px`, maxWidth: 'none' }); // maxWidth: the incoming quote may be narrower (evenLines narrows a CJK one) and its wrap with it; the ghost keeps the width it had
    // …while the incoming text takes its real place underneath.
    wrap.innerHTML = quoteHTML(current(), { original: state.original, withAnnotations: inNotes, tierAs: inNotes ? fittedTier(current(), state.original) : null });
    if (inNotes) evenLines(wrap.querySelector('.quote')); else fitTier(wrap.querySelector('.quote'));
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
  // A token's value in px, resolved through layout (a calc()/clamp() string can't be parsed).
  const cssProbe = document.createElement('div');
  cssProbe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:0';
  function cssPx(token, fallback) {
    if (!cssProbe.isConnected) document.body.appendChild(cssProbe);
    cssProbe.style.height = `var(${token})`;
    const v = cssProbe.offsetHeight;
    return v > 0 ? v : fallback;
  }
  let annSource = null, annPose = '', annBusy = false;

  // Pose the enlarged word so its glyphs sit exactly on the source words in the quote.
  function annStartPose(word, source) {
    // Glyph boxes (via ranges), not line boxes. Copy the numbers out before touching another range.
    const glyphBox = (el) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      const b = inkRect(r) || el.getBoundingClientRect();
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
    const quoteEl = el.closest('.quote'); // the enlarged word is set in the quote's face, at the quote's scale
    word.dataset.font = quoteEl.dataset.font; word.dataset.tier = quoteEl.dataset.tier;
    const rtl = rtlFirst(a.explanation);
    text.innerHTML = nativeRuns(rtl ? ltrRuns(esc(noOrphans(a.explanation))) : esc(noOrphans(a.explanation)));
    text.dir = rtl ? 'rtl' : '';
    [word, text, back].forEach((n) => { n.style.transition = 'none'; });
    word.style.transform = '';
    overlay.hidden = false;
    dim(true);

    // Final layout: the enlarged word sits near where it was in the quote.
    const vw = window.innerWidth, vh = window.innerHeight, m = 20;
    word.style.whiteSpace = word.scrollWidth > vw - 2 * m ? 'normal' : 'nowrap';
    word.style.maxWidth = `${vw - 2 * m}px`;
    const w = word.offsetWidth, h = word.offsetHeight;
    const gap = cssPx('--ann-gap', 24); // tokens.css, scaled by --u
    const backGutter = vw >= 600 ? 49 : 0;
    const left = Math.max(m + backGutter, Math.min(rect.left - 14, vw - m - Math.max(w, text.offsetWidth)));
    const top = Math.max(64, Math.min(rect.top - (h - rect.height) / 2, vh - h - text.offsetHeight - gap - 29));
    word.style.left = text.style.left = `${left}px`;
    word.style.top = `${top}px`;
    text.style.top = `${top + h + gap}px`;
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
  function morph(poster, from, to, done, bg = '') {
    const el = document.createElement('div');
    el.className = 'video-morph';
    el.style.background = bg; // (music: the player's grey)
    if (poster) el.innerHTML = `<img src="${esc(poster)}" alt="">`; // (a logo card has none: the morph is a black box)
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

  // The library's toast (js/admin.js): fades up, stays, fades down; a new one replaces the one showing.
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
      toastTimer = setTimeout(() => { el.hidden = true; }, 300);
    }, 300 + TOAST_STAY_MS);
  }
  // A thumbnail's picture, to morph into the player; a logo card has none.
  const posterOf = (thumb) => { const img = thumb && !thumb.classList.contains('thumb--logo') && thumb.querySelector('img'); return img ? (img.currentSrc || img.src) : ''; };
  async function openVideo(thumb) {
    const video = videoOf(current());
    if (!video || videoBusy) return;
    videoBusy = true;
    // Only a video the platform has just vouched for is opened: a broken link, or a platform
    // that cannot be reached from here, gets a word instead of a dead player.
    const info = await lookupVideo(video).done;
    const music = !!VIDEO[video.platform].music;
    if (info.state !== 'ok' || !thumb.isConnected) { videoBusy = false; if (thumb.isConnected) toast(music ? 'Music not available.' : 'Video not available.'); return; }
    if (info.id) video.id = info.id;
    if (info.vertical) video.orientation = 'vertical';
    videoThumb = thumb;
    const poster = music ? '' : posterOf(thumb); // music: a cover would not stretch into the player's banner — the morph is the container's grey
    const box = $('videoBox'), frame = $('videoFrame');
    box.dataset.orientation = video.orientation;
    box.style.setProperty('--player-h', music ? `${VIDEO[video.platform].height(video)}px` : '');
    box.dataset.platform = video.platform;
    box.classList.remove('is-ready');
    frame.innerHTML = '';
    frame.style.backgroundImage = poster ? `url("${poster}")` : '';
    frame.style.backgroundColor = music ? VIDEO[video.platform].bg : '';
    $('videoOverlay').hidden = false;
    const from = thumb.getBoundingClientRect(), to = box.getBoundingClientRect();
    thumb.style.visibility = 'hidden';
    dim(true);
    morph(poster, from, to, (el) => {
      frame.innerHTML = `<iframe src="${esc(VIDEO[video.platform].player(video))}" title="${music ? 'Music' : 'Video'}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
      box.classList.add('is-ready');
      setTimeout(() => el.remove(), 250); // the poster stays underneath while the player loads
      videoBusy = false;
    }, frame.style.backgroundColor);
  }

  function closeVideo() {
    if ($('videoOverlay').hidden || videoBusy) return;
    const thumb = videoThumb, box = $('videoBox'), frame = $('videoFrame');
    const music = box.dataset.orientation === 'music';
    const poster = music ? '' : posterOf(thumb);
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
    morph(poster, from, to, (el) => { reset(); el.remove(); }, frame.style.backgroundColor);
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

  /* ---------- Symbols ----------
     The six category symbols (All + the five categories) are ribbons: assets/symbols holds the
     drawing code (ribbon-draw.js, used as it came), how each one draws in (symbol-draw-in.json)
     and how one redraws into another (symbol-transitions.json); the timings live in those
     files. Two are drawn live: the mark at the top left (the current category's symbol; it
     draws in with the typing and as the menu closes) and the menu's one large symbol. The
     symbols elsewhere (notes, the form, the library) are still images: css .icon-mark. */
  const SYM_DIR = 'assets/symbols/';
  const SYM = { all: 'All', perspective: 'Perspective', growth: 'Growth', drive: 'Drive', community: 'Community', romance: 'Romance' };
  const SYM_SMALL = { levels: 2, pieces: 10 }, SYM_SMALL_STRIDE = 3; // the 24px mark: the file's low-cost settings
  const symJSON = (file) => fetch(SYM_DIR + file).then((r) => { if (!r.ok) throw new Error(`${file}: ${r.status}`); return r.json(); });
  let markSym = null, menuSym = null; // { lib, model, r } once their files are in
  // The mark needs the draw-in file only, so it is ready first; the menu's symbol needs both.
  const markReady = Promise.all([import(new URL(SYM_DIR + 'ribbon-draw.js', document.baseURI).href), symJSON('symbol-draw-in.json')]).then(([lib, data]) => {
    const model = lib.createModel(data);
    return (markSym = { lib, model, r: lib.createRenderer($('markSym'), model, SYM_SMALL) });
  });
  const menuReady = Promise.all([markReady, symJSON('symbol-transitions.json')]).then(([mark, data]) => {
    const model = mark.lib.createModel(data);
    $('menuSym').style.setProperty('--sym-ms', `${model.S.durationMs}ms`); // it glides to the next row for as long as it redraws
    return (menuSym = { lib: mark.lib, model, r: mark.lib.createRenderer($('menuSym'), model, { drawInModel: mark.model }) });
  });
  markReady.catch((err) => { console.error(err); $('menuBtn').classList.add('is-static'); }); // no files: the still logo
  menuReady.catch(() => {});

  // The mark: the current category's symbol draws itself in (or, `animate` false, is simply there).
  let markStop = null;
  let markBusy = false; // the mark is drawing (in, out, or the hover's redraw); markStop alone stays set after a draw-in
  function drawMark(animate = true) {
    const name = SYM[state.filter];
    markReady.then(({ lib, model, r }) => {
      if (markStop) markStop();
      markStop = null;
      $('menuBtn').classList.remove('is-static');
      markBusy = false;
      if (!animate) return r.rest(name);
      r.drawIn(name, 0);
      markBusy = true;
      markStop = lib.play(model, (t) => r.drawIn(name, t, SYM_SMALL_STRIDE), () => { markBusy = false; }); // reduced motion: straight to the end
    }).catch(() => {});
  }
  // Notes: each category's symbol beside its name (renderNotes), drawn live so it can draw in
  // as the notes arrive (scanIn → drawNoteSym). Without the symbols' files: the still images.
  const NOTE_SYM_STAGGER_MS = 50; // a quote in several categories: each symbol starts this long after the one above
  function noteSyms() {
    const svgs = [...$('nCats').querySelectorAll('svg.sym')];
    const make = () => svgs.forEach((svg) => {
      if (!svg.isConnected || svg._r) return;
      svg._r = markSym.lib.createRenderer(svg, markSym.model, SYM_SMALL);
      svg._r.rest(SYM[svg.dataset.sym]);
    });
    if (markSym) return make(); // at once: the scan starts in this same turn
    markReady.then(make).catch(() => svgs.forEach((svg) => {
      const still = document.createElement('span');
      still.className = 'icon icon-mark';
      still.dataset.sym = svg.dataset.sym;
      svg.replaceWith(still);
    }));
  }
  function drawNoteSym(svg, delay) {
    if (!svg || !svg._r) return;
    const name = SYM[svg.dataset.sym];
    svg._r.drawIn(name, 0);
    setTimeout(() => { if (svg.isConnected) markSym.lib.play(markSym.model, (t) => svg._r.drawIn(name, t, SYM_SMALL_STRIDE)); }, delay);
  }

  // The reverse: the mark undraws itself, thin tip back to thick tip, over `ms`; then `done`.
  function undrawMark(ms, done) {
    if (markStop) markStop();
    markStop = null;
    markBusy = false;
    if (!markSym) return done(); // not loaded: nothing to play
    const name = SYM[state.filter], t0 = performance.now(), ease = markSym.model.ease;
    // The site's curve runs forwards in time (off fast, a long brake), so most of the symbol is
    // gone early and the end is seen: `at(left)` is the draw-in time at which `left` of it is drawn.
    const at = (left) => { let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (ease(mid) < left) lo = mid; else hi = mid; } return (lo + hi) / 2; };
    let raf = 0;
    const tick = (now) => {
      const t = Math.min((now - t0) / ms, 1);
      markSym.r.drawIn(name, t < 1 ? at(1 - ease(t)) : 0, SYM_SMALL_STRIDE);
      if (t < 1) raf = requestAnimationFrame(tick); else { markStop = null; markBusy = false; done(); }
    };
    markBusy = true;
    raf = requestAnimationFrame(tick);
    markStop = () => cancelAnimationFrame(raf);
  }
  function clearMark() { // nothing drawn: the state a draw-in starts from
    if (markStop) markStop();
    markStop = null;
    markBusy = false;
    if (markSym) markSym.r.drawIn(SYM[state.filter], 0);
  }

  // Hovering the mark (a mouse, at any width): it redraws, along the pair's bridge, into another symbol and
  // straight back (fast, a slow drift while it is up, fast back), growing to 28 with it, MARK_HOVER_MS each way — on All, into one of the current quote's categories
  // (picked at random when it has several); on a category, into All. It needs the transitions
  // file (the menu's): once that is in, the mark's renderer is made again to carry both.
  const MARK_HOVER_MS = 400;   // each half: into the other symbol, and back
  const MARK_HOVER_HOLD = 3;   // the way out: 1 = even speed; higher = a faster start, a longer drift while the new shape is up
  const MARK_HOVER_BACK = 'cubic-bezier(0.8, 0, 0.35, 1)'; // the way back: slow out of the drift, quick, slowing to land
  const MARK_HOVER_SIZE = 28 / 24; // it grows with the redraw, 24 → 28 at the other symbol, and back (the same curve)
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
  let markMorph = false; // the mark's renderer can redraw from one symbol into another
  menuReady.then(function swap() {
    if (markBusy) return setTimeout(swap, 100); // the mark is drawing (in or out): not mid-way
    const svg = $('markSym');
    svg.replaceChildren();
    markSym.r = markSym.lib.createRenderer(svg, menuSym.model, { ...SYM_SMALL, drawInModel: markSym.model });
    if (menuEl.hidden) markSym.r.rest(SYM[state.filter]); else markSym.r.drawIn(SYM[state.filter], 0); // (menu open: the mark is undrawn)
    markMorph = true;
  }).catch(() => {});
  function hoverMark() {
    if (!markMorph || markBusy || reduceMotion.matches || !canHover.matches || !menuEl.hidden || state.mode !== 'main') return;
    if (menuBusy || modeBusy || langBusy || state.animating) return; // the menu could not open now (the quote typing in, changing, …): no invitation to it either (openMenu's own test)
    const from = state.filter;
    let to = 'all';
    if (from === 'all') {
      const cats = (current() && current().categories) || [];
      if (!cats.length) return;
      to = cats[Math.floor(Math.random() * cats.length)];
    }
    const a = SYM[from], b = SYM[to], t0 = performance.now();
    // Fast out, a slow drift while the new shape is up, fast back, a gentle landing: the way
    // out is 1 - (1 - 2τ)^MARK_HOVER_HOLD, the way back MARK_HOVER_BACK. The way back rewinds the same
    // bridge. The file's own easing is undone first (the head's progress is ease(time)), so
    // the speed is this curve's, not the file's.
    const M = menuSym.model, D = M.S.durationMs, lag = M.S.thinEndDelayMs, run = Math.max(D - lag, 1);
    const unease = (v) => { let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (M.ease(mid) < v) lo = mid; else hi = mid; } return (lo + hi) / 2; };
    const timeFor = (shape) => Math.min(1, (unease(shape) * run + shape * lag) / D); // the trailing end lands as the shape reaches 1
    const svg = $('markSym');
    let raf = 0;
    const tick = (now) => {
      const tau = (now - t0) / (2 * MARK_HOVER_MS);
      if (tau >= 1) { markSym.r.rest(a); svg.style.scale = ''; markStop = null; markBusy = false; return; }
      const shape = tau < 0.5
        ? 1 - Math.pow(1 - 2 * tau, MARK_HOVER_HOLD)                 // out: fast, slowing into the new shape
        : 1 - easeProgressAt(2 * tau - 1, MARK_HOVER_BACK);          // back: out of the slow-mo, quick, easing onto the original
      markSym.r.transition(a, b, timeFor(shape), SYM_SMALL_STRIDE);
      svg.style.scale = (1 + (MARK_HOVER_SIZE - 1) * shape).toFixed(4);
      raf = requestAnimationFrame(tick);
    };
    if (markStop) markStop(); // (a finished draw-in's)
    markBusy = true;
    raf = requestAnimationFrame(tick);
    markStop = () => { cancelAnimationFrame(raf); markSym.r.rest(a); svg.style.scale = ''; markBusy = false; }; // a click opens the menu mid-way: it undraws from the symbol itself, at its own size
  }
  $('menuBtn').addEventListener('mouseenter', hoverMark);

  // The menu's symbol. One redraw runs at a time, rest to rest: a preview that changes on the
  // way is picked up as the current one lands (`want`), from the symbol then shown.
  // With a mouse the redraw waits until the pointer has rested on a row for MENU_SYM_WAIT_MS, so a
  // sweep over several rows goes straight to the one it stops on, with no stop on the way.
  const MENU_SYM_WAIT_MS = 120;
  const menuMark = { shown: null, want: null, busy: false, stop: null, wait: 0 };
  const menuSymPlace = (key) => $('menuSym').style.setProperty('--at', [ALL, ...CATEGORIES].findIndex((c) => c.key === key)); // the row it is centred on (css; desktop and tablet)
  function menuSymStop() {
    if (menuMark.stop) menuMark.stop();
    menuMark.stop = null; menuMark.busy = false;
    clearTimeout(menuMark.wait); menuMark.wait = 0;
  }
  function menuSymPlay(model, step) {
    menuMark.busy = true;
    menuMark.stop = menuSym.lib.play(model, step, () => { menuMark.busy = false; if (!menuMark.wait) menuSymGo(); }); // the pointer still moving: its timer takes over
    if (!menuMark.busy) menuMark.stop = null; // reduced motion: it was over at once
  }
  function menuSymOpen(key) { // the menu opens: the current category's symbol draws in, on its row
    menuSymStop();
    menuMark.shown = menuMark.want = key;
    menuSymPlace(key);
    if (menuSym) menuSym.r.drawIn(SYM[key], 0);
    menuReady.then(() => {
      if (menuEl.hidden || menuMark.busy) return;
      const now = (menuMark.shown = menuMark.want); // the preview may have moved on while the files loaded
      menuSymPlace(now);
      menuSymPlay(markSym.model, (t) => menuSym.r.drawIn(SYM[now], t));
    }).catch(() => {});
  }
  function menuSymTo(key) { // the preview moves: the symbol redraws into that category's, gliding to its row
    menuMark.want = key;
    clearTimeout(menuMark.wait); menuMark.wait = 0;
    if (mqHoverDesktop.matches && !reduceMotion.matches) menuMark.wait = setTimeout(() => { menuMark.wait = 0; menuSymGo(); }, MENU_SYM_WAIT_MS);
    else menuSymGo(); // touch: a tap is already a decision
  }
  function menuSymGo() {
    const key = menuMark.want;
    if (menuMark.busy || !menuSym || menuEl.hidden || key === menuMark.shown) return;
    const from = menuMark.shown;
    menuMark.shown = key;
    menuSymPlace(key);
    menuSymPlay(menuSym.model, (t) => menuSym.r.transition(SYM[from], SYM[key], t));
  }

  /* ---------- Menu ---------- */

  const countFor = (key) => (key === 'all' ? state.all.length : state.all.filter((q) => q.categories.includes(key)).length);

  function renderMenu() {
    // The description may be inside a list row (phone); the list is about to be rebuilt.
    menuEl.insertBefore(document.querySelector('.cat-desc'), $('menuApply'));
    $('catList').innerHTML = [ALL, ...CATEGORIES].map((c) => {
      const cls = ['cat-row', c.key === state.filter && 'is-selected',
        c.key === state.preview && 'is-preview'].filter(Boolean).join(' ');
      const empty = countFor(c.key) === 0;
      return `<li><button class="${cls}" data-cat="${c.key}"${empty ? ' data-empty' : ''}>
        <span class="cat-name">${esc(c.name)}</span><span class="icon cat-ind"></span></button></li>`;
    }).join('');
    updateMenuPreview();
  }

  // The description, with its links (if it has any) as role="link" spans like the notes' source
  // (no address strip; `follow` handles the click); a web link opens a new tab.
  function setDesc(el, cat) {
    const text = noOrphans(cat.desc);
    const found = (cat.links || [])
      .map((l) => ({ ...l, at: text.indexOf(l.text) }))
      .filter((l) => l.at >= 0)
      .sort((a, b) => a.at - b.at);
    const parts = [];
    let from = 0;
    for (const l of found) {
      if (l.at < from) continue;
      const a = document.createElement('span');
      a.setAttribute('role', 'link');
      a.tabIndex = 0;
      a.dataset.href = l.href;
      if (!l.href.startsWith('mailto:')) a.setAttribute('data-out', '');
      a.textContent = l.text;
      parts.push(text.slice(from, l.at), a);
      from = l.at + l.text.length;
    }
    parts.push(text.slice(from));
    el.replaceChildren(...parts);
  }

  function updateMenuPreview() {
    const key = state.preview;
    const cat = key === 'all' ? ALL : CAT_BY_KEY[key];
    document.querySelectorAll('.cat-row').forEach((row) => {
      const k = row.dataset.cat;
      row.classList.toggle('is-preview', k === key);
      row.classList.toggle('is-selected', k === state.filter);
    });
    const n = countFor(key);
    placeDesc(key, () => {
      setDesc($('catDescText'), cat);
      $('catCount').textContent = `${n} quote${n === 1 ? '' : 's'} total`;
      sizeDescLine();
    });
    menuSymTo(key);
    const apply = $('menuApply');
    apply.textContent = key === 'all' ? 'See all words' : `See ${cat.name.toLowerCase()} words`;
    apply.disabled = n === 0;
    apply.style.opacity = n === 0 ? 0.3 : '';
  }

  // Desktop/tablet: the hairline between the description and the count is given its height
  // explicitly, so it glides (css transition, in step with the rows) when a longer or shorter
  // description takes the space above it, instead of snapping.
  function sizeDescLine(instant = false) {
    const desc = document.querySelector('.cat-desc'), line = document.querySelector('.cat-desc-line');
    if (mqMobile.matches || !desc || !line) { if (line) line.style.height = ''; return; }
    const gap = parseFloat(getComputedStyle(desc).rowGap) || 0;
    const h = desc.clientHeight - $('catDescText').offsetHeight - $('catCount').offsetHeight - 2 * gap;
    const from = line.offsetHeight, to = Math.max(0, h);
    line.style.height = `${to}px`; // the count never moves: the new length is set at once…
    if (instant || !from || !to || from === to || reduceMotion.matches) return;
    // …and the line itself grows or shrinks into it from its own centre.
    line.getAnimations().forEach((a) => a.cancel());
    line.animate([{ transform: `scaleY(${from / to})` }, { transform: 'scaleY(1)' }], { duration: DESC_LINE_MS, easing: easeCurve() });
  }
  const DESC_LINE_MS = 150; // the hairline's stretch from its centre

  /* Phone: the description lives in the list, under the previewed row, and moves with the
     preview like an accordion: under the old row a copy of the text simply fades out, fast
     (DESC_OUT_MS), while its space closes up; under the new row the space opens and the text's
     lines fade in top to bottom, each as the space reaches it. The text is never
     clipped. Tablet/desktop: it stays in the menu's own column. */
  const DESC_MS = 450; // the space under a row opening or closing
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
      // A word inside a link (setDesc) takes the whole link into its line: a range that cut
      // through the link's span could not be wrapped.
      const linkOf = (w) => w.node.parentElement.closest('[data-href]');
      const a = linkOf(line.first), b = linkOf(line.last);
      if (a) range.setStartBefore(a); else range.setStart(line.first.node, line.first.start);
      if (b) range.setEndAfter(b); else range.setEnd(line.last.node, line.last.end);
      const span = document.createElement('span');
      span.className = 'desc-line';
      try { range.surroundContents(span); } catch (e) { return null; }
      return span;
    }).filter(Boolean).reverse();
  }
  function placeDesc(key, setText) {
    const desc = document.querySelector('.cat-desc');
    const home = mqMobile.matches ? document.querySelector(`.cat-row[data-cat="${key}"]`)?.closest('li') : menuEl;
    const moving = home && desc.parentNode !== home;
    const animate = moving && mqMobile.matches && !reduceMotion.matches && !$('menu').hidden;
    const shut = { height: '0px', marginBottom: '0px' };
    const gapOf = (el) => parseFloat(getComputedStyle(el).marginBottom) || 0; // under the description (app.css); above it is the row's own
    const open = (el) => ({ height: `${el.offsetHeight}px`, marginBottom: `${gapOf(el)}px` });
    const fold = (el, show) => {
      const easing = easeCurve();
      const from = open(el);                                     // measured at full height, before folding
      if (!show) {
        // Shutting: the whole text fades out at once, quickly; the space closes with the row.
        el.querySelector('p').animate([{ opacity: 1 }, { opacity: 0 }], { duration: DESC_OUT_MS, easing, fill: 'both' });
        el.animate([from, shut], { duration: DESC_MS, easing, fill: 'both' });
        return new Promise((r) => setTimeout(r, DESC_MS + 20));
      }
      // Opening: the space opens with the row; each line starts to fade in only once the space
      // has opened down to its bottom edge, so no line ever shows over the row below (nothing
      // is cropped), and never sooner than LINE_STAGGER_MS after the line above.
      const lines = wrapLines(el.querySelector('p'));
      const height = el.offsetHeight, room = height + gapOf(el);
      el.animate([shut, from], { duration: DESC_MS, easing, fill: 'both' });
      // The fade is the text's colour (transparent → ink), not `opacity`: iOS Safari does not
      // animate opacity on a plain inline span — each line jumped in at the end of its delay.
      const ink = getComputedStyle(el).color;
      let last = 0;
      lines.forEach((span, i) => {
        const reached = easeTimeFor((height * (i + 1) / lines.length) / room, easing) * DESC_MS;
        last = i ? Math.max(reached, last + LINE_STAGGER_MS) : reached;
        span.animate([{ color: 'transparent' }, { color: ink }], { duration: LINE_MS, delay: last, easing, fill: 'both' });
      });
      return new Promise((r) => setTimeout(r, Math.max(DESC_MS, last + LINE_MS) + 20));
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
        p.querySelectorAll('.desc-line').forEach((span) => span.replaceWith(...span.childNodes)); // wrappers off (the links stay)
        p.normalize();
      });
    }
  }

  /* Menu motion: the mark undraws itself (its draw-in played backwards), then the list arrives —
     each row fades in MENU_STAGGER_MS after the one above, while the menu's symbol draws in.
     The descriptor (and Back / the apply button) fade in together with the first row. */
  const MENU_ICON_MS = 300, MENU_ITEM_MS = 400, MENU_STAGGER_MS = 50;
  const MENU_OUT_MS = 250, MENU_BG_MS = 250; // leaving: each row's fade, then the background's
  const MENU_RETURN_MS = 400;              // closing with nothing changed: the quote fades back in (Notes + arrows: css, 400ms)
  let menuBusy = false;
  const easeCurve = () => getComputedStyle(document.documentElement).getPropertyValue('--ease').trim() || 'ease';

  function openMenu() {
    if (menuBusy || modeBusy || langBusy || state.animating) return;
    const reveal = () => {
      state.preview = state.filter;
      renderMenu();
      $('menu').hidden = false;
      menuSymOpen(state.filter);
      sizeDescLine(true); // the hairline is at full length as the menu appears; it glides only between items
      if (state.mode === 'main') app.classList.add('is-typing'); // Notes and the arrows go under the menu already hidden: they type back in with the quote on close
      menuBusy = false;
      if (reduceMotion.matches) return;
      const easing = easeCurve();
      // Each element fades up to its own opacity (an empty category's row is dimmed by css), not to 1.
      const fadeIn = (el, delay) => el.animate([{ opacity: 0 }, { opacity: getComputedStyle(el).opacity }], { duration: MENU_ITEM_MS, delay, easing, fill: 'backwards' });
      document.querySelectorAll('#catList .cat-row').forEach((row, i) => {
        fadeIn(row, i * MENU_STAGGER_MS);
      });
      [document.querySelector('.cat-desc'), $('menuBack'), $('menuApply')].forEach((el) => fadeIn(el, 0)); // the symbol is not faded: it draws in
    };
    if (reduceMotion.matches) return reveal();
    menuBusy = true;
    undrawMark(MENU_ICON_MS, reveal);
  }

  // Leaving mirrors arriving: rows fade out one after another (the symbol and the descriptor go
  // with the first row), the grey background fades last, and at the top left the chosen
  // category's symbol draws in — on Back too. `changed`: a new category was applied — the (new)
  // quote types itself in, the symbol with it. Otherwise the page comes back as it was: the
  // quote, Notes and the arrows simply fade in with the background.
  function closeMenu(changed = false) {
    const menu = $('menu');
    if (menu.hidden || menuBusy) return;
    const icon = $('markSym');
    let holdChrome = false; // the words are fading back in: Notes and the arrows wait for them
    const finish = () => {
      menu.hidden = true;
      menu.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      menuSymStop();
      icon.getAnimations().forEach((a) => a.cancel());
      if (reduceMotion.matches) drawMark(false);
      menuBusy = false;
      if (!state.animating && !holdChrome) showChrome(); // no arrival ran (reduced motion / notes): show them at once
    };
    if (reduceMotion.matches) return finish();

    menuBusy = true;
    const easing = easeCurve();
    const fadeOut = (el, delay) => el.animate([{ opacity: getComputedStyle(el).opacity }, { opacity: 0 }], { duration: MENU_OUT_MS, delay, easing, fill: 'forwards' });
    const rows = [...document.querySelectorAll('#catList .cat-row')];
    rows.forEach((row, i) => {
      fadeOut(row, i * MENU_STAGGER_MS);
    });
    [document.querySelector('.cat-desc'), $('menuSym'), $('menuBack'), $('menuApply')].forEach((el) => fadeOut(el, 0));

    const itemsGone = MENU_OUT_MS + Math.max(0, rows.length - 1) * MENU_STAGGER_MS;
    const wrap = currentWrap();
    if (wrap && state.mode === 'main' && changed) wrap.style.visibility = 'hidden'; // the new quote types in (arrive) as the background goes
    setTimeout(() => {
      clearMark(); // the mark undrew itself as the menu opened: it draws in again
      icon.getAnimations().forEach((a) => a.cancel());
      if (state.mode === 'main') {
        if (changed) arrive(); // the symbol draws in as the typing starts
        else { // nothing changed: the quote comes back word by word, as after a change, without the scraps
          drawMark();
          const arrived = wrap ? wordsIn(wrap) : 0;
          if (arrived) {
            holdChrome = true;
            wrap.classList.add('is-wiping'); // the language button waits with Notes and the arrows…
            setTimeout(() => { wrap.classList.remove('is-wiping'); wrap.querySelector('.lang')?.classList.add('is-in'); showChrome(); }, arrived); // …until the words read as arrived
          } else { // (not plain text: the whole quote fades in)
            if (wrap) wrap.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MENU_RETURN_MS, easing, fill: 'backwards' });
            showChrome();
          }
        }
      }
      fadeOut(menu, 0).effect.updateTiming({ duration: MENU_BG_MS }); // background last, over the symbol drawing in
      setTimeout(finish, MENU_BG_MS);
    }, itemsGone);
  }

  function applyFilter(key) {
    if (menuBusy || countFor(key) === 0) return;
    const changed = key !== state.filter;
    if (changed) {
      state.filter = key;
      state.list = shuffle(key === 'all' ? state.all : state.all.filter((q) => q.categories.includes(key)));
      state.idx = 0;
      state.original = false;
      renderDeck();
    }
    closeMenu(changed);
  }

  $('menuBtn').addEventListener('click', openMenu);
  $('menuBack').addEventListener('click', () => closeMenu(false));
  $('menuApply').addEventListener('click', () => applyFilter(state.preview));

  const catList = $('catList');
  catList.addEventListener('click', (e) => {
    const row = e.target.closest('[data-cat]');
    if (!row) return;
    if (mqHoverDesktop.matches) return applyFilter(row.dataset.cat);
    // Touch: the first tap previews (the symbol redraws, the name is underlined, the description
    // shows); a tap on the underlined row applies.
    if (state.preview === row.dataset.cat) return applyFilter(row.dataset.cat);
    state.preview = row.dataset.cat;
    updateMenuPreview();
  });
  catList.addEventListener('mouseover', (e) => {
    previewHeld = false;
    const row = e.target.closest('[data-cat]');
    if (!row || !mqHoverDesktop.matches || state.preview === row.dataset.cat) return;
    state.preview = row.dataset.cat;
    updateMenuPreview();
  });
  // Leaving the list goes back to the selected category — except to the right, toward the
  // description: the previewed one stays, to be read (and its links clicked), until the pointer
  // comes back left of the list's edge.
  let previewHeld = false;
  const backToSelected = () => { previewHeld = false; state.preview = state.filter; updateMenuPreview(); };
  catList.addEventListener('mouseleave', (e) => {
    if (!mqHoverDesktop.matches) return;
    if (e.clientX >= catList.getBoundingClientRect().right - 1) { previewHeld = true; return; }
    backToSelected();
  });
  menuEl.addEventListener('mousemove', (e) => {
    if (!previewHeld || !mqHoverDesktop.matches || catList.contains(e.target)) return;
    if (e.clientX < catList.getBoundingClientRect().right - 1) backToSelected();
  });

  /* ---------- Keyboard & resize ---------- */

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('menu').hidden) return closeMenu();
      if (!$('annOverlay').hidden || !$('videoOverlay').hidden) return closeOverlays();
      if (state.mode === 'notes') return setMode('main');
    }
    if (state.mode !== 'main' || !$('menu').hidden) return;
    // A held key changes the quote once: chained cut-ups are a long run of flashes.
    const held = e.repeat;
    if (['ArrowDown', 'ArrowRight', 'PageDown', ' ', 'j'].includes(e.key)) { e.preventDefault(); if (!held) go(1); }
    if (['ArrowUp', 'ArrowLeft', 'PageUp', 'k'].includes(e.key)) { e.preventDefault(); if (!held) go(-1); }
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
      if (!state.animating && !modeBusy && !langBusy) fitDeck(); // a short quote's size follows the window
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
  // A face that arrives late (the next quote's, fetched as it is first shown) can change how
  // many lines a short quote takes.
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => { if (!state.animating && !modeBusy && !langBusy && !app.classList.contains('is-typing')) fitDeck(); });
  document.addEventListener('visibilitychange', layoutNotes); // a hidden tab gets no resize events
  // The pinned quote can change height without a window resize (fluid type, fonts, language toggle).
  if (typeof ResizeObserver === 'function') new ResizeObserver(layoutNotes).observe($('nQuoteWrap'));

  /* ---------- Quote faces ---------- */

  // A local preview has no fonts Worker: the same faces, from the project's own folder.
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    const local = document.createElement('style');
    local.textContent = FONT_FILES.map((key) => `@font-face { font-family: '${FONT_BY_KEY[key].name}'; src: url('/workers/fonts/files/${key}.woff2') format('woff2'); font-weight: 400; font-style: normal; font-display: swap; }`).join('\n');
    document.head.appendChild(local);
  }

  /* ---------- Boot ---------- */

  // The faces' tuned settings (data/faces.json, saved from the library's Fonts tab) laid over
  // css/fonts.css: per face its leading, its tracking (%) and its size against the tier's at
  // each length. The same function is in js/admin.js: change both.
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
  // Read before the first quote is drawn (a short quote's size depends on its lines). A
  // missing or broken file changes nothing: fonts.css stands.
  const facesReady = fetch(FACES_URL, { cache: 'no-cache' }) /* always checked against the server: a save in the library shows on the next load */.then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((table) => {
    const css = facesCSS(table);
    if (!css) return;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  });

  Promise.all([fetch(DATA_URL), facesReady])
    .then(([r]) => { if (!r.ok) throw new Error(`quotes.json: ${r.status}`); return r.json(); })
    .then((quotes) => {
      state.all = quotes.filter((q) => q.status === 'live').sort((a, b) => a.id - b.id);
      state.list = shuffle(state.all); // the deck is dealt at random: no. 1 is not first, and the next is not no. 2
      // A quote's own address (#8) opens it, then the number leaves the address; without one, a
      // reload comes back to the quote this tab was on (renderDeck keeps it).
      let kept = null;
      try { kept = sessionStorage.getItem('wwk-quote'); } catch (e) {}
      const wanted = parseInt(location.hash.slice(1) || kept, 10);
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
      const found = state.list.findIndex((q) => q.id === wanted);
      // A quote marked "Don't show as the first quote" in the library (`notFirst`) is never the
      // one a visitor lands on — unless its own address was opened. It trades places with the
      // first quote in the deck that may be.
      if (found < 0 && state.list.length && state.list[0].notFirst) {
        const ok = state.list.findIndex((q) => !q.notFirst);
        if (ok > 0) [state.list[0], state.list[ok]] = [state.list[ok], state.list[0]];
      }
      state.idx = found >= 0 ? found : 0;
      renderDeck();
      arrive();
    })
    .catch((err) => {
      console.error(err);
      drawMark(false);
      showChrome();
      track.innerHTML = '<div class="slide" data-pos="0"><div class="q-wrap"><blockquote class="quote" data-tier="m">The words couldn’t be loaded. Please refresh.</blockquote></div></div>';
    });

  /* ---------- Arrival: the quote types itself in, letter by letter ----------
     On every load, coming back from the form, and as the menu closes: the letters appear one
     after another, left to right, top to bottom — a copy of each letter (measured off the
     rendered quote, like the cut-up's scraps) sits exactly on its place and switches on in one
     frame, ARRIVE_STAGGER_MS after the one before (tightened for long quotes so the whole thing
     stays under ARRIVE_MAX_MS, never closer than ARRIVE_MIN_STAGGER_MS). ARRIVE_LETTER_MS > 0
     fades each letter instead. Then the copies are swapped for the real quote. Waits for the
     fonts: the letters are measured off the rendered text. */
  // Typing rhythm. Every gap is ARRIVE_STAGGER_MS give or take ARRIVE_JITTER (a human is never even),
  // plus a breath at a word break and a longer one after punctuation. If the whole quote would
  // take longer than ARRIVE_MAX_MS the gaps are scaled down together, so the rhythm keeps its shape.
  const ARRIVE_LETTER_MS = 0;        // 0 = each letter simply appears; > 0 = fades in over this long
  const ARRIVE_STAGGER_MS = 50;      // base gap between letters
  const ARRIVE_JITTER = 0.4;         // ± this fraction of the gap, at random
  const ARRIVE_SPACE_MS = 40;        // extra before the first letter of a word
  const ARRIVE_COMMA_MS = 120;       // extra after , ; : — and their CJK forms
  const ARRIVE_STOP_MS = 260;        // extra after . ! ? … and a line break
  const ARRIVE_FINAL_MS = 200;       // extra before the closing period (or ! ? … ” ’) of the whole quote
  const ARRIVE_MAX_MS = 2600;        // budget for the letter gaps of the whole quote (the breaths and
                                     // pauses are never compressed — they are what makes it read
                                     // as typing); a long quote types faster, never below…
  const ARRIVE_MIN_GAP_MS = 24;      // …this gap between letters — unless the whole quote would then take longer than…
  const ARRIVE_TOTAL_MS = 4000;      // …this, start to finish: then the letters keep to their budget and the pauses are shortened to fit
  const COMMA_RE = /[,;:—–、；：]/, STOP_RE = /[.!?…。！？]/;
  function typingSchedule(letters) {
    // Letter gaps (jittered) are budgeted; pauses are added on top, unscaled.
    const gaps = [], pauses = [];
    letters.forEach((l, i) => {
      if (i === 0) { gaps.push(0); pauses.push(0); return; }
      const prev = letters[i - 1];
      gaps.push(ARRIVE_STAGGER_MS * (1 + ARRIVE_JITTER * (2 * Math.random() - 1)));
      let pause = l.wordStart ? ARRIVE_SPACE_MS : 0;
      if (STOP_RE.test(prev.text) || l.top - prev.top > 4) pause += ARRIVE_STOP_MS;
      else if (COMMA_RE.test(prev.text)) pause += ARRIVE_COMMA_MS;
      if (i === letters.length - 1 && /[.!?…。！？”’"']/.test(l.text)) pause += ARRIVE_FINAL_MS; // the full stop lands a beat after the last word
      pauses.push(pause);
    });
    const sum = gaps.reduce((a, b) => a + b, 0), rests = pauses.reduce((a, b) => a + b, 0);
    let scale = sum > ARRIVE_MAX_MS ? Math.max(ARRIVE_MIN_GAP_MS / ARRIVE_STAGGER_MS, ARRIVE_MAX_MS / sum) : 1, rest = 1;
    // A long quote is still typed within ARRIVE_TOTAL_MS: the letters take their budget whatever
    // the gap comes to (several to a frame, if need be), and the pauses share what is left —
    // all shortened alike, so the rhythm keeps its shape.
    if (sum * scale + rests > ARRIVE_TOTAL_MS) {
      scale = Math.min(scale, ARRIVE_MAX_MS / sum);
      rest = rests ? Math.min(1, (ARRIVE_TOTAL_MS - sum * scale) / rests) : 1;
    }
    const at = [];
    let t = 0;
    gaps.forEach((g, i) => { t += g * scale + pauses[i] * rest; at.push(t); });
    return at;
  }
  function measureLetters(quoteEl) {
    const letters = [], range = document.createRange(), plainOf = new Map();
    letters.words = []; // each word whole: its text and place (the typing swaps a typed word's letters for it)
    measureWords(quoteEl).forEach((w, word) => {
      letters.words.push({ text: w.text, left: w.left, top: w.top });
      if (!plainOf.has(w.node)) plainOf.set(w.node, plainLetters(quoteEl, w.node.data));
      for (let i = w.start; i < w.end; i++) {
        range.setStart(w.node, i); range.setEnd(w.node, i + 1);
        const r = inkRect(range);
        if (r) letters.push({ text: w.node.data[i], left: r.left, top: r.top, wordStart: i === w.start, plain: plainOf.get(w.node).has(i), word });
      }
    });
    return letters;
  }
  // Notes and the arrows come in with the fade "Add words" has coming back from the form (css
  // .app.chrome-in: fade-in, --chrome-in). After the typing they wait until the real quote has been
  // drawn, and CHROME_IN_WAIT_MS more: the swap from the typed letters to the real quote is a
  // heavy frame, and a fade begun in or right after it is over by the time it shows — they
  // jumped in (50ms was not enough on a phone).
  const CHROME_IN_MS = 600, CHROME_IN_WAIT_MS = 400; // CHROME_IN_MS: css --chrome-in
  function showChrome() {
    if (!app.classList.contains('is-typing')) return;
    app.classList.add('chrome-in');
    app.classList.remove('is-typing');
    setTimeout(() => app.classList.remove('chrome-in'), CHROME_IN_MS + 100);
  }
  let markStill = false;
  const ARRIVE_FONT_WAIT_MS = 3000; // the longest the typing waits for the quote's font
  function arrive() {
    const wrap = currentWrap();
    const still = markStill; // back from the form the logo never left: it is not drawn again
    markStill = false;
    if (!wrap || reduceMotion.matches) { showChrome(); drawMark(false); return; }
    wrap.style.visibility = 'hidden';
    state.animating = true;
    app.classList.add('is-typing'); // Notes and the arrows wait for the last letter, then fade in
    const done = () => {
      state.animating = false;
      // Only once the real quote has actually been drawn (two frames on), and a beat after that.
      requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(showChrome, CHROME_IN_WAIT_MS)));
      setTimeout(showChrome, CHROME_IN_WAIT_MS + 800); // a hidden tab runs no frames: they still come in
    };
    // The letters are measured off the rendered quote, so its own font must be in first.
    // `fonts.ready` alone is not enough: on a first visit it can resolve before the quote's font
    // has even been asked for, the letters are then measured in the fallback (wider) and drawn
    // in the real font — spaced out until the swap. Ask for the quote's faces by name, and
    // don't wait for them longer than ARRIVE_FONT_WAIT_MS.
    const quoteEl = wrap.querySelector('.quote');
    const face = getComputedStyle(quoteEl);
    const asked = document.fonts && document.fonts.load
      ? document.fonts.load(`${face.fontStyle} ${face.fontWeight} ${face.fontSize} ${face.fontFamily}`, quoteEl.textContent).catch(() => {})
      : Promise.resolve();
    const ready = Promise.race([
      asked.then(() => (document.fonts && document.fonts.ready) || null),
      new Promise((r) => setTimeout(r, ARRIVE_FONT_WAIT_MS)),
    ]);
    ready.then(() => requestAnimationFrame(() => {
      if (currentWrap() !== wrap) { done(); drawMark(false); return; } // the deck was rebuilt meanwhile
      drawMark(!still); // the symbol draws in from the first letter
      fitDeck(); // the face is in now: a short quote that takes three lines goes down a size before it is typed
      const letters = measureLetters(quoteEl);
      const cs = getComputedStyle(quoteEl);
      const layer = document.createElement('div');
      layer.className = 'dada';
      layer.setAttribute('aria-hidden', 'true');
      Object.assign(layer.style, { fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontStyle: cs.fontStyle, lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing, fontFeatureSettings: cs.fontFeatureSettings });
      app.appendChild(layer);
      const range = document.createRange();
      const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease').trim() || 'ease';
      const at = typingSchedule(letters);
      // A copy laid exactly over its place in the rendered quote (its own ink on the measured ink).
      const place = (text, left, top) => {
        const el = document.createElement('span');
        el.className = 'dada-scrap';
        el.textContent = text;
        el.style.left = `${left}px`; el.style.top = `${top}px`;
        if (ARRIVE_LETTER_MS > 0) el.style.opacity = '0'; else el.style.visibility = 'hidden';
        layer.appendChild(el);
        range.selectNodeContents(el);
        const own = inkRect(range);
        if (own) { el.style.left = `${2 * left - own.left}px`; el.style.top = `${2 * top - own.top}px`; }
        return el;
      };
      const typed = letters.map((l) => {
        const el = place(l.text, l.left, l.top);
        if (l.plain) el.style.fontFeatureSettings = ROSE_PLAIN;
        return el;
      });
      // Letters set one by one have no ligatures and none of the face's letter-to-letter
      // shaping, so a word settles as its last letter lands, not when the whole quote is done:
      // with that letter the word's letters are swapped for the word set whole.
      const whole = new Map(); // a word's last letter → { the word set whole, its letters }
      if (ARRIVE_LETTER_MS === 0) {
        const lettersOf = new Map();
        letters.forEach((l, i) => { if (!lettersOf.has(l.word)) lettersOf.set(l.word, []); lettersOf.get(l.word).push(i); });
        lettersOf.forEach((ids, word) => {
          if (ids.length < 2) return;
          const w = letters.words[word];
          whole.set(ids[ids.length - 1], { el: place(w.text, w.left, w.top), ids });
        });
      }
      letters.forEach((l, i) => {
        const el = typed[i];
        if (ARRIVE_LETTER_MS > 0) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ARRIVE_LETTER_MS, delay: at[i], easing, fill: 'forwards' });
        else setTimeout(() => { // typewriter: visibility, which cannot fade, in one frame
          const w = whole.get(i);
          if (!w) { el.style.visibility = ''; return; }
          w.ids.forEach((k) => { typed[k].style.visibility = 'hidden'; });
          w.el.style.visibility = '';
        }, at[i]);
      });
      const total = (at[at.length - 1] || 0) + ARRIVE_LETTER_MS;
      setTimeout(() => {
        wrap.style.visibility = '';
        layer.remove(); // the copies sit on the letters to a fraction of a pixel; a plain swap keeps the typewriter crisp
        wrap.querySelector('.lang')?.classList.add('is-in'); // the 中 / EN button fades up as the last letter lands
        done();
      }, total + 30);
    }));
  }
  // sessionStorage throws when site data is blocked (strict privacy settings, some in-app browsers).
  const session = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
    remove(k) { try { sessionStorage.removeItem(k); } catch (e) {} },
  };
  if (session.get('wwk-home')) { // back from the form: the chrome fades in around the logo
    session.remove('wwk-home');
    markStill = true;
    $('menuBtn').classList.add('is-static'); // the still logo holds the place until the drawn one is ready
    app.classList.add('is-arriving');
    setTimeout(() => app.classList.remove('is-arriving'), CHROME_IN_MS + 100);
  }

  /* ---------- Links ---------- */
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

  /* ---------- Add words: hand over to the form ---------- */
  const LEAVE_MS = 100;
  $('addBtn').addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // a new tab: `follow` opens it
    e.preventDefault();
    const href = e.currentTarget.dataset.href;
    session.set('wwk-arrive', '1');
    app.classList.add('is-leaving');
    setTimeout(() => { location.href = href; }, reduceMotion.matches ? 0 : LEAVE_MS);
  });
  window.addEventListener('pageshow', () => app.classList.remove('is-leaving')); // back button (bfcache)
})();
