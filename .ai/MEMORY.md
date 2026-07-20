# Project Memory

## What This Is
Reference: Merle's epitome-automation repo automates the Epitome Archetype Framework (EAF) assessment pipeline.

**Data flow**: SurveyMonkey API → scoring engine → radar chart → PDF personalization → email + audit log.

**The 4 archetypes**: Sovereign, Empress, Consort, Seductress
**The 12 dimensions**: Leading, Trust, Constraints, Inspiration, Managing Challenges, Others View Me, Striving, Working With Peers, At Your Worst, Confidence, Power, Ambition

Each response has:
- 12 questions, each with 4 ranked statements (1 = "fully describes me", lower = stronger fit)
- Archetype total = sum of its 12 ranks
- **Lowest total = leading archetype** (ties produce "X and Y" labels)

Key files:
- `statement_map.json` — maps statement text to archetype + dimension
- `epitome_scoring.py` — scoring engine (layout-independent, matches by statement text)
- `surveymonkey_client.py` — API integration
- `epitome_radar.py` — radar chart rendering (12 spokes with brand colours)
- `fill_report.py` — PDF overlay personalization
- `pipeline.py` — orchestration, approve/auto modes, audit log

---

## Decisions & Shipped Work (2026-07-20)

[decision] Use subquestion_id as primary lookup key instead of position/index. SurveyMonkey embeds subquestion_id (e.g., q_2018891718) in every response, providing explicit 1:1 mapping to archetype/statement. Rejected: inferring archetype by position order — fragile and error-prone across layout changes.

[shipped] NestJS backend (`/backend`) — POST /api/assessments/responses accepts raw SurveyMonkey webhook, transforms to structured format, stores in Supabase. Transform service resolves all 48 subquestion IDs to archetype + statement text at ingest time.

[shipped] Supabase schema (`survey_responses` table) — stores response metadata + contact info + full 12 questions with 4 ranked answers each + calculated archetype scores. JSONB fields for flexible querying.

[shipped] Vercel deployment config — serverless handler bridges NestJS to Vercel's req/res model. Configured for 60s timeout (transform + store completes in <5s). Environment variables for Supabase URL + anon key.

