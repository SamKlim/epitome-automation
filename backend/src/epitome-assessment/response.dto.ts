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

  /** Contact info: first name, last name (from SurveyMonkey q_288881567) */
  q_288881567?: {
    q_2018891726?: string | null;
    q_2018891727?: string | null;
  };

  /** Contact info: email (from SurveyMonkey q_288881568) */
  q_288881568?: {
    q_2018891735?: string | null;
  };

  /** Contact info: organization (from SurveyMonkey q_288881569) */
  q_288881569?: string | null;

  /** Question 1: Leading (q_288881566) - 4 answer rankings */
  q_288881566?: Record<string, string>;
  /** Question 2: Trust (q_288881570) - 4 answer rankings */
  q_288881570?: Record<string, string>;
  /** Question 3: Constraints (q_288881571) - 4 answer rankings */
  q_288881571?: Record<string, string>;
  /** Question 4: Inspiration (q_288881572) - 4 answer rankings */
  q_288881572?: Record<string, string>;
  /** Question 5: Managing Challenges (q_288881573) - 4 answer rankings */
  q_288881573?: Record<string, string>;
  /** Question 6: Others View Me (q_288881574) - 4 answer rankings */
  q_288881574?: Record<string, string>;
  /** Question 7: Striving (q_288881575) - 4 answer rankings */
  q_288881575?: Record<string, string>;
  /** Question 8: Working With Peers (q_288881576) - 4 answer rankings */
  q_288881576?: Record<string, string>;
  /** Question 9: At Your Worst (q_288881577) - 4 answer rankings */
  q_288881577?: Record<string, string>;
  /** Question 10: Confidence (q_288881578) - 4 answer rankings */
  q_288881578?: Record<string, string>;
  /** Question 11: Power (q_288881654) - 4 answer rankings */
  q_288881654?: Record<string, string>;
  /** Question 12: Ambition (q_288881876) - 4 answer rankings */
  q_288881876?: Record<string, string>;
}
