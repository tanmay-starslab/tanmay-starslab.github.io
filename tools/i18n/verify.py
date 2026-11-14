#!/usr/bin/env python3
"""Check generated navigation, metadata, resources and translation fragments.

Uses only Python's standard library. Run after build.py --check.
"""
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import json
import sys
import xml.etree.ElementTree as ET

import i18nlib as L
from build import page_path, page_url


class Page(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.elements = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        self.elements.append((tag, dict(attrs)))

    handle_startendtag = handle_starttag


def fragment_errors(fragment):
    """The tag multiset alone cannot detect crossed or unclosed inline tags."""
    stack, errors = [], []
    for m in L.TAG_RE.finditer(fragment):
        closing, tag, rest = m.groups()
        tag = tag.lower()
        if tag in L.VOID or rest.rstrip().endswith("/"):
            continue
        if closing:
            if not stack or stack[-1] != tag:
                errors.append(f"unexpected closing {tag}")
            else:
                stack.pop()
        else:
            stack.append(tag)
    if stack:
        errors.append("unclosed " + ", ".join(stack))
    return errors


def verify(site=L.SITE):
    failures = []
    langs = [c for c in L.LANG_ORDER if (site / "tools/i18n/locales" / f"{c}.json").exists()]
    expected = set(langs) | {"x-default"}
    parsed = {}
    for lang in langs:
        loc = L.load_json(site / "tools/i18n/locales" / f"{lang}.json")
        for key, value in loc.items():
            text = value["text"] if isinstance(value, dict) else value
            for problem in fragment_errors(text):
                failures.append(f"{lang}: {key}: {problem}")
        for name in L.PAGES:
            path = site / ("" if lang == "en" else lang) / name
            parsed[path] = Page(path.read_text(encoding="utf-8"))

    for path, page in parsed.items():
        rel = path.relative_to(site)
        lang = "en" if len(rel.parts) == 1 else rel.parts[0]
        name = path.name
        def require(ok, message):
            if not ok:
                failures.append(f"{rel}: {message}")
        roots = [a for t, a in page.elements if t == "html"]
        require(len(roots) == 1 and roots[0].get("lang") == lang, "incorrect html lang")
        require(bool(roots) and roots[0].get("dir", "ltr") == L.LANGS[lang][3], "incorrect direction")
        ids = [a["id"] for _, a in page.elements if a.get("id")]
        require(len(ids) == len(set(ids)), "duplicate element IDs")
        canonical = [a.get("href") for t, a in page.elements if t == "link" and a.get("rel") == "canonical"]
        require(canonical == [page_url(lang, name)], "incorrect canonical")
        alts = [(a.get("hreflang"), a.get("href")) for t, a in page.elements if t == "link" and a.get("rel") == "alternate" and a.get("hreflang")]
        require(Counter(c for c, _ in alts) == Counter(expected), "missing/duplicate hreflang")
        for code, url in alts:
            require(url == page_url("en" if code == "x-default" else code, name), "incorrect hreflang target")
        picker = [(a["data-lang"], a.get("href")) for _, a in page.elements if "data-lang" in a]
        require(Counter(c for c, _ in picker) == Counter(langs), "missing/duplicate picker language")
        for code, url in picker:
            require(url == page_path(code, name), "picker changes page type")
        for tag, attrs in page.elements:
            refs = [attrs[k] for k in ("href", "src", "poster") if attrs.get(k)]
            if "srcset" in attrs:
                refs += [x.strip().split()[0] for x in attrs["srcset"].split(",") if x.strip()]
            for ref in refs:
                u = urlsplit(ref)
                if u.scheme or u.netloc:
                    continue
                target = (site / unquote(u.path).lstrip("/")) if u.path.startswith("/") else (path.parent / unquote(u.path) if u.path else path)
                if target.is_dir():
                    target /= "index.html"
                require(target.exists(), f"missing local target {ref}")
                if u.fragment and target in parsed:
                    target_ids = {a.get("id") for _, a in parsed[target].elements}
                    require(unquote(u.fragment) in target_ids, f"missing anchor {ref}")
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9", "x": "http://www.w3.org/1999/xhtml"}
    sitemap = ET.parse(site / "sitemap.xml")
    urls = sitemap.findall("s:url", ns)
    if Counter(n.findtext("s:loc", namespaces=ns) for n in urls) != Counter(page_url(c, p) for c in langs for p in L.PAGES):
        failures.append("sitemap: missing/duplicate pages")
    for node in urls:
        links = node.findall("x:link", ns)
        if Counter(x.get("hreflang") for x in links) != Counter(expected):
            failures.append("sitemap: missing/duplicate hreflang")
    for f in failures:
        print("FAIL", f)
    print(f"{'FAILED' if failures else 'Verified'} {len(parsed)} pages, {len(langs)} languages, fragments, local links, picker, canonical and sitemap alternates")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(verify())
