# Fonts

Self-hosted, subset locally with fonttools. No CDN: no third-party request, no
referrer leak, no GDPR question for EU collaborators, no single point of failure.

| File | Source | Cut | Size |
|---|---|---|---|
| `plate-display.woff2` | Playfair (not Playfair Display) | `wdth` pinned 112.5, `wght 400–700`, `opsz 5–1200` kept, latin | 182 KB |
| `plate-display-greek.woff2` | GFS Didot | Greek + polytonic | 15 KB |
| `plate-text.woff2` | Literata | `wght 300–600`, `opsz 7–72`, latin | 177 KB |
| `plate-text-greek.woff2` | Literata | Greek + polytonic | 57 KB |
| `plate-mono.woff2` | JetBrains Mono | latin + Greek | 47 KB |
| `math-shim.woff2` | STIX Two Math | 14 glyphs no text font carries | 5 KB |

**Why Greek is delegated on the display face.** Playfair has **4 of 144** Greek
glyphs — verified in the binary, not assumed — so it cannot set ΛCDM, σ or λ.
GFS Didot (89/144 + 233/256 polytonic) is attached under the *same family name*
via `unicode-range`. Both are Didones, so the composite reads as one voice
rather than a fallback. Literata carries its own Greek (87/144) and needs no
delegation.

**Why `opsz 5–1200` is kept on the display face.** That range is not a typo and
is the whole point: at low optical sizes the hairlines thicken into a text
Didone, at high sizes they thin into a poster Didone. That is the register the
brief keeps gesturing at with "classier".

**Rejected for Greek coverage, with counts, so this is not re-litigated:**
Playfair Display 4/144 · Bodoni Moda 4 · Cormorant 4 · Fraunces 0 · Geist 6 ·
Satoshi 0 · Instrument Serif 0 · Instrument Sans 0 · Newsreader 0 · Spectral 3.

**Rebuilding.** Verify coverage in the binary before changing any
`unicode-range`; upstream coverage is not served-subset coverage.
`--layout-features='*'` is load-bearing — pyftsubset's default retain-list
drops `tnum`, `onum`, `smcp` and every stylistic set.
