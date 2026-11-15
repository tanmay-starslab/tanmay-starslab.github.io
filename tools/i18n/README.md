# Main-site languages

The homepage and Useful Links page are available in English, Spanish,
Simplified Chinese, Hindi, Arabic, French, Portuguese (Brazilian), Bengali,
Russian, Japanese, German and Korean. English lives at `/`; translated pages
live at `/es/`, `/zh-Hans/`, `/hi/`, `/ar/`, `/fr/`, `/pt/`, `/bn/`, `/ru/`,
`/ja/`, `/de/` and `/ko/`. Each also has a `useful-links.html` page.

The English HTML and the JSON catalogues are the sources. Generated pages
are committed for GitHub Pages; no translation service or API key is needed
to build or serve them. Python 3 with the standard library is sufficient.

## Updating content

1. Edit the English `index.html` or `useful-links.html`.
2. Run `python3 tools/i18n/extract.py` to refresh `locales/en.json`.
3. Update the same keys in all eleven translated catalogues. See
   [glossary.md](glossary.md) for terminology, HTML and placeholder rules.
4. Run `python3 tools/i18n/build.py` to regenerate pages and sitemap alternates.
5. Run the checks below, then review changed pages in a browser.

Do not edit generated language HTML directly. The builder maintains marked
`i18n:head`, `i18n:picker`, `i18n:note` and `i18n:script` blocks in both English
pages. Existing English prose and other markup remain the source of truth.
Keys of unchanged English strings remain stable. The current catalogue has
353 entries, including runtime controls and contact-form messages.

```sh
python3 tools/i18n/extract.py --check
python3 tools/i18n/build.py --check
python3 tools/i18n/verify.py
python3 -m unittest discover -s tools/i18n -p 'test_*.py'
python3 -m http.server 8080
```

Open `http://localhost:8080/` or a locale URL to preview. `build.py --check`
rejects stale English, missing/unknown keys, changed tags or placeholders and
stale generated output. `verify.py` also checks fragment nesting, local
resources and anchors, duplicate IDs, language pickers, canonical URLs and
hreflang/sitemap coverage. CI runs these checks for pull requests and pushes
to `master`. A normal build reports missing strings and falls back to English;
the strict checks must pass before merging.

## Visitor behavior

- The native `<details>` picker works without JavaScript. With scripting,
  Enter opens it, arrow keys move between links, and Escape closes it and
  returns focus without also closing the phone's navigation drawer.
- Switching language keeps the current page type and section anchor. A choice
  is remembered in local storage. No visit is automatically redirected.
- A first-time visitor can get one dismissible suggestion in their browser's
  supported language. An explicitly Traditional Chinese browser is not
  offered Simplified Chinese. Storage restrictions do not break navigation.
- Translated pages disclose machine translation and link to the English
  original. Names, paper titles, citations, instrument identifiers and units
  remain recognizable; many external resource/course titles remain English.
- Arabic text reads right to left. The sidebar keeps its established left
  position. The research carousel retains the left-offset geometry used by
  its animation, while individual Arabic cards read right to left.
- Script-specific Noto fonts for page content come from Google Fonts. Native
  names in the picker use tiny self-hosted subsets with their OFL licenses;
  see [the font notes](../../assets/fonts/i18n-menu/README.md).

## Review scope

This change covers `tanmaysingh.uk` and its Useful Links page. It does not
translate the separate `galaxies.tanmaysingh.uk` explorer, chat or films, nor
the text embedded in existing research-figure images.

Translations received an automated content/terminology review and rendered
browser checks; they have not been certified by independent native speakers.
The English original remains available on every translated page.
