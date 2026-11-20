"""Subset bootstrap-icons to the glyphs the site uses: python3 subset_icons.py <repo>"""
import re, subprocess, sys, pathlib
root = pathlib.Path(sys.argv[1]); v = root / "assets/vendor/bootstrap-icons"
files = [p for p in root.glob("*.html")] + list(root.glob("*/index.html")) + list(root.glob("*/useful-links.html")) + list((root / "assets/js").glob("*.js"))
used = sorted({m for p in files for m in re.findall(r"\bbi-[a-z0-9-]+", p.read_text(encoding="utf-8"))})
css = (v / "bootstrap-icons.css").read_text()
rules = dict(re.findall(r'\.(bi-[a-z0-9-]+)::before \{ content: "\\([0-9a-f]+)"; \}', css))
missing = [u for u in used if u not in rules]
assert not missing, missing
head = css[:css.index('.bi-123::before')]
head = head.replace('bootstrap-icons.woff2?e34853135f9e39acf64315236852cd5a', 'bootstrap-icons-subset.woff2').replace(',\nurl("./fonts/bootstrap-icons.woff?e34853135f9e39acf64315236852cd5a") format("woff")', '')
out = head.replace('/*!', '/*! Subset of', 1) + "".join(f'.{u}::before {{ content: "\\{rules[u]}"; }}\n' for u in used)
(v / "bootstrap-icons-subset.css").write_text(out)
uni = ",".join("U+" + rules[u] for u in used)
subprocess.run(["pyftsubset", str(v / "fonts/bootstrap-icons.woff2"), f"--unicodes={uni}", "--flavor=woff2", "--layout-features=", "--no-hinting",
                f"--output-file={v / 'fonts/bootstrap-icons-subset.woff2'}"], check=True)
print(len(used), "glyphs:", " ".join(used))
