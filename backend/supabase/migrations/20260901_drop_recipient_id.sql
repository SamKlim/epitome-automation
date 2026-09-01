-- Drop recipient_id column
ALTER TABLE survey_responses
DROP COLUMN IF EXISTS recipient_id;
