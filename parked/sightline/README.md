# The sightline — parked, not deleted

Tanmay asked on 2026-09-25 to keep this off the live page for now. **Nothing was
deleted.** The section's markup lives in `section.html` next to this file, and
every other piece of it is exactly where it was.

## What this feature is

Two coupled instruments that share one number:

- **The spectrum** (`assets/js/spectrum.js`) — the O VI λλ1031.93, 1037.62
  doublet computed live from a Voigt–Hjerting profile (Tepper-García 2006) with
  atomic data from VPFIT's `atom.dat` (Morton 2003), convolved with a Gaussian
  LSF at R ≈ 18,000 and given Poisson noise at S/N ≈ 14. Two real range inputs
  drive it. Dragging column density shows saturation happen: the depth ratio
  runs 1.98:1 at log N 12.5 down to 1.00:1 at 15.5.
- **The map** (`assets/js/sightline.js`) — an analytic β-model halo
  (β = 0.77, r_c = 0.25 R_vir) whose density carries an exponential cut-off at
  1.9 R_vir, integrated numerically along each line of sight, with 0.30 dex of
  lognormal scatter, coloured by matplotlib magma. A draggable quasar sightline
  reads a column density off the map and writes it into the spectrum's own
  range input, so there is one source of truth rather than two.

When the two views *cannot* agree, the panel says so out loud. Both of those
paths are deliberate — do not tidy them away on restore:

- **Below the instrument's floor.** About a third of the frame sits under the
  spectrum's log N 12.5 minimum, because the truncated halo really does run out
  of gas out there. The value is clamped and the probe states the held number
  instead of pretending the spectrum shows what the map does.
- **A hand-moved slider detaches the beam.** Dragging the column-density
  control directly makes the readout say the spectrum is set by hand and no
  longer matches the sightline, and tells the reader to move the beam to
  re-link them.

Neither uses simulation data. `tools/bake-tng.py` is the offline script that
would replace the analytic map with a real TNG50-1 snapshot; it needs a TNG API
key, and the caption says "Analytic, not a snapshot" until that happens.

## What was removed from `index.html`

Four things, and only these:

1. The `<section id="sightline">` block — now `section.html` here.
2. The `<svg id="ovi-rail">` element that sat just before `<main>` — appended to
   the end of `section.html`.
3. The sidebar nav item:
   `<li><a href="#sightline">…<span>Sightline</span></a></li>`, which sat
   between Research and Past Projects.
4. Two `<script>` tags, which sat immediately after the GSAP tags:
   ```html
   <script src="assets/js/spectrum.js?v=1" defer></script>
   <script src="assets/js/sightline.js?v=4" defer></script>
   ```

## What was deliberately left alone

- `assets/js/spectrum.js` and `assets/js/sightline.js` — untouched, just not
  loaded. Both are self-terminating: each returns immediately if its markup is
  absent, so re-adding the script tags without the markup is harmless.
- `tools/bake-tng.py` — untouched.
- All the CSS. The `.ovi-*`, `.sightline` and `.visually-hidden` rules are still
  in `assets/css/snapfolio-astro.css`. They match nothing now, so they cost one
  selector match per rule and change no pixel. They were left in place because
  removing and later restoring hand-written CSS across a 3,300-line file is the
  step most likely to lose a detail — several of those rules encode measured
  fixes (the 1660px rail gate, the 4.65em anti-reflow floor, the print rules,
  the forced-colors handling) that would be expensive to rediscover.
  `.visually-hidden` in particular is a general utility and may be used by
  other markup later.

## To put it back

1. Paste `section.html`'s section block into `index.html` immediately before
   `<section id="past-projects">`, and its trailing `<svg id="ovi-rail">`
   immediately before `<main id="main">`.
2. Restore the nav item between Research and Past Projects.
3. Restore the two script tags after the GSAP tags. `sightline.js` must come
   after `spectrum.js` — it drives the spectrum through that instrument's own
   range input, so the input's listeners have to exist when the map first
   places its beam.
4. Bump the `?v=` on both, since the previous versions are in browser caches.

Nothing else is needed; the CSS is already there.
