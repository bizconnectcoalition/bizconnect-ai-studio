"""Key a character off a flat MAGENTA (#FF00FF) background -> trimmed transparent PNG, 640 px tall.
Same recipe as Bloom (PREVIEW_MEDIA.md): alpha from min(R,B) - G, despill, 1 px erode + blur, crop, resize.
Background = magenta connected to the border plus enclosed pockets that are magenta on average.
Usage: python key_magenta.py in.jpg out.png"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

src, dst = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
R, G, B = im[..., 0], im[..., 1], im[..., 2]
score = np.minimum(R, B) - G                       # ~255 on magenta, ~0..40 on skin/hair/cloth

# background = strong magenta connected to the border (holes inside the figure are kept)
strong = score > 90
lab, _ = ndimage.label(strong)
border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
bg = np.isin(lab, border[border > 0])
# enclosed gaps (arm on hip, behind hair, a brush's hanging hole): a pocket counts as background when it is
# magenta on average, so a small fuchsia detail (lipstick, a flower) inside the figure is not punched out
pockets, n = ndimage.label(score > 60)
if n:
    means = ndimage.mean(score, pockets, index=np.arange(1, n + 1))
    sizes = ndimage.sum(np.ones_like(score), pockets, index=np.arange(1, n + 1))
    keep = np.zeros(n + 1, bool)
    keep[1:] = (means > 120) & (sizes > 30)
    bg |= keep[pockets]

# soft edge: in a 3 px band around the background, alpha ramps with the magenta score
band = ndimage.binary_dilation(bg, iterations=3) & ~bg
alpha = np.ones_like(score)
alpha[bg] = 0
ramp = 1 - np.clip((score - 25) / (110 - 25), 0, 1)
alpha[band] = ramp[band]

# despill: pull magenta tint out of edge pixels (R and B down toward G)
edge = ndimage.binary_dilation(bg, iterations=5) & ~bg
spill = np.clip(np.minimum(R, B) - G, 0, None)
out = im.copy()
k = np.where(edge | (spill > 30), 1.0, 0.0)          # also magenta seen through hair strands (skin blush ~14)
out[..., 0] -= spill * k * 0.85
out[..., 2] -= spill * k * 0.85
out = np.clip(out, 0, 255)

a = Image.fromarray((alpha * 255).astype(np.uint8))
a = a.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))   # 1 px erode + blur
rgba = Image.fromarray(out.astype(np.uint8)).convert("RGBA")
rgba.putalpha(a)
bbox = rgba.getbbox()
rgba = rgba.crop(bbox)
h = 640
rgba = rgba.resize((round(rgba.width * h / rgba.height), h), Image.LANCZOS)
rgba.save(dst, optimize=True)
print(dst, rgba.size)
