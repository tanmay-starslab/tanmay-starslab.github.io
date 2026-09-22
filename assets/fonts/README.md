# Fonts

Self-hosted, subset locally. No CDN: no third-party request, no referrer leak,
no GDPR question for EU collaborators, and no single point of failure.

| File | Source | Cut | Size |
|---|---|---|---|
| `source-serif-text.woff2` | Source Serif 4 | `opsz` pinned 11, `wght 300–700`, Latin + Latin-Ext-A + **Greek** | 108 KB |
| `source-serif-display.woff2` | Source Serif 4 | `opsz` pinned 52, `wght 400–700`, name/heading glyphs only | 26 KB |
| `source-serif-italic.woff2` | Source Serif 4 Italic | `opsz` pinned 11, `wght` pinned 400, Latin only | 29 KB |
| `fira-mono.woff2` | Fira Mono | Latin + Greek + punctuation | 23 KB |
| `obsmath.woff2` | STIX Two Math | 27 math glyphs no text font carries | 9 KB |

**Why two serif cuts instead of one variable file.** Keeping the `opsz` axis
live costs 134 KB on its own — a single roman with `opsz 8–60` is 246 KB
against 108 KB pinned. Two pinned cuts give real optical sizing at the two
sizes that exist on the page (19px body, 56px name) for 134 KB total.

**Licences.** All three families are SIL OFL 1.1; the licences are in this
directory. `obsmath.woff2` is a subset of STIX Two Math, whose OFL reserves
the name "STIX" — the internal `name` table records were rewritten to
"ObsMath", so the binary makes no claim to the reserved name.

**Rebuilding.** Verify glyph coverage in the binary before changing any
`unicode-range`; do not assume upstream coverage equals the served subset.
`--layout-features='*'` is load-bearing — pyftsubset's default retain-list
drops `tnum`, `onum` and `zero`.
