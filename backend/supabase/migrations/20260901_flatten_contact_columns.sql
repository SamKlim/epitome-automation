-- Replace contact JSONB with separate contact columns
ALTER TABLE survey_responses
DROP COLUMN contact,
ADD COLUMN first_name TEXT,
ADD COLUMN last_name TEXT,
ADD COLUMN email TEXT,
ADD COLUMN organization TEXT;
