export class SurveyResponseDTO {
  /** Unique response ID from SurveyMonkey (required) */
  id!: string;

  /** Survey ID - which survey this is for (optional) */
  surveyId?: string;

  /** Respondent's IP address (optional) */
  ipAddress?: string;

  /** Total time in seconds to complete survey (optional) */
  totalTime?: number;

  /** Collector ID - which collection method (optional) */
  collectorId?: string;

  /** Response status - should be "completed" (optional) */
  responseStatus?: string;

  /** When response was created (optional) */
  dateCreated?: string;

  /** When response was last modified (optional) */
  dateModified?: string;

  /** Contact information - EXTRACTED from q_288881567, q_288881568, q_288881569
   * These fields don't exist in raw response; transform service extracts & maps them
   * If not present in response, defaults to null (not error) */
  contact!: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    organization: string | null;
  };

  /** All 12 survey questions with their answers */
  questions!: Array<{
    questionId: string;
    dimension: string;
    answers: Array<{
      subquestionId: string;
      ranking: string;
    }>;
  }>;
}
