"""Personalise the Epitome assessment report PDF.

Demo implementation using overlay on the sample report. When the
designer's fillable template arrives (fields: client_name,
leading_archetype, radar_chart), the overlay coordinates are replaced
by straightforward form-field fills — the rest of the pipeline is
unchanged.

Usage:
    python fill_report.py "Laura Taitz" "Empress" radar_laura.png out.pdf
"""
import io
import sys

from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.colors import Color

TEMPLATE = "/mnt/user-data/uploads/Epitome_Assessment_Report_Sample_2026.pdf"

CREAM = Color(237 / 255, 236 / 255, 218 / 255)   # cover background
WHITE = Color(1, 1, 1)
INK = Color(0.15, 0.15, 0.15)

# Measured geometry from the sample PDF (points, PDF origin bottom-left)
COVER_W, COVER_H = 595.276, 841.89
NAME_TOP, NAME_BOTTOM = 755.93, 771.67           # pdfplumber 'top' coords
P8_W, P8_H = 1190.55, 841.89
SENT_X0, SENT_TOP, SENT_X1, SENT_BOTTOM = 43, 216.0, 240, 231.0
CHART_X0, CHART_TOP, CHART_X1, CHART_BOTTOM = 35, 393, 559, 831


def _cover_overlay(client_name):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(COVER_W, COVER_H))
    y0 = COVER_H - 775  # a little below the old text block
    c.setFillColor(CREAM)
    c.rect(60, y0 - 4, COVER_W - 120, 26, stroke=0, fill=1)
    c.setFillColor(INK)
    c.setFont("Helvetica", 15)
    c.drawCentredString(COVER_W / 2, COVER_H - 771, client_name.upper())
    c.save()
    buf.seek(0)
    return PdfReader(buf).pages[0]


def _criteria_overlay(leading_label, radar_png):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(P8_W, P8_H))
    # Replace the leading-archetype sentence
    c.setFillColor(WHITE)
    c.rect(SENT_X0 - 2, P8_H - SENT_BOTTOM - 2, 260, SENT_BOTTOM - SENT_TOP + 4,
           stroke=0, fill=1)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 10.5)
    c.drawString(SENT_X0, P8_H - SENT_BOTTOM + 3,
                 f"You tend to lead with the {leading_label.upper()}.")
    # Replace the radar chart
    c.setFillColor(WHITE)  # reset — fill was still INK from the sentence
    PAD = 6  # cover the original chart's frame lines completely
    c.rect(CHART_X0 - PAD, P8_H - CHART_BOTTOM - PAD,
           (CHART_X1 - CHART_X0) + 2 * PAD,
           (CHART_BOTTOM - CHART_TOP) + 2 * PAD, stroke=0, fill=1)
    c.drawImage(radar_png, CHART_X0, P8_H - CHART_BOTTOM,
                width=CHART_X1 - CHART_X0, height=CHART_BOTTOM - CHART_TOP,
                preserveAspectRatio=True)
    c.save()
    buf.seek(0)
    return PdfReader(buf).pages[0]


def personalise(client_name, leading_label, radar_png, out_path,
                template=TEMPLATE):
    reader = PdfReader(template)
    writer = PdfWriter()
    for i, page in enumerate(reader.pages):
        if i == 0:
            page.merge_page(_cover_overlay(client_name))
        elif i == 7:
            page.merge_page(_criteria_overlay(leading_label, radar_png))
        writer.add_page(page)
    with open(out_path, "wb") as f:
        writer.write(f)
    return out_path


if __name__ == "__main__":
    name, label, png, out = sys.argv[1:5]
    print(personalise(name, label, png, out))
