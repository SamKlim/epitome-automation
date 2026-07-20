-- Create survey_responses table for storing Epitome Assessment survey responses
CREATE TABLE survey_responses (
  response_id TEXT PRIMARY KEY,
  survey_id TEXT NOT NULL,
  date_created TIMESTAMP WITH TIME ZONE NOT NULL,
  date_modified TIMESTAMP WITH TIME ZONE NOT NULL,
  ip_address TEXT,
  duration_seconds INTEGER,
  collector_id TEXT,
  response_status TEXT,
  contact JSONB,
  responses JSONB NOT NULL,
  archetype_scores JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on response_id for fast lookups
CREATE INDEX idx_survey_responses_response_id ON survey_responses(response_id);

-- Create index on date_created for sorting/filtering
CREATE INDEX idx_survey_responses_date_created ON survey_responses(date_created DESC);
