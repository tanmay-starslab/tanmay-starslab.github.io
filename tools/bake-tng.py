#!/usr/bin/env python3
"""Bake an O VI column-density map from TNG50-1 into a 16-bit-packed WebP.

Run ONCE, offline, by hand. Nothing here ships to the browser and the API key
never leaves this machine — the TNG API 403s without one, so a key in client JS
would be both a leak and useless.

    export TNG_API_KEY=...          # https://www.tng-project.org/users/register/
    python3 tools/bake-tng.py --subhalo 476266 --pixels 1024

What it writes:
    data/ovi-colmap-1024.webp   ~250 KB
    data/ovi-colmap-512.webp    ~70 KB
    data/ovi-colmap.json        the metadata the caption is built from

Why a packed PNG-style encoding and not a picture: the browser needs the
NUMBERS. log N is packed 16-bit across the R and G channels so the page can
decode a real column density under the cursor and drive the absorption-line
instrument from it. Shipping a pre-coloured image would leave the readout with
nothing to read, and a readout that invents its number is worse than no readout.

    u16  = round(clip((logN - 12.0) / (15.5 - 12.0), 0, 1) * 65535)
    R    = u16 >> 8 ;  G = u16 & 0xFF ;  B = 0
    logN = 12.0 + 3.5 * (R*256 + G) / 65535

B stays 0 as an explicit "no data" channel: u16 == 0 means the sightline never
crossed gas above the floor, and the shader/JS must render that as background
rather than as log N = 12.
"""

import argparse
import json
import os
import sys

API = "https://www.tng-project.org/api/TNG50-1/snapshots/99/subhalos/%d/"

# sphMap over ALL FoF gas is the CGM. The default (bound particles only) gives
# the galaxy and throws away the halo, which is the entire subject.
QUERY = ("vis.hdf5?partType=gas&partField=O_VI&method=sphMap"
         "&size=%(size)s&sizeType=rVirial&nPixels=%(n)d,%(n)d&axes=0,1"
         "&colorbars=False&title=False&labelZ=False&labelScale=False&labelSim=False")

LO, HI = 12.0, 15.5          # the packing range, in log10(cm^-2)


def fetch(subhalo, pixels, size, key, out):
    import requests
    url = (API % subhalo) + (QUERY % {"n": pixels, "size": size})
    r = requests.get(url, headers={"api-key": key}, timeout=600)
    r.raise_for_status()
    with open(out, "wb") as f:
        f.write(r.content)
    return out


def pack(hdf5_path, pixels):
    import numpy as np
    import h5py
    with h5py.File(hdf5_path, "r") as f:
        # The dataset name varies with the API version; take the only 2-D
        # float grid rather than guessing a key that may have been renamed.
        grids = []

        def visit(name, obj):
            if isinstance(obj, h5py.Dataset) and obj.ndim == 2 and obj.dtype.kind == "f":
                grids.append((name, obj[...]))
        f.visititems(visit)
    if not grids:
        raise SystemExit("no 2-D float grid in %s — inspect it by hand" % hdf5_path)
    name, grid = max(grids, key=lambda g: g[1].size)
    print("  using dataset %s %s" % (name, grid.shape))

    import numpy as np
    grid = np.nan_to_num(grid, nan=0.0, posinf=0.0, neginf=0.0)
    empty = grid <= 0
    logn = np.log10(np.clip(grid, 10 ** LO, None))
    u16 = (np.clip((logn - LO) / (HI - LO), 0, 1) * 65535).astype(np.uint16)
    u16[empty] = 0
    rgb = np.dstack([(u16 >> 8).astype(np.uint8),
                     (u16 & 0xFF).astype(np.uint8),
                     np.zeros(u16.shape, np.uint8)])
    return rgb, float(np.percentile(logn[~empty], 99.5)) if (~empty).any() else HI


def write_webp(rgb, path, size):
    from PIL import Image
    im = Image.fromarray(rgb, "RGB")
    if im.size[0] != size:
        # NEAREST, never a smooth filter: interpolating the high byte against
        # the low byte of a packed integer produces column densities that were
        # never in the simulation. Downsample the FIELD, not the encoding.
        im = im.resize((size, size), Image.NEAREST)
    # lossless is not optional. WebP's lossy mode would quantise the low byte,
    # i.e. add up to +/-0.01 dex of pure fiction to every pixel.
    im.save(path, "WEBP", lossless=True, quality=100, method=6)
    print("  wrote %s  %.0f KB" % (path, os.path.getsize(path) / 1024))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--subhalo", type=int, required=True)
    ap.add_argument("--pixels", type=int, default=1024)
    ap.add_argument("--size", default="2.5", help="in units of R_vir")
    ap.add_argument("--hdf5", default="ovi.hdf5")
    args = ap.parse_args()

    key = os.environ.get("TNG_API_KEY")
    if not key:
        sys.exit("TNG_API_KEY is not set. Register at "
                 "https://www.tng-project.org/users/register/ — the API 403s without it.")

    if not os.path.exists(args.hdf5):
        print("fetching subhalo %d ..." % args.subhalo)
        fetch(args.subhalo, args.pixels, args.size, key, args.hdf5)

    rgb, p995 = pack(args.hdf5, args.pixels)
    os.makedirs("data", exist_ok=True)
    write_webp(rgb, "data/ovi-colmap-1024.webp", 1024)
    write_webp(rgb, "data/ovi-colmap-512.webp", 512)

    meta = {
        "simulation": "IllustrisTNG TNG50-1",
        "snapshot": 99,
        "redshift": 0.0,
        "subhalo": args.subhalo,
        "field": "O VI column density",
        "method": "sphMap over all FoF gas",
        "extent_rvir": float(args.size),
        "pack": {"lo": LO, "hi": HI, "channels": "R<<8 | G", "zero": "no data"},
        "p99_5_logN": p995,
        # TNG's O VI is post-processed from an ionisation table and is known to
        # under-produce O VI relative to COS-Halos. Saying so in the caption is
        # the difference between a figure and an overclaim.
        "caveat": ("O VI abundances are post-processed from a photoionisation table; "
                   "TNG is known to under-produce O VI relative to COS-Halos."),
        "cite": ["Nelson et al. 2019a", "Pillepich et al. 2019"],
    }
    with open("data/ovi-colmap.json", "w") as f:
        json.dump(meta, f, indent=2)
    print("  wrote data/ovi-colmap.json")
    print("\nTNG registration carries an acknowledgement expectation — the page "
          "must cite Nelson et al. 2019a and Pillepich et al. 2019 in visible text.")


if __name__ == "__main__":
    main()
