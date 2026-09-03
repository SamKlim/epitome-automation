# Epitome Assessment Backend

Survey response processing, archetype calculation, and PDF report generation for the Epitome Assessment.

## Core Concepts

### Survey Ranking System

**Critical:** The 1-4 ranking scale is the foundation of all calculations.

- Users rank 4 statements per question
- **1 = "Fully describes me"** (highest weight)
- **4 = "Does not describe me at all"** (lowest weight)
- Each statement is associated with an archetype (Sovereign, Empress, Consort, Seductress)

**Data flow:**
1. User rates statements 1-4 in SurveyMonkey
2. Data is submitted to `/api/assessments/responses` endpoint
3. Rankings are stored in Supabase **exactly as received** (1 stays 1, 4 stays 4)
4. Archetype scores are calculated by summing rankings: higher ranking = higher contribution to that archetype's score

**Example:**
- Question has 4 statements tied to different archetypes
- User ranks them: Sovereign=1, Empress=3, Consort=2, Seductress=4
- These become Archetype scores for this question: Sovereign gets +1, Empress gets +3, Consort gets +2, Seductress gets +4
- Total archetype scores accumulate across all 12 questions

### Data Processing Flow

1. **Transform** (`TransformService`): Raw SurveyMonkey data → structured response with archetype scores
2. **Store** (`SupabaseService`): Store transformed data including individual rankings and total scores
3. **Label** (`ArchetypeLabelService`): Determine which archetype(s) to highlight
4. **Generate PDF** (`PdfGeneratorService`): Create report with name, archetype label, and radar chart
5. **Send Email** (`EmailService`): Deliver PDF to user

## Project Setup

```bash
npm install
```

## Running the Application

```bash
# Development with watch mode
npm run start:dev

# Production
npm run start:prod

# Debug mode (with breakpoints)
npm run start:debug
```

## Testing

### Unit Tests

Run unit tests to validate individual services and utilities:

```bash
npm run test
```

### Unit Tests with Debugger

Run unit tests with breakpoints for debugging:

```bash
npm run test:debug
```

### E2E Tests

Run end-to-end tests that validate the complete survey submission pipeline:

```bash
npm run test:e2e
```

The test suite ([survey-submission.e2e.spec.ts](./tests/survey-submission.e2e.spec.ts)) validates:
- Complete survey submission with archetype score calculation
- Authorization (valid token required via `EPITOME_AUTOMATION_SECRET`)
- Response structure includes `archetype_scores`, `archetype_label`, and `timing` data
- Error handling (malformed requests, missing fields, unauthorized access)
- Handling of optional fields and minimal data requirements

### Coverage Report

Generate a code coverage report for all tests:

```bash
npm run test:cov
```

## Key Files

- `src/epitome-assessment/` — Main processing logic
  - `transform.service.ts` — Converts raw survey data, calculates archetype scores
  - `pdf-generator.service.ts` — Generates customized PDF reports
  - `archetype-label.service.ts` — Determines leading archetype(s)
- `src/radarChart-svg.ts` — Radar chart SVG generation with actual user scores
- `src/db/supabase.service.ts` — Database operations

## Database Schema

`survey_responses` table stores:
- `response_id`, `survey_id`, timestamps
- `first_name`, `last_name`, `email`, `organization`
- `archetype_scores`: `{ Sovereign: X, Empress: Y, Consort: Z, Seductress: W }`
- `responses`: Array of dimensions with individual rankings per archetype

## Verification Checklist

When updating score calculation logic:
- [ ] Rankings stored in DB match SurveyMonkey (1 = high weight, 4 = low weight)
- [ ] Archetype scores sum up correctly across 12 dimensions
- [ ] Radar chart uses actual user rankings, not test data
- [ ] PDF displays correct archetype label based on scores
- [ ] Email contains the personalized PDF with correct data
