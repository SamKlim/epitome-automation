# Epitome Assessment Automation

New completed SurveyMonkey responses are scored on the 12-dimension
Epitome Archetype Framework, a brand-coloured radar chart is generated,
the report PDF is personalised (client name, leading archetype(s),
radar), and the report is emailed - either to Merle for approval
("approve" mode) or directly to the client with a notification copy
("auto" mode). Every result is appended to Epitome_Results_Log.xlsx.

## Files
- epitome_scoring.py      scoring engine (validated against the 2026 workbook)
- statement_map.json      all 48 statements -> dimension + archetype
- epitome_radar.py        radar chart generator (exact brand colours)
- fill_report.py          PDF personalisation (swap overlay for form-field
                          fill when the designer's template arrives:
                          client_name, leading_archetype, radar_chart)
- surveymonkey_client.py  SurveyMonkey API v3 pull
- pipeline.py             orchestrator (run this)
- config.example.json     copy to config.json and fill in

## Setup
1. pip install requests openpyxl matplotlib pillow reportlab pypdf
2. Copy config.example.json to config.json; add your SurveyMonkey API
   token (developer.surveymonkey.com, responses_read scope; API access
   requires a plan that includes it), survey ID, and SMTP details (for
   Gmail/Outlook use an app password).
3. Ensure the live survey includes the Power and Ambition questions
   (the second collector's survey was missing them as of July 2026).
4. Put the designer's fillable template path in "template_pdf".
5. Test: python pipeline.py config.json  (first run processes all
   existing completed responses - back up or pre-set state.json's
   last_created_at if you only want new ones).
6. Schedule it (cron, Windows Task Scheduler, or a Make/Zapier webhook
   calling a small cloud function). Every 15-30 min is plenty.
7. When confident, change "mode" from "approve" to "auto".

## Scoring rules (as validated)
Rank 1 = "fully describes me". Archetype total = sum of its 12 ranks;
LOWEST total leads; ties produce e.g. "Sovereign and Empress". Radar
plots 5 - rank (outer ring = strongest). Only status=completed
responses are scored; incomplete ones trigger an email to the owner
instead of a silent mis-score.
