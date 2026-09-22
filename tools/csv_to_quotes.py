#!/usr/bin/env python3
"""One-time migration: Google Form CSV export -> data/quotes.json (schema in the submission-system spec).

Usage: python3 tools/csv_to_quotes.py "<path to csv>"
Per-row judgment calls (splitting bilingual fields, cleaning junk sources) live in OVERRIDES.
"""
import csv, json, re, sys
from datetime import datetime

CATEGORY_ORDER = ["perspective", "growth", "drive", "community", "romance"]
COUNTRIES = {"United States": "US", "China": "CN", "Switzerland": "CH", "Canada": "CA",
             "Taiwan": "TW", "United Kingdom": "GB"}

# CSV rows left out of the archive (1-based submission order).
SKIP = {
    6,  # Edmonia Lewis — submitted without a reflection ("notes"), which the site requires
}

# Keyed by CSV row (1-based submission order). The public "No." is assigned afterwards,
# counting only the rows that are kept, so numbering has no gaps.
OVERRIDES = {
    6: {"author": {"name": "Edmonia Lewis"}},
    7: {"fix": [("dont", "don't")]},  # typo in the submission
    9: {  # Mencius: English + Chinese in one field; word definitions embedded in context
        "split_original": "zh",
        "author": {"name": "Mencius", "nativeName": "孟子"},
        "annotations_from_context": True,
    },
    15: {"split_original": "zh", "author": {"name": "Wang Xizhi", "nativeName": "王羲之"}},
    16: {  # submitted in Chinese only; the contributor's English rendering was in the context field
        "text_from_context": True, "lang": "zh",
        "author": {"name": "A character in Imperfect Us"},
    },
    17: {"split_original": "zh", "original_first": True,
         "author": {"name": "Gao Jiacheng", "nativeName": "高嘉程"}},
    19: {"author": {"name": "Jess"}},  # submitted as "Me"
    21: {"country": "US"},             # left blank in the form; Jenny Holzer is American
    22: {"author": {"name": "Ray Bradbury"}},
}

# Source format rule: the work's own title only (no medium prefix, subtitle, or page reference),
# optional year, and a kind. Displayed as "Title, Year". (No native-script titles: the intake
# form does not collect them.)
# The site italicizes titles of standalone works (book, film, series, comic, artwork) and leaves
# shorter pieces upright (speech, letter, interview, poem, essay, commercial, scripture).
# Keyed by CSV row:  (title, native title, year, kind)
SOURCES = {
    1: ("A Universe from Nothing", None, None, "book"),
    2: ("Nike Air Jordan Commercial", None, None, "commercial"),
    3: ("Future Shock", None, None, "book"),
    4: ("Invisible Monsters", None, None, "book"),
    5: ("Calvin and Hobbes", None, None, "comic"),
    8: ("Doctrine and Covenants", None, None, "scripture"),
    9: ("The Works of Mencius", None, None, "book"),
    10: ("Letter to Fanny Bowditch", None, 1916, "letter"),
    11: ("Who Not How", None, 2020, "book"),
    12: ("Emmys Red Carpet Interview", None, 2022, "interview"),
    15: ("Preface to the Poems Composed at the Orchid Pavilion", None, None, "essay"),
    16: ("Imperfect Us", None, None, "series"),
    17: ("Smile and Keep Living", None, 2018, "book"),
    18: ("Dear Class of 2020 Commencement Speech", None, 2020, "speech"),
    20: ("Curiosity", None, None, "poem"),
    21: ("Survival Series", None, None, "artwork"),
}

CJK = re.compile(r"[㐀-鿿]")

def clean(s):
    s = (s or "").replace("\r\n", "\n").strip()
    return s or None

def curly(s):
    """Straight quotes -> typographic ones."""
    if not s:
        return s
    s = re.sub(r'(^|[\s(\[—–-])"', r"\1“", s)      # opening double
    s = s.replace('"', "”")                          # any other double closes
    s = re.sub(r"(^|[\s(\[—–-])'", r"\1‘", s)       # opening single
    return s.replace("'", "’")                       # apostrophes and closing single


def polish_quote(s, cjk=False):
    """House style for the quote itself: every sentence starts with a capital, curly quotes,
    closing punctuation."""
    s = curly(s.strip())
    m = re.search(r"[A-Za-zÀ-ÿ]", s)
    if m and not cjk:
        s = s[:m.start()] + s[m.start()].upper() + s[m.start() + 1:]
    if not cjk:  # …and so does every sentence after the first
        s = re.sub(r"([.!?][”’)\]]*\s+[“‘(]*)([a-zà-ÿ])", lambda k: k.group(1) + k.group(2).upper(), s)
    if not re.search(r"[.!?…。！？][”’\"')\]]*$", s):
        s += "。" if cjk else "."
    return s


def strip_wrapping_quotes(s):
    return re.sub(r'^["“](.*)["”]$', r"\1", s, flags=re.S).strip() if s else s

def main(path):
    rows = list(csv.reader(open(path, newline="", encoding="utf-8")))[1:]
    out = []
    for i, r in enumerate(rows, start=1):
        if i in SKIP:
            continue
        ts, text, author, country, src, link, cats, context, reflection, kept = (c for c in r[:10])
        o = OVERRIDES.get(i, {})
        text, context = clean(text), clean(context)
        original = None

        if o.get("split_original"):
            parts = [p.strip() for p in re.split(r"\n\s*\n|\n(?=[㐀-鿿])", text) if p.strip()]
            zh = [p for p in parts if CJK.search(p)]
            en = [p for p in parts if not CJK.search(p)]
            text, original = "\n".join(en), {"lang": o["split_original"], "text": "\n".join(zh)}
        if o.get("text_from_context"):
            original, text, context = {"lang": o["lang"], "text": text}, context, None
        for wrong, right in o.get("fix", []):
            text = text.replace(wrong, right)
        text = polish_quote(strip_wrapping_quotes(text))
        if original:
            original["text"] = polish_quote(original["text"], cjk=True)
        reflection = curly(clean(reflection))

        annotations = []
        if o.get("annotations_from_context") and context:
            keep = []
            for para in re.split(r"\n\s*\n", context):
                lines = para.split("\n")
                defs = [re.match(r'^"(.+?)"\s+means\s+(.*)$', l.strip()) for l in lines]
                if all(defs):
                    annotations += [{"word": curly(m.group(1)), "explanation": curly(m.group(2)[0].upper() + m.group(2)[1:])} for m in defs]
                else:
                    keep.append(para)
            context = "\n\n".join(keep) or None
        context = curly(context)  # after the annotation parse, which looks for straight quotes

        name = re.sub(r"^-\s*", "", clean(author) or "")
        a = {"name": name, "nativeName": None, "country": o.get("country") or COUNTRIES.get((country or "").strip())}
        a.update(o.get("author", {}))

        title, native_title, year, kind = SOURCES.get(i, (None, None, None, None))
        link = clean(link)
        if link and not link.startswith("http"):
            link = None

        categories = [c for c in CATEGORY_ORDER if re.search(rf"\b{c}\b", cats, flags=re.I)]
        stamp = datetime.strptime(ts, "%m/%d/%Y %H:%M:%S").strftime("%Y-%m-%dT%H:%M:%S")

        out.append({
            "id": len(out) + 1, "status": "live",
            "text": text, "originalLanguage": original,
            "categories": categories,
            "author": a,
            "source": {"title": title, "year": year, "kind": kind, "link": link},
            "context": context, "annotations": annotations,
            "reflection": reflection, "keptBy": clean(kept),
            "submittedAt": stamp, "approvedAt": stamp,
        })
    json.dump(out, open("data/quotes.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"wrote {len(out)} quotes")

if __name__ == "__main__":
    main(sys.argv[1])
