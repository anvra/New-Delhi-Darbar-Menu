import sys
import subprocess

def install(package):
    subprocess.check_call([sys.executable, "-m", "pip", "install", package])

try:
    import qrcode
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    install('qrcode[pil]')
    install('Pillow')
    import qrcode
    from PIL import Image, ImageDraw, ImageFont

# Data
url = "https://anvra.github.io/New-Delhi-Darbar-Menu/"
title = "New Delhi Darbar - Menu"
phone1 = "+91 75675 87816"
phone2 = "+91 97120 52249"

# Colors matching the new theme
bg_color = "#faf8f5"
qr_color = "#1a1816"
accent_color = "#e0824a"
muted_color = "#6b6460"

# Generate QR code
qr = qrcode.QRCode(
    version=1,
    error_correction=qrcode.constants.ERROR_CORRECT_H,
    box_size=15,
    border=2,
)
qr.add_data(url)
qr.make(fit=True)
qr_img = qr.make_image(fill_color=qr_color, back_color=bg_color).convert('RGB')

qr_w, qr_h = qr_img.size

# Canvas dimensions
canvas_w = qr_w + 160
canvas_h = qr_h + 300

# Create canvas
canvas = Image.new('RGB', (canvas_w, canvas_h), bg_color)
canvas.paste(qr_img, (80, 160))

draw = ImageDraw.Draw(canvas)

# Fonts
try:
    font_title = ImageFont.truetype("arialbd.ttf", 46)
    font_phone = ImageFont.truetype("arial.ttf", 32)
    font_scan = ImageFont.truetype("arial.ttf", 26)
except IOError:
    font_title = ImageFont.load_default()
    font_phone = ImageFont.load_default()
    font_scan = ImageFont.load_default()

def draw_centered_text(draw_obj, text, font, y, color):
    bbox = draw_obj.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    draw_obj.text(((canvas_w - w) / 2, y), text, font=font, fill=color)

# Draw Title
draw_centered_text(draw, title, font_title, 50, accent_color)

# Draw Scan text
draw_centered_text(draw, "Scan to view our digital menu", font_scan, 115, qr_color)

# Draw Phones
phones = f"Orders: {phone1}  |  {phone2}"
draw_centered_text(draw, phones, font_phone, canvas_h - 100, muted_color)

# Save
output_path = "assets/img/qr-code.png"
canvas.save(output_path)
print(f"QR Code successfully generated: {output_path}")
