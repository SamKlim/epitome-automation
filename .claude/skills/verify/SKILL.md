# Verify Epitome Assessment Backend

## Surface
HTTP POST endpoint: `http://localhost:3000/api/assessments/responses`

## Build & Launch
```bash
cd backend
npm install  # if needed
npm run start:dev
```

Wait for "Nest application successfully started" in logs.

## Check Health
```bash
curl http://localhost:3000/api/assessments/health -X POST
```

Should return `{"status":"ok","message":"Epitome Assessment API is running"}`

## Drive Full Flow
1. Post a SurveyMonkey response with all 12 questions answered
2. API returns HTTP 200 with archetype_scores calculated
3. Query Supabase to verify full response structure stored (contact, responses array with 12 questions × 4 answers, archetype_scores)

## Key Validations
- Contact extraction: q_288881567 → first_name/last_name, q_288881568 → email, q_288881569 → organization
- Question mapping: q_288881566..q_288881876 parsed correctly
- Subquestion ID resolution: q_2018891718 → archetype + statement text
- Archetype scoring: sum of rankings per archetype, stored in archetype_scores
- Error handling: missing id/surveyId → 400 response

## Gotchas
- response_id must be unique (primary key in Supabase)
- If server fails to start, check Supabase URL + ANON_KEY in .env
