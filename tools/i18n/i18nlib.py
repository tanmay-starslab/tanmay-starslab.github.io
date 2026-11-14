"""Shared code for the site's translation tooling (extract.py, build.py).

The English pages (index.html, useful-links.html) are the single source. They
are parsed with a small source-preserving parser: every node keeps its exact
character span in the file, so translations are applied by replacing spans and
nothing else in the file is reformatted. English stays byte-for-byte as written
apart from the managed i18n blocks build.py maintains.

Translation units
  text   the inner content of the smallest element run that holds a sentence;
         if the run contains inline markup (a, em, strong, i, br, span ...) the
         unit is an HTML fragment with the tags kept, so translators can reorder
         words around them. Plain units are stored decoded (no entities).
  attr   alt, title, aria-label, placeholder on body elements; content of the
         description / og / twitter meta tags in the head.
  title  the <title> text.
  jsonld the JSON-LD "description" and "jobTitle" values.
  ui     strings that are not in the HTML: the language picker, the
         machine-translation note, and strings the site's scripts set at run
         time (theme toggle label, Read more, Cite ...). Pages carry these to
         the scripts as window.I18N.
"""
from __future__ import annotations

import html
import json
import re
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path

SITE = Path(__file__).resolve().parents[2]
TOOL = Path(__file__).resolve().parent
LOCALES = TOOL / "locales"
PAGES = ["index.html", "useful-links.html"]
BASE_URL = "https://tanmaysingh.uk"

# code: (native name, og:locale, Noto family for the Google Fonts css2 API or None, dir)
LANGS = {
    "en":      ("English",    "en_US", None, "ltr"),
    "es":      ("Español",    "es_ES", None, "ltr"),
    "zh-Hans": ("中文",        "zh_CN", "Noto Sans SC", "ltr"),
    "hi":      ("हिन्दी",       "hi_IN", "Noto Sans Devanagari", "ltr"),
    "ar":      ("العربية",     "ar_AR", "Noto Sans Arabic", "rtl"),
    "fr":      ("Français",   "fr_FR", None, "ltr"),
    "pt":      ("Português",  "pt_BR", None, "ltr"),
    "bn":      ("বাংলা",       "bn_IN", "Noto Sans Bengali", "ltr"),
    "ru":      ("Русский",    "ru_RU", None, "ltr"),
    "ja":      ("日本語",      "ja_JP", "Noto Sans JP", "ltr"),
    "de":      ("Deutsch",    "de_DE", None, "ltr"),
    "ko":      ("한국어",      "ko_KR", "Noto Sans KR", "ltr"),
}
LANG_ORDER = list(LANGS)

# Strings that are not in the HTML. {placeholders} must survive translation.
UI_STRINGS = {
    "ui.language": ("Language", "language picker button label (screen readers; the visible label is the current language's own name)"),
    "ui.machine_note": ('This page was machine-translated from English. <a href="{en_url}">Read the original</a>.',
                        "small note in the page footer of every translated page; keep the link tag and {en_url} as is"),
    "ui.suggest": ("Read this page in English",
                   "suggestion chip shown ONCE to a visitor whose browser is set to this language, while they are on a page in another language; "
                   "write it in this language and name this language in it, e.g. Spanish: 'Leer esta página en español'"),
    "ui.dismiss": ("Dismiss", "close button (screen-reader label) on that suggestion chip, in this language"),
    "js.theme_light": ("Light mode", "theme toggle button, switches the page to light colours"),
    "js.theme_dark": ("Dark mode", "theme toggle button, switches the page to dark colours"),
    "js.motion_system": ("Your system already asks for reduced motion.", "motion toggle tooltip when the operating system already requests reduced motion"),
    "js.read_more": ("Read more", "button that expands a shortened research card (phones)"),
    "js.read_less": ("Read less", "button that collapses an expanded research card (phones)"),
    "js.nav_open": ("Open navigation", "menu button (screen-reader label)"),
    "js.nav_close": ("Close navigation", "menu button (screen-reader label)"),
    "js.new_tab": ("Opens in a new tab", "screen-reader note on links that open a new tab"),
    "js.cite": ("Cite", "button on each publication that copies its BibTeX"),
    "js.copied": ("Copied", "Cite button label right after copying"),
    "js.copy_failed": ("Copy failed", "Cite button label when copying failed"),
    "js.cite_for": ("Copy BibTeX for {title}", "Cite button screen-reader label; {title} is the paper title (stays English)"),
    "js.this_paper": ("this paper", "fills {title} when a paper has no title"),
    "js.bibtex_copied": ("BibTeX copied to clipboard", "screen-reader status message"),
    "js.bibtex_failed": ("Could not copy BibTeX", "screen-reader status message"),
    "js.pubs_all": ("Show all publications", "button under the publication list (phones)"),
    "js.pubs_fewer": ("Show fewer publications", "button under the publication list (phones)"),
    "js.form_name": ("Please tell me your name.", "contact form validation message"),
    "js.form_email": ("Please enter a valid email address, so I can write back.", "contact form validation message"),
    "js.form_short": ("Please write a little more in your message.", "contact form validation message"),
    "js.form_disposable": ("Please use an email address you keep, so I can reply.", "contact form validation message (throwaway address)"),
    "js.form_checking": ("Checking your email address...", "contact form status while checking the address"),
    "js.form_sending": ("Sending...", "contact form status while sending a message"),
    "js.form_domain": ("That email domain does not seem to exist or accept mail. Please check the address.", "contact form validation message"),
    "js.form_mailapp": ("Your email app should open with the message ready to send.", "contact form status (fallback path)"),
    "js.form_captcha": ("Please complete the CAPTCHA first.", "contact form status"),
    "js.form_sent": ("Thank you, your message is on its way. I'll reach out to you soon!", "contact form success message"),
    "js.form_ratelimit": ("Too many messages from this connection. Please try again in an hour.", "contact form error"),
    "js.form_failed": ("It did not send; you can also email me at {email}.", "contact form error; keep {email}"),
    "js.form_offline": ("It did not send. Please check your connection, or email me at {email}.", "contact form error; keep {email}"),
}

# ---------------------------------------------------------------- what is NOT translated
# Exact strings (after whitespace collapse, entities decoded) that are names,
# products, datasets or codes: the owner's name, institutions, simulations,
# surveys, software, journals.
KEEP_EXACT = {
    "Tanmay Singh", "Arizona State University", "School of Earth and Space Exploration", "Indian Institute of Technology Delhi",
    "IIT Delhi", "Raman Research Institute", "TNG50", "TNG50-1", "IllustrisTNG", "SIMBA", "COS-IGrM", "HST/COS G130M", "CLOUDY",
    "XGBoost", "BLOG", "AGN", "RHT", "ACF", "MHD", "ERA5", "PWV", "MURaM", "OpenCV", "NumPy", "Python", "Cascade", "Code Ocean",
    "Trident", "Google Scholar", "GitHub", "LinkedIn", "Scholar", "arXiv", "CV", "IAO Hanle", "Ladakh", "am code", "VPA program",
    "Plate I", "T. Singh, ASU SESE, 2026", "Lyα", "C II λ1334", "Si III λ1206",
    "Python for Astronomers", "Python Data Science Handbook", "Explorable Physics", "Crashcourse",
    "Kurzgesagt - In a Nutshell", "3Blue1Brown", "Dr. Becky (Astrophysicist)", "Life Around Science", "Gitfolio",
}
KEEP_EXACT_RE = [
    re.compile(r"^[\W\d_]*$"),                         # numbers, punctuation, symbols only
    re.compile(r"^\S+@\S+\.\S+$"),                     # email
    re.compile(r"^(https?:)?//\S+$"),                  # URL
    re.compile(r"^(H I|He II|C II|C III|C IV|N V|O VI|O VII|O VIII|Mg II|Si II|Si III|Si IV|S II|Ne VIII|Fe II)(\s*λ?\s*\d+)?$"),  # ions
    re.compile(r"^[\d.]+\s*(×|x)\s*10\^?[−-]?\d+$"),   # scientific notation
]

# Element-level exclusions: predicates over the ancestor chain [(tag, classes, id), ...] (innermost last).
def _has(chain, tag=None, cls=None, id_=None):
    return any((tag is None or t == tag) and (cls is None or cls in c) and (id_ is None or i == id_) for t, c, i in chain)

_ROLE_RE = re.compile(r"^(First|Second|Co)[- ]author$")
KEEP_WHERE = [
    ("paper title", lambda ch, t: ch[-1][0] == "h3" and _has(ch, cls="publication-card")),
    ("author list", lambda ch, t: ch[-1][0] == "p" and _has(ch, cls="publication-card")),
    ("journal / volume", lambda ch, t: _has(ch, cls="publication-meta") and not _ROLE_RE.match(t)),  # the role is translated
    ("talk title", lambda ch, t: _has(ch, cls="cv-title") and _has(ch, id_="talks")),
    ("bibtex", lambda ch, t: _has(ch, tag="template")),
]


def keep(text: str, chain=None) -> str | None:
    """Return a reason string when `text` (decoded, collapsed) must not be translated."""
    if text in KEEP_EXACT:
        return "name"
    for r in KEEP_EXACT_RE:
        if r.match(text):
            return "pattern"
    if chain:
        for why, pred in KEEP_WHERE:
            if pred(chain, text):
                return why
    return None


# ---------------------------------------------------------------- source-preserving parser
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
INLINE = {"a", "em", "strong", "b", "i", "br", "span", "small", "sup", "sub", "abbr", "time", "code", "cite", "q",
          "mark", "u", "s", "wbr", "img", "label", "bdi", "bdo", "kbd", "var", "dfn"}
SKIP = {"script", "style", "template", "noscript", "pre", "svg", "textarea", "select", "head"}
MARK_RE = re.compile(r"^\s*(/?)i18n:([a-z-]+)\s*$")


@dataclass
class Node:
    kind: str                      # "el", "text", "comment", "other"
    start: int
    end: int
    tag: str = ""
    attrs: list = field(default_factory=list)
    tag_end: int = 0               # end offset of the start tag
    close_start: int = -1          # start of the end tag (-1: void / unclosed)
    close_end: int = -1
    children: list = field(default_factory=list)
    parent: "Node | None" = None
    data: str = ""

    @property
    def classes(self):
        return (dict(self.attrs).get("class") or "").split()

    def attr(self, name):
        for k, v in self.attrs:
            if k == name:
                return v
        return None

    @property
    def inner(self):
        return (self.tag_end, self.close_start if self.close_start >= 0 else self.tag_end)


class _P(HTMLParser):
    def __init__(self, src):
        super().__init__(convert_charrefs=False)
        self.src = src
        self.lines = [0]
        for m in re.finditer("\n", src):
            self.lines.append(m.end())
        self.root = Node("el", 0, len(src), tag="#root")
        self.root.close_start = len(src)
        self.stack = [self.root]
        self.events = []          # every node in source order, for end-offset fix-up

    def _off(self):
        ln, col = self.getpos()
        return self.lines[ln - 1] + col

    def handle_starttag(self, tag, attrs):
        s = self._off()
        raw = self.get_starttag_text()
        n = Node("el", s, s + len(raw), tag=tag, attrs=attrs, tag_end=s + len(raw))
        self._close_prev(s)
        self._add_el(n)
        if tag not in VOID and not raw.endswith("/>"):
            self.stack.append(n)

    def handle_startendtag(self, tag, attrs):
        s = self._off()
        raw = self.get_starttag_text()
        n = Node("el", s, s + len(raw), tag=tag, attrs=attrs, tag_end=s + len(raw))
        self._close_prev(s)
        self._add_el(n)

    def _close_prev(self, s):
        if self.events and self.events[-1].end < 0:
            self.events[-1].end = s

    def _add_el(self, n):
        n.parent = self.stack[-1]
        self.stack[-1].children.append(n)
        self.events.append(n)

    def handle_endtag(self, tag):
        s = self._off()
        self._close_prev(s)
        e = self.src.index(">", s) + 1
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                for el in self.stack[i + 1:]:
                    el.close_start = el.close_end = -1
                el = self.stack[i]
                el.close_start, el.close_end, el.end = s, e, e
                del self.stack[i:]
                break
        marker = Node("other", s, e)
        self.events.append(marker)

    def _textish(self, kind, data=""):
        s = self._off()
        if kind == "text" and self.events and self.events[-1].kind == "text" and self.events[-1].end < 0:
            return  # merged into the open text node (data / entity / charref run)
        self._close_prev(s)
        n = Node(kind, s, -1, data=data)
        n.parent = self.stack[-1]
        self.stack[-1].children.append(n)
        self.events.append(n)

    def handle_data(self, data):
        self._textish("text")

    def handle_entityref(self, name):
        self._textish("text")

    def handle_charref(self, name):
        self._textish("text")

    def handle_comment(self, data):
        self._textish("comment", data)

    def handle_decl(self, decl):
        self._textish("other")

    def handle_pi(self, data):
        self._textish("other")

    def unknown_decl(self, data):
        self._textish("other")

    def finish(self):
        self.close()
        self._close_prev(len(self.src))
        for n in self.events:
            if n.end < 0:
                n.end = len(self.src)
        return self.root


def parse(src: str) -> Node:
    p = _P(src)
    p.feed(src)
    return p.finish()


# ---------------------------------------------------------------- units
@dataclass
class Occ:
    kind: str          # text | attr | title | jsonld
    start: int         # span replaced in the source (attr: the value inside quotes)
    end: int
    text: str          # English, normalised (plain: decoded; fragment: raw HTML)
    is_html: bool
    context: str
    section: str
    page: str
    quote: str = '"'   # attr: the quote character around the value


WS = re.compile(r"\s+")
TAG_RE = re.compile(r"<\s*(/?)\s*([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>")


def norm(s: str) -> str:
    return WS.sub(" ", s).strip()


def chain_of(node):
    out = []
    n = node
    while n is not None and n.tag != "#root":
        out.append((n.tag, n.classes, n.attr("id")))
        n = n.parent
    return out[::-1]


def section_of(node):
    n = node
    while n is not None and n.tag != "#root":
        if n.tag in ("section", "header", "footer", "nav", "form") and n.attr("id"):
            return n.attr("id")
        if n.tag in ("header", "footer", "head"):
            return n.tag
        n = n.parent
    return "page"


def describe(node, is_html):
    ch = chain_of(node)
    tags = [t for t, _, _ in ch]
    cls = set(c for _, cs, _ in ch for c in cs)
    t = node.tag
    if "navmenu" in cls:
        what = "navigation menu item"
    elif t in ("h1",):
        what = "page heading"
    elif t == "h2":
        what = "section heading"
    elif t == "h3":
        what = "card / sub-section heading"
    elif "btn" in cls or "card-button" in cls or t == "button" or "button" in tags or "chip-link" in cls:
        what = "button"
    elif "tag-cloud" in cls:
        what = "keyword tag (short)"
    elif t == "time" or "cv-date" in cls or "timeline-date" in cls:
        what = "date"
    elif t == "label":
        what = "form field label"
    elif t == "dt":
        what = "fact label"
    elif t == "dd":
        what = "fact value"
    elif "figcaption" in tags:
        what = "figure caption (keep the credit and its links as they are)"
    elif "card-kicker" in cls:
        what = "small label above a card"
    elif "cv-venue" in cls:
        what = "venue (place names stay)"
    elif "cv-title" in cls:
        what = "list entry (award / service)"
    elif "timeline-org" in cls:
        what = "organisation line"
    elif "brand-lockup" in cls:
        what = "subtitle under the name in the sidebar"
    elif "hero-role" in cls:
        what = "role line under the name"
    elif "skip-link" in cls:
        what = "skip link (keyboard users)"
    elif "visually-hidden" in cls:
        what = "screen-reader-only text"
    elif t == "li":
        what = "list item"
    elif t == "p" or "p" in tags:
        what = "paragraph"
    else:
        what = t
    return what


def _attr_span(src, node, name):
    raw = src[node.start:node.tag_end]
    m = re.search(r"\s" + re.escape(name) + r"\s*=\s*(\"([^\"]*)\"|'([^']*)')", raw, flags=re.I)
    if not m:
        return None
    g = 2 if m.group(2) is not None else 3
    return node.start + m.start(g), node.start + m.end(g), m.group(1)[0]


def _skip_markers(children):
    """Yield children, dropping everything inside <!-- i18n:x --> ... <!-- /i18n:x --> blocks."""
    depth = 0
    for c in children:
        if c.kind == "comment":
            m = MARK_RE.match(c.data)
            if m:
                depth += -1 if m.group(1) else 1
                continue
        if depth == 0:
            yield c


def _decorative(src, n):
    if n.kind == "comment" or n.kind == "other":
        return True
    if n.kind == "text":
        return not src[n.start:n.end].strip()
    if n.tag == "i" and "bi" in n.classes:
        return True
    if n.tag == "img":
        return True
    return False


def _is_inline(n):
    if n.kind != "el":
        return True
    if "figure-credit" in n.classes:   # a credit line is its own unit, apart from the caption sentence
        return False
    return n.tag in INLINE


def units_of(src: str, page: str):
    """Every translatable occurrence in a page, in source order, plus the list of skipped strings."""
    root = parse(src)
    occs, skipped = [], []

    def add_text(node_for_ctx, first, last, run):
        s, e = first.start, last.end
        raw = src[s:e]
        has_tags = any(n.kind == "el" for n in run[run.index(first):run.index(last) + 1])
        txt = norm(raw) if has_tags else norm(html.unescape(raw))
        plain = norm(html.unescape(TAG_RE.sub("", raw)))
        why = keep(plain, chain_of(node_for_ctx))
        if why:
            skipped.append((page, plain, why))
            return
        occs.append(Occ("text", s, e, txt, has_tags, describe(node_for_ctx, has_tags), section_of(node_for_ctx), page))

    def attrs_of(n):
        if n.kind != "el":
            return
        for name in ("alt", "title", "aria-label", "placeholder"):
            v = n.attr(name)
            if v is None or not v.strip():
                continue
            sp = _attr_span(src, n, name)
            if not sp:
                continue
            txt = norm(html.unescape(v))
            why = keep(txt, chain_of(n))
            if why:
                skipped.append((page, txt, why))
                continue
            ctx = {"alt": "image alt text (describes the image for screen readers)", "title": "tooltip",
                   "aria-label": "screen-reader label", "placeholder": "input placeholder"}[name]
            occs.append(Occ("attr", sp[0], sp[1], txt, False, ctx + f" on <{n.tag}>", section_of(n), page, sp[2]))

    def walk_attrs(n):
        """Attributes of every element below n (used for nodes not inside a text unit)."""
        attrs_of(n)

    def process(el):
        if el.kind != "el" or el.tag in SKIP:
            return
        kids = list(_skip_markers(el.children))
        runs, cur = [], []
        for c in kids:
            if c.kind == "el" and (not _is_inline(c) or c.tag in SKIP):
                if cur:
                    runs.append(cur)
                    cur = []
                runs.append([c])
            else:
                cur.append(c)
        if cur:
            runs.append(cur)
        for run in runs:
            if len(run) == 1 and run[0].kind == "el" and (not _is_inline(run[0]) or run[0].tag in SKIP):
                attrs_of(run[0])
                process(run[0])
                continue
            direct = [c for c in run if c.kind == "text" and src[c.start:c.end].strip()]
            if direct:
                kept = [c for c in run if not _decorative(src, c)]
                first, last = kept[0], kept[-1]
                add_text(el, first, last, run)
                for c in run:                 # decorative siblings outside the unit (icons) may carry labels
                    if c.kind == "el" and (c.end <= first.start or c.start >= last.end):
                        attrs_of(c)
            else:
                for c in run:
                    if c.kind == "el":
                        attrs_of(c)
                        process(c)

    # head: title, meta, JSON-LD
    def find(n, tag):
        if n.kind == "el" and n.tag == tag:
            yield n
        for c in n.children:
            yield from find(c, tag)

    for t in find(root, "title"):
        s, e = t.inner
        occs.append(Occ("title", s, e, norm(html.unescape(src[s:e])), False, "browser tab / search result title", "head", page))
    META = {"description": "meta description (search results)", "og:title": "link-preview title", "og:description": "link-preview description",
            "og:image:alt": "link-preview image alt text", "twitter:title": "link-preview title (X/Twitter)",
            "twitter:description": "link-preview description (X/Twitter)", "twitter:image:alt": "link-preview image alt text (X/Twitter)"}
    for m in find(root, "meta"):
        k = m.attr("name") or m.attr("property")
        if k in META:
            sp = _attr_span(src, m, "content")
            occs.append(Occ("attr", sp[0], sp[1], norm(html.unescape(m.attr("content"))), False, META[k], "head", page, sp[2]))
    for sc in find(root, "script"):
        if sc.attr("type") == "application/ld+json":
            s, e = sc.inner
            body = src[s:e]
            for k in ("jobTitle", "description"):
                mm = re.search(r'"%s"\s*:\s*("(?:[^"\\]|\\.)*")' % k, body)
                if mm:
                    occs.append(Occ("jsonld", s + mm.start(1), s + mm.end(1), json.loads(mm.group(1)), False,
                                    f"structured data for search engines ({k})", "head", page))
    for c in root.children:
        if c.kind == "el" and c.tag == "html":
            for b in c.children:
                if b.kind == "el" and b.tag == "body":
                    process(b)
    occs.sort(key=lambda o: o.start)
    return occs, skipped


# ---------------------------------------------------------------- keys
def slug(text, n=6):
    plain = norm(html.unescape(TAG_RE.sub(" ", text))).lower()
    words = re.findall(r"[a-z0-9]+", plain)
    s = "-".join(words[:n])[:48].strip("-")
    return s or "x"


def assign_keys(all_occs, previous: dict | None = None):
    """Map English text -> key. Identical text shares one key. Keys from a previous en.json are kept."""
    prev_by_text = {}
    for k, v in (previous or {}).items():
        prev_by_text.setdefault(v["text"], k)
    used = set()
    text_key, ctx = {}, {}
    for o in all_occs:
        if o.text in text_key:
            ctx[text_key[o.text]].add(f"{o.page} #{o.section}: {o.context}")
            continue
        k = prev_by_text.get(o.text)
        if k is None or k in used:
            pg = "home" if o.page == "index.html" else "links"
            sec = o.section if o.section not in ("page",) else "page"
            if sec in ("header", "navmenu", "footer"):
                pg = "common"
            base = f"{pg}.{sec}.{slug(o.text)}"
            k, i = base, 2
            while k in used:
                k = f"{base}-{i}"
                i += 1
        used.add(k)
        text_key[o.text] = k
        ctx[k] = {f"{o.page} #{o.section}: {o.context}"}
    return text_key, ctx


def tag_signature(fragment: str):
    """Multiset of tags (with attributes, normalised) in a fragment; translations must keep it."""
    sig = []
    for m in TAG_RE.finditer(fragment):
        close, name, rest = m.group(1), m.group(2).lower(), m.group(3)
        attrs = sorted(re.findall(r"([a-zA-Z-:]+)\s*=\s*(\"[^\"]*\"|'[^']*')", rest))
        sig.append((close, name, tuple(attrs)))
    return sorted(sig)


PH_RE = re.compile(r"\{[a-z_]+\}")


def placeholders(s: str):
    return sorted(PH_RE.findall(s))


def load_json(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def dump_json(obj, p: Path):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def extract_all(site: Path = SITE, previous: dict | None = None):
    """The full English catalogue {key: {text, context}} plus per-page occurrences and skipped strings."""
    all_occs, skipped, per_page = [], [], {}
    for pg in PAGES:
        src = (site / pg).read_text(encoding="utf-8")
        occs, sk = units_of(src, pg)
        per_page[pg] = (src, occs)
        all_occs += occs
        skipped += sk
    text_key, ctx = assign_keys(all_occs, previous)
    cat = {}
    for o in all_occs:
        k = text_key[o.text]
        if k not in cat:
            cat[k] = {"text": o.text, "context": ""}
    for k in cat:
        c = sorted(ctx[k])
        frag = "<" in cat[k]["text"] and TAG_RE.search(cat[k]["text"])
        cat[k]["context"] = "; ".join(c) + ("; HTML fragment: keep every tag and attribute exactly, move them with the words they wrap" if frag else "")
    for k, (t, c) in UI_STRINGS.items():
        cat[k] = {"text": t, "context": c}
    return cat, text_key, per_page, skipped
