# Erzeugt mac/icon.icns (blaues App-Symbol mit Haken). Einmalig ausführen: python3 mac/make-icon.py
# ICNS-Einträge enthalten PNG-Daten (ic07–ic10), das versteht macOS seit 10.7.
import io
import struct
from pathlib import Path

from PIL import Image, ImageDraw

S = 1024
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
# macOS-Symbolraster: Fläche ca. 824 px mit Rand
m = 100
d.rounded_rectangle([m, m, S - m, S - m], radius=185, fill=(29, 91, 184, 255))
# Haken
d.line([(330, 530), (460, 660), (720, 380)], fill=(255, 255, 255, 255), width=96, joint="curve")
for x, y in [(330, 530), (720, 380)]:
    d.ellipse([x - 48, y - 48, x + 48, y + 48], fill=(255, 255, 255, 255))

entries = b""
for ostype, size in [(b"ic07", 128), (b"ic08", 256), (b"ic09", 512), (b"ic10", 1024)]:
    buf = io.BytesIO()
    img.resize((size, size), Image.LANCZOS).save(buf, "PNG")
    data = buf.getvalue()
    entries += ostype + struct.pack(">I", len(data) + 8) + data
icns = b"icns" + struct.pack(">I", len(entries) + 8) + entries
out = Path(__file__).with_name("icon.icns")
out.write_bytes(icns)

print("geschrieben:", out, len(icns), "Bytes")
