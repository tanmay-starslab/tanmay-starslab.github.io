# Multilingual site preview

Rendered in Chromium at a 390 px phone viewport. The labels above each
capture identify the page language. The existing animated background is
visible in these captures; its frame varies between images.

| Pages | English, Spanish, Chinese, Hindi, Arabic, French | Portuguese, Bengali, Russian, Japanese, German, Korean |
| --- | --- | --- |
| Homepage | [Screenshots](home-1.jpg) | [Screenshots](home-2.jpg) |
| Useful Links | [Screenshots](links-1.jpg) | [Screenshots](links-2.jpg) |

[The language menu on a desktop](language-menu.jpg) shows the self-hosted
script fonts and all twelve choices. The sidebar scrolls to reveal the full
menu when it is opened near the bottom.

The full browser run covers both pages in all twelve languages at 390 and
1440 px (48 combinations), plus boundary checks at 320, 768, 1199, 1200,
1280, 1499, 1500 and 1920 px for English, Arabic, German and Hindi.
All 638 assertions passed. These include localized theme buttons, contact
validation, BibTeX copying, phone card expansion, keyboard menu navigation,
section-preserving language switching, resource loading and page overflow.

Additional checks cover actual custom-font selection, browser-language
suggestions and dismissal, blocked storage, the animated desktop research
carousel, mocked contact-form sends and JavaScript-disabled navigation.
Existing English prose and extracted labels were compared with the base
commit and are unchanged. The localization build is reproducible: a second
run writes zero files.

These are software and rendering checks. Translations have not undergone
independent native-speaker certification. Existing figures retain their
original embedded text, and cited papers and many resource titles retain
their published names.
