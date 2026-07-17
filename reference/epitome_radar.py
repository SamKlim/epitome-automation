"""Generate the Epitome 'flower' radar chart from inverted scores.

Colours sampled pixel-exact from the existing report chart:
  Sovereign #0B6889 (teal, squares), Empress #603393 (purple, triangles),
  Consort #E7BF20 (gold, circles), Seductress #C12026 (red, diamonds).
Outer ring = 4 (strongest). Dimension labels are placed manually just
outside the outer ring, aligned away from the plot so they never overlap
the diagram. Scale numbers 4..0 run down the top spoke, as in the report.
"""
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from epitome_scoring import DIMENSIONS, ARCHETYPES

COLORS = {
    "Sovereign": "#0B6889",
    "Empress":   "#603393",
    "Consort":   "#E7BF20",
    "Seductress": "#C12026",
}
MARKERS = {"Sovereign": "s", "Empress": "^", "Consort": "o", "Seductress": "D"}
GRID = "#C9C9C9"
INK = "#3A3A3A"


def radar_chart(inverted, out_path, dpi=300, size=(8.6, 6.6)):
    """inverted: dict archetype -> list of 12 values (1-4), dimension order."""
    n = len(DIMENSIONS)
    theta = np.array([2 * np.pi * i / n for i in range(n)])

    fig = plt.figure(figsize=size)
    ax = fig.add_subplot(111, polar=True)
    ax.set_theta_zero_location("N")
    ax.set_theta_direction(-1)

    # grid: rings + spokes, no default labels anywhere
    ax.set_ylim(0, 4)
    ax.set_yticks([1, 2, 3, 4])
    ax.set_yticklabels([])
    ax.set_xticks(theta)
    ax.set_xticklabels([])
    ax.grid(color=GRID, linewidth=0.6)
    ax.spines["polar"].set_color(GRID)
    ax.spines["polar"].set_linewidth(0.8)
    ax.set_facecolor("white")
    fig.patch.set_facecolor("white")

    # series: crisp joins and markers
    for arch in ARCHETYPES:
        vals = list(inverted[arch])
        t = np.append(theta, theta[0])
        v = vals + [vals[0]]
        ax.plot(t, v, color=COLORS[arch], linewidth=2.4,
                marker=MARKERS[arch], markersize=6.5,
                markerfacecolor=COLORS[arch], markeredgecolor=COLORS[arch],
                markeredgewidth=0, solid_joinstyle="miter",
                solid_capstyle="projecting", zorder=3, clip_on=False)

    # scale numbers 4..0 just left of the top spoke, like the report
    for r in (4, 3, 2, 1, 0):
        ax.text(np.deg2rad(-3.5) if r else 0, r if r else 0.12, str(r),
                ha="right", va="center", fontsize=8.5, color="#666666",
                zorder=4)

    # dimension labels outside the ring, aligned away from the plot
    for ang, label in zip(theta, DIMENSIONS):
        deg = np.degrees(ang) % 360           # 0 = top, clockwise
        if deg < 1 or deg > 359:
            ha, va = "center", "bottom"
        elif deg < 179:
            ha, va = "left", "center"          # right-hand side
        elif deg < 181:
            ha, va = "center", "top"
        else:
            ha, va = "right", "center"         # left-hand side
        if 60 < deg < 120 or 240 < deg < 300:  # near-horizontal spokes
            va = "center"
        r = 4.35 if ha == "center" else 4.25
        ax.text(ang, r, label, ha=ha, va=va, fontsize=10, color=INK,
                clip_on=False, zorder=5)

    # generous margins so no label is ever clipped
    fig.subplots_adjust(left=0.185, right=0.815, top=0.905, bottom=0.095)
    fig.savefig(out_path, dpi=dpi, facecolor="white")
    plt.close(fig)
    # matplotlib always writes RGBA; some PDF pipelines render the alpha
    # channel as black. Flatten to plain RGB so that can never happen.
    from PIL import Image
    Image.open(out_path).convert("RGB").save(out_path)
    return out_path
