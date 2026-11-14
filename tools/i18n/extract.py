#!/usr/bin/env python3
"""Extract every translatable string from index.html and useful-links.html into locales/en.json.

    python tools/i18n/extract.py            # write locales/en.json (keys of unchanged strings are kept)
    python tools/i18n/extract.py --skipped  # also list what was deliberately left untranslated, and why
    python tools/i18n/extract.py --check    # exit 1 if en.json is out of date with the HTML

en.json is {key: {text, context}}. Text that holds inline markup is an HTML
fragment: translators keep every tag and attribute and may move them with the
words they wrap. Names, paper titles, author lists, journals, URLs, emails,
numbers, ions and units are not extracted (see KEEP_* in i18nlib.py).
"""
import argparse
import sys
from collections import Counter

import i18nlib as L


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="fail if en.json differs from a fresh extraction")
    ap.add_argument("--skipped", action="store_true", help="print the strings left untranslated")
    ap.add_argument("--site", default=str(L.SITE), help="site root (default: the repo)")
    a = ap.parse_args()
    site = L.Path(a.site)
    en_path = L.LOCALES / "en.json"
    prev = L.load_json(en_path) if en_path.exists() else {}
    cat, _, per_page, skipped = L.extract_all(site, prev)
    if a.skipped:
        for pg, t, why in sorted(set(skipped)):
            print(f"  skip [{why}] {pg}: {t}")
    if a.check:
        if cat != prev:
            added = sorted(set(cat) - set(prev))
            gone = sorted(set(prev) - set(cat))
            changed = sorted(k for k in set(cat) & set(prev) if cat[k] != prev[k])
            print(f"en.json is stale: {len(added)} new, {len(gone)} removed, {len(changed)} changed key(s); run extract.py")
            for k in (added + gone + changed)[:20]:
                print("  ", k)
            return 1
        print(f"en.json up to date ({len(cat)} keys)")
        return 0
    L.dump_json(cat, en_path)
    kinds = Counter()
    for pg, (src, occs) in per_page.items():
        for o in occs:
            kinds[(pg, o.kind)] += 1
    n_html = sum(1 for v in cat.values() if L.TAG_RE.search(v["text"]))
    words = sum(len(L.norm(L.TAG_RE.sub(" ", v["text"])).split()) for v in cat.values())
    print(f"wrote {en_path.relative_to(L.SITE)}: {len(cat)} keys ({n_html} HTML fragments, {len(L.UI_STRINGS)} UI/script strings), ~{words} words")
    for (pg, k), n in sorted(kinds.items()):
        print(f"  {pg:18s} {k:7s} {n} occurrence(s)")
    print(f"  {len(set(skipped))} strings left untranslated by rule (--skipped lists them)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
