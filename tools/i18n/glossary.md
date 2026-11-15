# Translation glossary and style

For whoever translates `locales/en.json` into `locales/<lang>.json` (es, zh-Hans, hi, ar, fr, pt, bn, ru, ja, de, ko).

## Format

- Copy the keys of `en.json`; give each one the translated text, either as `"key": "text"` or `"key": {"text": "..."}`.
  Do not add, drop or rename keys (`build.py --check` fails on missing or unknown keys).
- `context` says where the string appears (heading, button, tooltip, paragraph, nav ...). Keep buttons, nav items and
  tags short; the sidebar is narrow.
- **HTML fragments** (text containing tags): keep every tag and every attribute exactly as written (`href`, `target`,
  `rel`, `class`). You may move a tag, with the words it wraps, anywhere in the sentence. Keep entities valid
  (`&amp;`, `&nbsp;`). `build.py --check` compares the tags with English.
- **Placeholders** such as `{title}`, `{email}`, `{en_url}` stay exactly as written.
- `ui.suggest` is written in your language and names your language: "Read this page in English" becomes
  "Leer esta página en español", "日本語で読む", "اقرأ هذه الصفحة بالعربية". `ui.dismiss` is the close label in your language.

## Keep as they are (never translate)

- The owner's name, **Tanmay Singh**, in Latin letters everywhere (also "Hi! I am Tanmay" keeps "Tanmay").
- Institutions and places: Arizona State University (ASU), School of Earth and Space Exploration (SESE), IIT Delhi,
  Raman Research Institute (RRI), Royal Observatory Edinburgh, TIFR, Ladakh, Hanle, Lucknow ... A widely used local
  form may follow in parentheses on first mention if it helps (e.g. ja: アリゾナ州立大学 (Arizona State University)),
  but the link text keeps the official name.
- Simulations, surveys, codes, instruments: **TNG50**, TNG50-1, **IllustrisTNG**, SIMBA, EAGLE, FIRE, COS-IGrM,
  HST/COS, ERA5, CLOUDY, Trident, XGBoost, MURaM, BLOG, VS Code, Python, NumPy, OpenCV, AREPO, GADGET-4.
- Ions and lines: **O VI**, Mg II, C II λ1334, Si III λ1206, Lyα, Hα (Roman numerals, no translation, keep spacing).
- Units and numbers: kpc, km, mm, %, ±, 1,000 km, 90,000 sightlines. Use your language's digit grouping only if it
  stays unambiguous; keep Western digits (also in ar, hi, bn).
- Paper titles, author lists, journal names (ApJ, AJ, ApJL, The Astrophysical Journal), arXiv IDs, DOIs, URLs, emails
  (these are not in `en.json`; if one appears inside a fragment, leave it).
- Course codes: AST 531, AST 121.

## Terms

| English | Guidance |
|---|---|
| CGM, circumgalactic medium | Translate "circumgalactic medium" at its first mention on a page with the acronym after it, e.g. es "medio circungaláctico (CGM)"; afterwards keep **CGM** as the acronym (do not localise it to MCG etc.). Same for IGM (intergalactic medium). |
| intra-group medium | es medio intragrupo, fr milieu intra-groupe, de Intragruppenmedium, ja 群内ガス, zh 星系群内介质 |
| quasar absorption spectra, sightlines | standard astronomy terms in your language (es espectros de absorción de cuásares, líneas de visión) |
| covering fraction | es fracción de cobertura, fr fraction de couverture, de Bedeckungsanteil, ja 被覆率, zh 覆盖率 |
| cosmological simulations | es simulaciones cosmológicas, ja 宇宙論的シミュレーション, zh 宇宙学模拟 |
| Ph.D. student / PhD student | Use the usual title style of your language: es estudiante de doctorado, fr doctorant, de Doktorand, pt doutorando, ru аспирант, ja 博士課程学生, zh 博士研究生, ko 박사과정 학생, hi पीएच.डी. शोधार्थी, bn পিএইচডি গবেষক, ar طالب دكتوراه. "Fourth Year Ph.D. Student" = fourth-year doctoral student in that style. |
| B.Tech, Engineering Physics | Keep "B.Tech" (an Indian degree name); translate "Engineering Physics". |
| Prof., Dr. | Use the local honorific form (es Prof., Dr.; de Prof., Dr.; ja 教授 after the name if natural; zh 教授). Names stay Latin. |
| Light mode / Dark mode / Reduce motion | short UI labels, as in operating-system settings of your language |
| Plate I | not translated (kept as a name) |
| Useful Links | short, as a menu item |

## Tone

Warm, professional, first person, as in English ("I study ...", "I would be happy to connect"). Plain words over
jargon outside the research descriptions. For languages with politeness levels use the polite but not stiff
register: es/pt/fr: neutral; fr address the reader as *vous*; de *Sie*; ja です・ます; ko 해요체 / 합니다 for headings; hi/bn
आप / আপনি; ru вы. No exclamation marks beyond the one in "Hi!". No dot separators (·, •) anywhere.

## Script and direction

- ar is right-to-left (`dir="rtl"`); keep Latin names and numbers in their natural order inside the sentence.
- zh-Hans is Simplified Chinese. ja/zh: no spaces between words; use full-width punctuation (，。：) in running text,
  but keep half-width inside numbers, units and names.
