# Epitome Assessment Backend

Survey response processing, archetype calculation, and PDF report generation for the Epitome Assessment.

## Core Concepts

### Survey Ranking System

**Critical:** The 1-4 ranking scale is the foundation of all calculations.

- Users rank 4 statements per question
- **1 = "Fully describes me"** (highest weight)
- **4 = "Does not describe me at all"** (lowest weight)
- Each statement is associated with an archetype (Sovereign, Empress, Consort, Seductress)
- On the radar chart a ranking of 1 is drawn on the **outer** ring and 4 on the inner ring, so the archetype that most describes the user appears largest

### Data Processing Flow

1. User rates statements 1-4 in SurveyMonkey
2. SurveyMonkey sends the response to Make via a webhook (an automatic notification sent the instant the survey is completed, rather than Make having to repeatedly check for new responses)
3. Make forwards the response to the `/api/assessments/responses` endpoint
4. **Transform** (`EpitomeAssessmentService.transformResponse()`): Raw data is converted into a structured response, and archetype scores are calculated by summing rankings — the **lowest score is the leading archetype**
   - If two archetypes land within 2 points of the lowest score, both are shown together as the leading archetype (e.g. "Sovereign and Empress")
5. **Store** (`SupabaseService.insertSurveyResponse()`): Rankings are saved to Supabase **exactly as received** (1 stays 1, 4 stays 4), along with the calculated archetype scores
6. **Generate Report** (`EpitomeReportGeneratorService.createCustomisedReport()`): Create customized PDF with user name, leading archetype label, and radar chart visualization of scores
7. **Send Email** (`EpitomeAssessmentService.sendEmailReportInBackground()`): Deliver PDF to user via Gmail with retry logic

**Key Files:**
- `src/epitome-assessment/epitome-assessment.service.ts` — Transforms survey data and orchestrates the processing pipeline
- `src/epitome-assessment/epitome-assessment.controller.ts` — Handles `/api/assessments/responses` endpoint and token validation
- `src/epitome-assessment/epitome-report-generator.service.ts` — Generates customized PDF reports with the user's archetype, personal information, and their radar chart
- `src/db-supabase/supabase.service.ts` — Database operations for storing and retrieving responses
- `src/epitome-assessment/archetype-label.ts` — The single `getArchetypeLabel()` used by both the API response and the PDF, so they can never disagree
- `src/config/questions_map.json` — Maps each of the 12 survey questions to dimensions, and links each answer statement to its archetype (Sovereign, Empress, Consort, Seductress)

## Database Schema

The `survey_responses` table stores everything captured from a submission:
- `response_id`, `survey_id`
- `created_at` — when the row was saved to Supabase
- `date_created` — when the user actually completed the survey in SurveyMonkey
- `first_name`, `last_name`, `email`, `organization`
- `ip_address`, `duration_seconds`, `collector_id`, `response_status`
- `archetype_scores`: `{ Sovereign: X, Empress: Y, Consort: Z, Seductress: W }`
- `responses`: The user's responses to each of the 12 survey questions, including the statement, its archetype, and the ranking given

**Note:** `archetype_label` is **not** stored in the database. It's calculated on the fly by `getArchetypeLabel()` in `src/epitome-assessment/archetype-label.ts`, both for the API response and each time a PDF report is generated.

## Data Integrity

Reports are never generated from default or placeholder data. If a response is missing rankings, archetype scores, or anything else the chart or label needs, generation throws and no email is sent. See the Data Integrity rule in the root `CLAUDE.md`.

## Tests

- `src/epitome-assessment/*.spec.ts` — unit tests; `epitome-report-chart.spec.ts` parses the real SVG and checks every point sits at the radius its ranking demands
- `tests/report-generation.spec.ts` — raw survey DTO → real PDF with `sharp` and `pdf-lib`, only Supabase stubbed
- `tests/survey-submission.e2e.spec.ts` — hits the live endpoint, Supabase and Gmail; sends one email per fixture (`npm run test:e2e`)
- `tests/fixtures/e2e-survey-response.ts` — the shared survey fixtures with their expected per-dimension rankings, totals and labels
