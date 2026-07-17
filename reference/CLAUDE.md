# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

Automates the Epitome Archetype Framework (EAF) assessment pipeline for Epitome
Leadership (owner: Merle). When a client completes the SurveyMonkey assessment, the
system scores them on 12 leadership dimensions across 4 archetypes, generates a
brand-coloured radar chart, personalises the report PDF (client name, leading
archetype(s), radar chart), and emails it out. It replaces a fully manual
Excel + Adobe + email workflow. There is no test suite, build step, or linter
configured yet — this is a script-based tool, not a packaged application.

## Setup and running

```
pip install requests openpyxl matplotlib pillow reportlab pypdf
cp config.example.json config.json   # then fill in real values — never commit config.json
python pipeline.py config.json       # config path defaults to config.json if omitted
```

`config.json` and `state.json` are gitignored (real credentials / run state) — never commit
them. Generated output (`reports/`, `Epitome_Results_Log.xlsx`, `radar_*.png`) is also
gitignored. `mode` in `config.json` must stay `"approve"` until the owner explicitly
switches it to `"auto"` (see Non-negotiables).

There's no automated pytest suite yet (see Next steps — this is the first useful task to
add). To sanity-check a change today, run individual modules directly, e.g.
`python fill_report.py "Laura Taitz" "Empress" radar_laura.png out.pdf` for the PDF
overlay, or exercise `epitome_scoring.score_from_statements(...)` in a REPL against the
regression fixtures below.

## Architecture (data flow)

```
SurveyMonkey API → surveymonkey_client.py → epitome_scoring.py → epitome_radar.py
  → fill_report.py → email (in pipeline.py) → audit log (Epitome_Results_Log.xlsx)
```

Orchestrated by `pipeline.py:run()`, configured by `config.json` (copy of
`config.example.json` — real config holds secrets and is gitignored).

1. **`surveymonkey_client.py`** (`SurveyMonkeyClient`) — pulls completed responses from
   SurveyMonkey API v3. Converts each response into `{statement text -> rank}` by matching
   on the row **text** of ranking questions, not column position — this is what makes
   scoring layout-independent and lets it survive question reordering across the two live
   collectors, which have different column orders.
2. **`epitome_scoring.py`** — the scoring engine, validated against the owner's 2026 Excel
   workbook. Two independent scoring paths exist:
   - `score_from_statements()` — the **deployment path**, layout-independent, matches
     statements by normalized text via `load_statement_map()` / `statement_map.json`.
     This is what `pipeline.py` actually calls.
   - `score_response()` / `extract_responses_from_sheet()` — a legacy/reference path that
     scores directly from fixed SurveyMonkey export **columns** (`COLUMN_MAP`), used for
     validating against the original workbook. Not used by the live pipeline.
   Both paths share the same core rules (see Business rules below).
3. **`epitome_radar.py`** (`radar_chart()`) — renders the 12-dimension "flower" radar chart
   as a PNG using matplotlib, with exact brand colours/markers per archetype. RGBA output
   is deliberately flattened to RGB (some PDF pipelines render alpha as black).
4. **`fill_report.py`** (`personalise()`) — overlays client name, leading archetype text,
   and the radar PNG onto specific pages/coordinates of the sample report PDF using pypdf +
   reportlab. This is an interim implementation: coordinates are hardcoded to the sample PDF
   geometry (`COVER_W/H`, `SENT_X0/TOP/X1/BOTTOM`, `CHART_X0/TOP/X1/BOTTOM`). See Next steps
   for the planned swap to real form-field filling.
5. **`pipeline.py`** — orchestrates the above, handles the approve/auto email modes, and
   appends one row per response to the `Epitome_Results_Log.xlsx` audit log.

### State and idempotency

`pipeline.py` tracks `state["last_created_at"]` in `state.json` and only asks SurveyMonkey
for responses newer than that on each run, so it's safe to run repeatedly/on a schedule
(cron, Task Scheduler, or a webhook-triggered cloud function — README suggests every
15–30 min). The very first run with no `state.json` processes **all** existing completed
responses — back up or pre-seed `state.json`'s `last_created_at` if that's not wanted.

### Delivery modes (`config["mode"]`)

- `"approve"` — report is emailed only to `owner_email`; the owner manually forwards it to
  the client after review.
- `"auto"` — report is emailed straight to the client, with a notification copy (same
  attachment) sent to `owner_email`.

Every processed response — success or failure — should result in either an audit log row
(`Epitome_Results_Log.xlsx`, one row per response: totals for all four archetypes, leading
archetype(s), mode, delivery status) or a failure-notification email to the owner; never
neither.

## Business rules — DO NOT CHANGE without owner sign-off

These were reverse-engineered and validated against the owner's 2026 Excel workbook. They
are the product's IP, not implementation detail:

1. 12 questions × 4 statements; each statement ranked 1–4 where **1 = "fully describes
   me"** (lower rank = stronger fit).
2. Statements map to archetypes **by statement text** (`statement_map.json`), never by
   column position — the two live SurveyMonkey collectors have different column orders.
3. Archetype total = sum of its 12 ranks. **LOWEST total = leading archetype.** Ties
   produce multiple leaders, labelled "X and Y" (e.g. "Sovereign and Empress") via
   `leading_label` — this string must fit the PDF field.
4. Radar chart plots **5 − rank** (outer ring = strongest, 4 = strongest), 12 spokes in
   this order starting at top, clockwise: Leading, Trust, Constraints, Inspiration,
   Managing Challenges, Others View Me, Striving, Working With Peers, At Your Worst,
   Confidence, Power, Ambition. Brand colours: Sovereign #0B6889, Empress #603393, Consort
   #E7BF20, Seductress #C12026.
5. Only responses with status **completed** are scored. Incomplete or unrecognised
   responses must raise/notify the owner — never silently guess or partially score.
   `score_from_statements()` raises `ValueError` listing exactly which dimension/archetype
   pairs are missing, and `pipeline.py` catches that and emails the owner instead of
   guessing.
6. Scoring uses all 12 dimensions. (Historical bug being replaced: the old spreadsheet
   summed only 10 for most respondents.) Past results already issued to clients stand as
   issued — do not rescore them.

## Regression fixtures — any scoring change must reproduce these

From real 2026 data (totals: Sovereign/Empress/Consort/Seductress):

| Respondent | Totals      | Leading               |
|------------|-------------|------------------------|
| Laura      | 30/23/33/34 | Empress                |
| Merle      | 27/24/34/35 | Empress                |
| Jenny      | 25/22/40/33 | Empress                |
| Jacqui     | 20/25/42/33 | Sovereign              |
| Erikka     | 20/20/35/45 | Sovereign and Empress  |
| Jill       | 25/34/24/37 | Consort                |

A response missing any dimension must raise `ValueError` naming what's missing. First
useful task: turn this table into pytest tests.

## Project status

**Done and validated (offline):**
- Scoring engine, both entry points (positional column-based + text-based)
- Radar generator (owner-approved rendering after a refinement round)
- PDF personalisation via overlay on the sample report
- Pipeline orchestration, approve/auto modes, audit log, state file

**Written but never run live (no internet in the original dev sandbox):**
- `surveymonkey_client.py` — verify against the real API v3 on first live run, especially
  the ranking-answer payload shape in `_parse` (the `row_id`/`choice_id` assumptions), and
  the contact-field extraction, which is currently heuristic (first open-text field found
  that isn't an email → first name, next → last name) and should be replaced with real
  question IDs once known.
- SMTP email sending in `pipeline.py`.

## Next steps, in priority order

1. **Tests**: pytest suite from the regression fixtures above + the incomplete-response
   guard. CI via GitHub Actions is a nice-to-have.
2. **Live SurveyMonkey verification**: owner supplies API token + survey ID; run against
   one known response; fix `_parse` to match the real payload; replace the contact-field
   heuristic with real question IDs.
3. **Survey fix (owner)**: the second collector's survey is missing the Power and Ambition
   questions — must be added before go-live.
4. **Template swap**: designer is delivering a fillable PDF with fields `client_name`,
   `leading_archetype`, `radar_chart`. Replace the overlay logic in `fill_report.py` with
   form-field filling (pypdf `update_page_form_field_values` + image placement); test with
   the longest tie string, "Seductress and Empress".
5. **Email**: configure SMTP (app password), test both modes. Mode stays `"approve"` until
   the owner explicitly switches to `"auto"`.
6. **Hosting/scheduling**: owner decision pending — cron/Task Scheduler vs a small cloud
   function vs Make/Zapier. Keep `pipeline.py` runnable as a plain script either way.

## Non-negotiables

- Never commit `config.json`, tokens, passwords, or client personal data
  (names/emails/results) to the repo. `.gitignore` covers the known files — keep it that
  way.
- Changes to scoring, statement mapping, or report content go through PR review, not
  direct pushes to main.
- The owner approves visual changes to the chart/report; match the original report's look
  unless told otherwise.
