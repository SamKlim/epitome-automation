import { SurveyResponseDTO } from '../../src/epitome-assessment/response.dto';

/**
 * Complete, valid survey submissions used by the unit, integration and e2e tests.
 *
 * Rankings run 1 ("fully describes me") to 4 ("does not describe me at all").
 * The archetype comments are taken from src/config/questions_map.json — that
 * file is the source of truth, not these comments. `(leads)` marks the
 * ranking-1 archetype for each dimension.
 */

export interface DimensionScores {
  dimension: string;
  Sovereign: 1 | 2 | 3 | 4;
  Empress: 1 | 2 | 3 | 4;
  Consort: 1 | 2 | 3 | 4;
  Seductress: 1 | 2 | 3 | 4;
}

export interface ArchetypeTotals {
  Sovereign: number;
  Empress: number;
  Consort: number;
  Seductress: number;
}

export interface SurveyFixture {
  /** Short name shown in test output. */
  name: string;
  /** Fresh id and timestamp on every call so repeated runs don't collide in Supabase. */
  buildResponse(): SurveyResponseDTO;
  /** Per-dimension rankings the answers must produce, in questions_map.json order. */
  expectedDimensionScores: DimensionScores[];
  /** Column sums of expectedDimensionScores. Lowest total leads. */
  expectedTotals: ArchetypeTotals;
  expectedLabel: string;
}

type SurveyAnswers = Omit<SurveyResponseDTO, 'id' | 'dateCreated'>;

const RECIPIENT_EMAIL = 'samanthaklimovski@gmail.com';

function withFreshIdentity(answers: SurveyAnswers): SurveyResponseDTO {
  return {
    id: String(Date.now()),
    dateCreated: new Date().toISOString(),
    ...answers,
  };
}

// ---------------------------------------------------------------------------
// Fixture 1 — Seductress and Empress lead (two archetypes within 2 points)
// ---------------------------------------------------------------------------

const FIXTURE_ONE_ANSWERS: SurveyAnswers = {
  surveyId: 'e2e-survey-123',
  ipAddress: '127.0.0.1',
  totalTime: 300,
  collectorId: 'e2e-test',
  responseStatus: 'Complete',
  q_288881567: {
    q_2018891726: 'E2E',
    q_2018891727: 'One',
  },
  q_288881568: {
    q_2018891735: RECIPIENT_EMAIL,
  },
  q_288881569: 'Test Org',
  // Q1: Leading
  q_288881566: {
    q_2018891718: '1', // Seductress (leads)
    q_2018891719: '4', // Empress
    q_2018891720: '2', // Sovereign
    q_2018891724: '3', // Consort
  },
  // Q2: Trust
  q_288881570: {
    q_2018891746: '2', // Sovereign
    q_2018891747: '4', // Empress
    q_2018891748: '1', // Seductress (leads)
    q_2018891822: '3', // Consort
  },
  // Q3: Constraints
  q_288881571: {
    q_2018891753: '4', // Sovereign
    q_2018891823: '2', // Consort
    q_2018891754: '1', // Empress (leads)
    q_2018891755: '3', // Seductress
  },
  // Q4: Inspiration
  q_288881572: {
    q_2018891762: '1', // Seductress (leads)
    q_2018891761: '4', // Consort
    q_2018891824: '2', // Sovereign
    q_2018891760: '3', // Empress
  },
  // Q5: Managing Challenges
  q_288881573: {
    q_2018891825: '1', // Sovereign (leads)
    q_2018891767: '2', // Empress
    q_2018891768: '4', // Consort
    q_2018891769: '3', // Seductress
  },
  // Q6: Others View Me
  q_288881574: {
    q_2018891774: '1', // Empress (leads)
    q_2018891775: '2', // Seductress
    q_2018891827: '4', // Sovereign
    q_2018891826: '3', // Consort
  },
  // Q7: Striving
  q_288881575: {
    q_2018891828: '1', // Empress (leads)
    q_2018891780: '4', // Sovereign
    q_2018891781: '2', // Seductress
    q_2018891782: '3', // Consort
  },
  // Q8: Working With Peers
  q_288881576: {
    q_2018891829: '1', // Sovereign (leads)
    q_2018891789: '4', // Empress
    q_2018891830: '2', // Seductress
    q_2018891790: '3', // Consort
  },
  // Q9: At Your Worst
  q_288881577: {
    q_2018891797: '2', // Empress
    q_2018891799: '4', // Sovereign
    q_2018891798: '3', // Consort
    q_2018891831: '1', // Seductress (leads)
  },
  // Q10: Confidence
  q_288881578: {
    q_2018891833: '1', // Sovereign (leads)
    q_2018891806: '4', // Seductress
    q_2018891832: '2', // Empress
    q_2018891807: '3', // Consort
  },
  // Q11: Power
  q_288881654: {
    q_2018892275: '4', // Empress
    q_2018892273: '2', // Sovereign
    q_2018892276: '1', // Consort (leads)
    q_2018892274: '3', // Seductress
  },
  // Q12: Ambition
  q_288881876: {
    q_2018893545: '1', // Empress (leads)
    q_2018893542: '4', // Seductress
    q_2018893544: '2', // Consort
    q_2018893543: '3', // Sovereign
  },
};

export const FIXTURE_ONE: SurveyFixture = {
  name: 'Seductress and Empress',
  buildResponse: () => withFreshIdentity(FIXTURE_ONE_ANSWERS),
  expectedDimensionScores: [
    { dimension: 'Leading', Sovereign: 2, Empress: 4, Consort: 3, Seductress: 1 },
    { dimension: 'Trust', Sovereign: 2, Empress: 4, Consort: 3, Seductress: 1 },
    { dimension: 'Constraints', Sovereign: 4, Empress: 1, Consort: 2, Seductress: 3 },
    { dimension: 'Inspiration', Sovereign: 2, Empress: 3, Consort: 4, Seductress: 1 },
    { dimension: 'Managing Challenges', Sovereign: 1, Empress: 2, Consort: 4, Seductress: 3 },
    { dimension: 'Others View Me', Sovereign: 4, Empress: 1, Consort: 3, Seductress: 2 },
    { dimension: 'Striving', Sovereign: 4, Empress: 1, Consort: 3, Seductress: 2 },
    { dimension: 'Working With Peers', Sovereign: 1, Empress: 4, Consort: 3, Seductress: 2 },
    { dimension: 'At Your Worst', Sovereign: 4, Empress: 2, Consort: 3, Seductress: 1 },
    { dimension: 'Confidence', Sovereign: 1, Empress: 2, Consort: 3, Seductress: 4 },
    { dimension: 'Power', Sovereign: 2, Empress: 4, Consort: 1, Seductress: 3 },
    { dimension: 'Ambition', Sovereign: 3, Empress: 1, Consort: 2, Seductress: 4 },
  ],
  expectedTotals: { Sovereign: 30, Empress: 29, Consort: 34, Seductress: 27 },
  // Seductress (27) leads; Empress (29) is within the 2-point spread.
  expectedLabel: 'Seductress and Empress',
};

// ---------------------------------------------------------------------------
// Fixture 2 — Empress leads clearly (next archetype is 7 points behind)
// ---------------------------------------------------------------------------

const FIXTURE_TWO_ANSWERS: SurveyAnswers = {
  surveyId: 'e2e-survey-123',
  ipAddress: '127.0.0.1',
  totalTime: 420,
  collectorId: 'e2e-test',
  responseStatus: 'Complete',
  q_288881567: {
    q_2018891726: 'E2E',
    q_2018891727: 'Two',
  },
  q_288881568: {
    q_2018891735: RECIPIENT_EMAIL,
  },
  q_288881569: 'Test Org',
  // Q1: Leading
  q_288881566: {
    q_2018891718: '2', // Seductress
    q_2018891719: '1', // Empress (leads)
    q_2018891720: '3', // Sovereign
    q_2018891724: '4', // Consort
  },
  // Q2: Trust
  q_288881570: {
    q_2018891746: '2', // Sovereign
    q_2018891747: '1', // Empress (leads)
    q_2018891748: '3', // Seductress
    q_2018891822: '4', // Consort
  },
  // Q3: Constraints
  q_288881571: {
    q_2018891753: '2', // Sovereign
    q_2018891823: '1', // Consort (leads)
    q_2018891754: '3', // Empress
    q_2018891755: '4', // Seductress
  },
  // Q4: Inspiration
  q_288881572: {
    q_2018891762: '4', // Seductress
    q_2018891761: '3', // Consort
    q_2018891824: '1', // Sovereign (leads)
    q_2018891760: '2', // Empress
  },
  // Q5: Managing Challenges
  q_288881573: {
    q_2018891825: '3', // Sovereign
    q_2018891767: '1', // Empress (leads)
    q_2018891768: '2', // Consort
    q_2018891769: '4', // Seductress
  },
  // Q6: Others View Me
  q_288881574: {
    q_2018891774: '1', // Empress (leads)
    q_2018891775: '4', // Seductress
    q_2018891827: '3', // Sovereign
    q_2018891826: '2', // Consort
  },
  // Q7: Striving
  q_288881575: {
    q_2018891828: '4', // Empress
    q_2018891780: '2', // Sovereign
    q_2018891781: '3', // Seductress
    q_2018891782: '1', // Consort (leads)
  },
  // Q8: Working With Peers
  q_288881576: {
    q_2018891829: '3', // Sovereign
    q_2018891789: '1', // Empress (leads)
    q_2018891830: '2', // Seductress
    q_2018891790: '4', // Consort
  },
  // Q9: At Your Worst
  q_288881577: {
    q_2018891797: '3', // Empress
    q_2018891799: '4', // Sovereign
    q_2018891798: '2', // Consort
    q_2018891831: '1', // Seductress (leads)
  },
  // Q10: Confidence
  q_288881578: {
    q_2018891833: '2', // Sovereign
    q_2018891806: '3', // Seductress
    q_2018891832: '1', // Empress (leads)
    q_2018891807: '4', // Consort
  },
  // Q11: Power
  q_288881654: {
    q_2018892275: '1', // Empress (leads)
    q_2018892273: '3', // Sovereign
    q_2018892276: '2', // Consort
    q_2018892274: '4', // Seductress
  },
  // Q12: Ambition
  q_288881876: {
    q_2018893545: '4', // Empress
    q_2018893542: '2', // Seductress
    q_2018893544: '1', // Consort (leads)
    q_2018893543: '3', // Sovereign
  },
};

export const FIXTURE_TWO: SurveyFixture = {
  name: 'Empress',
  buildResponse: () => withFreshIdentity(FIXTURE_TWO_ANSWERS),
  expectedDimensionScores: [
    { dimension: 'Leading', Sovereign: 3, Empress: 1, Consort: 4, Seductress: 2 },
    { dimension: 'Trust', Sovereign: 2, Empress: 1, Consort: 4, Seductress: 3 },
    { dimension: 'Constraints', Sovereign: 2, Empress: 3, Consort: 1, Seductress: 4 },
    { dimension: 'Inspiration', Sovereign: 1, Empress: 2, Consort: 3, Seductress: 4 },
    { dimension: 'Managing Challenges', Sovereign: 3, Empress: 1, Consort: 2, Seductress: 4 },
    { dimension: 'Others View Me', Sovereign: 3, Empress: 1, Consort: 2, Seductress: 4 },
    { dimension: 'Striving', Sovereign: 2, Empress: 4, Consort: 1, Seductress: 3 },
    { dimension: 'Working With Peers', Sovereign: 3, Empress: 1, Consort: 4, Seductress: 2 },
    { dimension: 'At Your Worst', Sovereign: 4, Empress: 3, Consort: 2, Seductress: 1 },
    { dimension: 'Confidence', Sovereign: 2, Empress: 1, Consort: 4, Seductress: 3 },
    { dimension: 'Power', Sovereign: 3, Empress: 1, Consort: 2, Seductress: 4 },
    { dimension: 'Ambition', Sovereign: 3, Empress: 4, Consort: 1, Seductress: 2 },
  ],
  expectedTotals: { Sovereign: 31, Empress: 23, Consort: 30, Seductress: 36 },
  // Empress (23) leads alone; Consort (30) is outside the 2-point spread.
  expectedLabel: 'Empress',
};

export const SURVEY_FIXTURES: SurveyFixture[] = [FIXTURE_ONE, FIXTURE_TWO];
