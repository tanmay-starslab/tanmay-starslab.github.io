# Tanmay Singh Academic Website

Static GitHub Pages website for `https://tanmay-starslab.github.io/`.

The live site is a custom one-page academic astrophysics portfolio adapted from the BootstrapMade SnapFolio visual direction. It is served directly from the repository root with `.nojekyll`; the old AcademicPages/Jekyll source files are retained only as content/archive references unless explicitly removed.

## Current Site Structure

- `index.html` - main one-page academic website.
- `useful-links.html` - static Useful Links page migrated from the old website.
- `assets/css/snapfolio-astro.css` - custom dark astrophysics UI, responsive layout, glass panels, mobile navigation, and background layers.
- `assets/js/snapfolio-astro.js` - navigation behavior, intro transition, reveal effects, timeline progress, and interactive star/cosmic-web canvas.
- `assets/vendor/` - Bootstrap and Bootstrap Icons assets used by the static pages.
- `images/headshot_tanmay.jpeg` - profile photo used in the sidebar and hero.
- `images/boxImage_TNG100-1_stars-coldens_3840.png` - faint simulation/deep-field background layer.
- `images/milky_way.jpg`, `images/galaxy3.jpg`, `images/galaxy6.jpg` - project-card visual textures.
- `files/cv.pdf` - linked CV.

## Local Preview

From the repository root:

```bash
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000/
http://localhost:8000/useful-links.html
```

If port `8000` is already in use:

```bash
python3 -m http.server 8001
```

## Deployment

GitHub Pages is configured to serve from:

```text
branch: master
path: /
```

Typical update flow:

```bash
git status
git add <changed files>
git commit -m "Describe the website update"
git push origin website-redesign-snapfolio-astro
gh pr create --base master --head website-redesign-snapfolio-astro
gh pr merge <PR number> --merge
```

After merge, check Pages:

```bash
gh api repos/tanmay-starslab/tanmay-starslab.github.io/pages
```

## Notes

- Keep the BootstrapMade credit in the footer unless a paid license allows removal.
- Do not edit generated `_site/` output as the source of truth.
- Do not reintroduce demo AcademicPages publications, talks, or portfolio items as real content.
- Prefer root static pages and the SnapFolio assets for future visible website changes.
