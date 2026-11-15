# Native language labels

These small Noto Sans subsets make the language picker readable on devices
without the corresponding scripts installed. They contain the supported
glyphs from `中文हिन्दीالعربيةবাংলা日本語한국어`; they are not full page fonts.
All six fonts together are approximately 29 KB before HTTP compression.

Sources: Google Fonts' CSS2 subsetting service, weight 400, `display=swap`,
families Noto Sans Arabic, Bengali, Devanagari, JP, KR and SC. Retrieved
2026-11-14. The files are TrueType subsets supplied by that service. Each
font's copyright and SIL Open Font License are preserved in `OFL-<code>.txt`,
from the corresponding `ofl/notosans*` directory in
https://github.com/google/fonts.

CSS uses separate `I18n Menu ...` family aliases scoped to the picker so these
label-only fonts cannot accidentally replace the page's text fonts.
