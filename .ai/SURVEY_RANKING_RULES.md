# Survey Ranking System Rules

**Last verified:** 2026-09-03

## Core Ranking Scale

- Users rate 4 statements per question on a 1-4 scale
- **1 = "Fully describes me"** (HIGHEST weight/importance)
- **4 = "Does not describe me at all"** (LOWEST weight/importance)

## Data Flow & Storage

1. ✅ SurveyMonkey data → Backend: Rankings are **stored as-is** (1 stays 1, 4 stays 4)
   - File: `transform.service.ts:79-80` (parsing from SurveyMonkey format)
   - File: `transform.service.ts:85` (adding to archetype scores)

2. ✅ Database storage: Rankings preserved exactly
   - File: `supabase.service.ts` (insertSurveyResponse)
   - Table: `survey_responses.responses[].answers[].ranking`

## Score Calculation

- ✅ Archetype scores are sums of individual rankings
- **Lower total score = better archetype match** (since it has more 1s and 2s)
- Example: Sovereign=18, Empress=42 → Sovereign is the leading archetype

## Archetype Identification

### ✅ Correct Logic (verified)
**Rule:** Lowest score = best match. Include second archetype if within 2 points.

- File: `archetype-label.service.ts:19-21`
  - Sorts by score ASCENDING (finds lowest)
  - Selects archetype(s) within 2 points of lowest

- File: `pdf-generator.service.ts:54-65` (RECENTLY FIXED)
  - Sorts by score ASCENDING (finds lowest) — **was descending, now corrected**
  - Selects archetype(s) within 2 points of lowest
  - Used for PDF archetype label

**Example:**
- Scores: Sovereign=18, Empress=20, Consort=25, Seductress=30
- Lowest: 18
- Within 2 points: 18, 20 (difference = 2, included)
- Result: "Sovereign and Empress"

## Radar Chart Visualization

- ✅ File: `radarChart-svg.ts:186-190`
- Uses actual dimension scores (1-4 per archetype per dimension)
- Score → Radius: `radius = (maxRadius / 4) * score`
- Visual result: Score 1 (near center) = best match, Score 4 (far) = worst match

## Transformation for PDF Chart

- ✅ File: `pdf-generator.service.ts:162-184`
- Converts database `responses[]` array into `DimensionScores[]` format
- Extracts individual rankings per archetype per dimension
- No scaling or normalization applied

## Test Data Requirements

**Critical Rule for Creating Test Data:**

Each question must have exactly one ranking of 1, one ranking of 2, one ranking of 3, and one ranking of 4 across its four subquestions. No duplicates allowed.

✅ **Valid:** `{ q_1: '1', q_2: '2', q_3: '3', q_4: '4' }` or `{ q_1: '2', q_2: '1', q_3: '4', q_4: '3' }`
❌ **Invalid:** `{ q_1: '1', q_2: '2', q_3: '3', q_4: '3' }` or `{ q_1: '1', q_2: '1', q_3: '3', q_4: '4' }`

**Why:** Each question has 4 statements, each tied to a different archetype. Users must rank each statement differently (1-4) to properly distribute scores across all archetypes.

**Where to apply:**
- File: `backend/test-email-flow.ts` (test data for manual testing)
- File: `backend/src/epitome-assessment/transform.service.spec.ts` (unit test data)
- File: `backend/src/epitome-assessment/archetype-scores.spec.ts` (archetype calculation tests)

## Verification Checklist

Run before any changes to score/ranking logic:

- [ ] Rankings in database = SurveyMonkey values (no conversion)
- [ ] Archetype scores are direct sums of rankings
- [ ] Archetype identification uses LOWEST score (sort ascending)
- [ ] PDF displays correct leading archetype
- [ ] Radar chart shows correct shape (small for 1s, large for 4s)
- [ ] Email PDF matches the calculated archetype

## Recent Fixes

**2026-09-03** — Fixed pdf-generator.service.ts archetype calculation
- Was: Finding highest-scoring archetype (inverted logic)
- Now: Finding lowest-scoring archetype (correct)
- Impact: PDF now displays correct leading archetype matching what users see
