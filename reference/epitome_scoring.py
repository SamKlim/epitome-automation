"""
Epitome Archetype Framework (EAF) — automated scoring engine.

Replicates the logic of Laura's Excel workbook exactly:
  * 12 questions (dimensions) x 4 statements, each statement ranked 1-4
    where 1 = "fully describes me".
  * Each statement maps to one archetype (fixed column mapping below,
    verified against every Response sheet in the workbook).
  * Archetype total = sum of its 12 ranks. LOWEST total = leading
    archetype; ties yield multiple leading archetypes ("X and Y").
  * Radar chart values = inverted rank (5 - rank), so 4 = strongest.
  * Only responses with Response Status == "completed" are scored.

Input: a SurveyMonkey export row (dict of column-letter -> value) or a
plain list of the 48 answer cells in sheet column order Q..BL.
"""

from openpyxl.utils import column_index_from_string

DIMENSIONS = [
    "Leading", "Trust", "Constraints", "Inspiration",
    "Managing Challenges", "Others View Me", "Striving",
    "Working With Peers", "At Your Worst", "Confidence",
    "Power", "Ambition",
]

ARCHETYPES = ["Sovereign", "Empress", "Consort", "Seductress"]

# Column letters in the SurveyMonkey export sheet for each archetype,
# in dimension order (12 per archetype). Verified identical across both
# collector sheets and all 20 Response sheets in the source workbook.
COLUMN_MAP = {
    "Sovereign":  ["S", "U", "Y",  "AD", "AJ", "AM", "AO", "AT", "AZ", "BC", "BF", "BL"],
    "Empress":    ["R", "V", "AA", "AC", "AG", "AL", "AR", "AS", "AX", "BA", "BE", "BK"],
    "Consort":    ["T", "X", "Z",  "AE", "AH", "AK", "AP", "AV", "AY", "BD", "BG", "BI"],
    "Seductress": ["Q", "W", "AB", "AF", "AI", "AN", "AQ", "AU", "AW", "BB", "BH", "BJ"],
}

# 0-based indices into the 48 answer columns (Q=17th col .. BL=64th col)
ANSWER_START = column_index_from_string("Q")  # 17
INDEX_MAP = {
    a: [column_index_from_string(c) - ANSWER_START for c in cols]
    for a, cols in COLUMN_MAP.items()
}


def score_response(answers):
    """answers: list/tuple of 48 ints (the raw ranks, sheet order Q..BL).

    Returns dict with per-dimension ranks, totals, inverted (radar)
    values, leading archetype(s) and per-dimension leaders.
    """
    if len(answers) != 48:
        raise ValueError(f"Expected 48 answer values, got {len(answers)}")
    if not all(isinstance(v, int) and 1 <= v <= 4 for v in answers):
        raise ValueError("All answers must be integers 1-4 (found: %r)" %
                         [v for v in answers if not (isinstance(v, int) and 1 <= v <= 4)])

    ranks = {a: [answers[i] for i in idx] for a, idx in INDEX_MAP.items()}
    totals = {a: sum(v) for a, v in ranks.items()}
    inverted = {a: [5 - v for v in vals] for a, vals in ranks.items()}

    low = min(totals.values())
    leading = [a for a in ARCHETYPES if totals[a] == low]

    # Per-dimension leader: lowest rank wins; ties resolved in archetype
    # order (Sovereign, Empress, Consort, Seductress) — matches the
    # nested-IF order in the workbook. Ranks 1-4 within a question are a
    # forced ranking, so ties cannot actually occur in valid data.
    dim_leaders = {}
    for d_i, dim in enumerate(DIMENSIONS):
        col = {a: ranks[a][d_i] for a in ARCHETYPES}
        m = min(col.values())
        dim_leaders[dim] = next(a for a in ARCHETYPES if col[a] == m)

    return {
        "ranks": ranks,
        "totals": totals,
        "inverted": inverted,
        "leading": leading,
        "leading_label": " and ".join(leading),
        "dimension_leaders": dim_leaders,
    }


def extract_responses_from_sheet(ws):
    """Pull completed responses from a SurveyMonkey export worksheet.

    Returns list of dicts: first_name, last_name, email, organization,
    answers (48 ints), response_id, status. Partial responses are
    returned with status != 'completed' and answers=None.
    """
    out = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if row[0] is None:
            continue
        status = str(row[5]).strip().lower() if row[5] else ""
        rec = {
            "response_id": row[0],
            "status": status,
            "first_name": row[12],
            "last_name": row[13],
            "email": row[14],
            "organization": row[15],
            "answers": None,
        }
        if status == "completed":
            raw = row[16:64]
            try:
                rec["answers"] = [int(v) for v in raw]
            except (TypeError, ValueError):
                rec["status"] = "invalid"
        out.append(rec)
    return out


# ---------------------------------------------------------------------------
# Text-based scoring (deployment path — layout-independent)
# ---------------------------------------------------------------------------
import json, os, re

def _norm(s):
    s = (s or "").lower().strip()
    s = re.sub(r"[\u2019']", "'", s)
    s = re.sub(r"[^a-z0-9' ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def load_statement_map(path=None):
    path = path or os.path.join(os.path.dirname(__file__), "statement_map.json")
    entries = json.load(open(path))
    return {_norm(e["statement"]): (e["dimension"], e["archetype"]) for e in entries}


def score_from_statements(statement_ranks, statement_map=None):
    """statement_ranks: dict of statement text -> rank (1-4).

    Layout-independent scoring: statements are matched by text, so this
    works regardless of question order or collector. Raises ValueError,
    listing what's missing, if any of the 12 dimensions is incomplete —
    it never silently mis-scores.
    """
    smap = statement_map or load_statement_map()
    ranks = {a: [None] * len(DIMENSIONS) for a in ARCHETYPES}
    unknown = []
    for stmt, rank in statement_ranks.items():
        key = _norm(stmt)
        if key not in smap:
            unknown.append(stmt)
            continue
        dim, arch = smap[key]
        ranks[arch][DIMENSIONS.index(dim)] = int(rank)

    missing = [f"{DIMENSIONS[i]}/{a}" for a in ARCHETYPES
               for i, v in enumerate(ranks[a]) if v is None]
    if missing:
        raise ValueError(
            "Response incomplete - cannot score. Missing: " + ", ".join(missing)
            + (f". Unrecognised statements: {unknown}" if unknown else ""))

    answers_by_arch = ranks
    totals = {a: sum(v) for a, v in answers_by_arch.items()}
    inverted = {a: [5 - v for v in vals] for a, vals in answers_by_arch.items()}
    low = min(totals.values())
    leading = [a for a in ARCHETYPES if totals[a] == low]
    return {
        "ranks": answers_by_arch,
        "totals": totals,
        "inverted": inverted,
        "leading": leading,
        "leading_label": " and ".join(leading),
    }
