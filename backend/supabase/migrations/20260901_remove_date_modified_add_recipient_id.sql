-- Remove date_modified column and add recipient_id
ALTER TABLE survey_responses
DROP COLUMN date_modified,
ADD COLUMN recipient_id TEXT;
