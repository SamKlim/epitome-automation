-- Create survey_responses table with final schema
CREATE TABLE IF NOT EXISTS survey_responses (
  response_id TEXT PRIMARY KEY,
  survey_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  organization TEXT,
  date_created TIMESTAMP WITH TIME ZONE NOT NULL,
  ip_address TEXT,
  duration_seconds INTEGER,
  collector_id TEXT,
  response_status TEXT,
  responses JSONB NOT NULL,
  archetype_scores JSONB NOT NULL
);

-- Create indices for common queries
CREATE INDEX IF NOT EXISTS idx_survey_responses_response_id ON survey_responses(response_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_date_created ON survey_responses(date_created DESC);
