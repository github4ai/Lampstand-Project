from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "build-assets"
OUT.mkdir(exist_ok=True)

scale = 4
size = 256
image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=60, fill="#101c2e")

def line(points, fill, width):
    draw.line([(x * scale, y * scale) for x, y in points], fill=fill, width=width * scale, joint="curve")

for points in [[(32, 5), (32, 11)], [(17, 10), (21, 15)], [(47, 10), (43, 15)], [(8, 23), (14, 25)], [(56, 23), (50, 25)], [(11, 38), (17, 36)], [(53, 38), (47, 36)]]:
    line(points, "#8ddcff", 3)

# Outer and inner flame silhouettes, faithful to the app's SVG brand mark.
draw.polygon([(32*scale, 13*scale), (27*scale, 19*scale), (23*scale, 25*scale), (23*scale, 31*scale), (26*scale, 36*scale), (32*scale, 38*scale), (38*scale, 36*scale), (41*scale, 31*scale), (41*scale, 26*scale), (37*scale, 19*scale)], fill="#f3c969")
draw.ellipse((28*scale, 24*scale, 36*scale, 33*scale), fill="#fff4c7")

draw.polygon([(18*scale, 40*scale), (46*scale, 40*scale), (43*scale, 49*scale), (21*scale, 49*scale)], fill="#50c9ee", outline="#b9ecff")
line([(32, 49), (32, 56)], "#f3c969", 3)
line([(25, 57), (39, 57)], "#f3c969", 3)

png = OUT / "lampstand-studio.png"
ico = OUT / "lampstand-studio.ico"
image.save(png)
image.save(ico, format="ICO", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print(ico)
