-- Reorganize survey_responses table columns and remove updated_at
BEGIN;

-- Create new table with reorganized columns
CREATE TABLE survey_responses_new (
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

-- Copy data from old table to new table
INSERT INTO survey_responses_new (
  response_id, survey_id, created_at, first_name, last_name, email, organization,
  date_created, ip_address, duration_seconds, collector_id, response_status,
  responses, archetype_scores
)
SELECT
  response_id, survey_id, created_at, first_name, last_name, email, organization,
  date_created, ip_address, duration_seconds, collector_id, response_status,
  responses, archetype_scores
FROM survey_responses;

-- Drop old table
DROP TABLE survey_responses;

-- Rename new table
ALTER TABLE survey_responses_new RENAME TO survey_responses;

-- Recreate indices
CREATE INDEX idx_survey_responses_response_id ON survey_responses(response_id);
CREATE INDEX idx_survey_responses_date_created ON survey_responses(date_created DESC);

COMMIT;
