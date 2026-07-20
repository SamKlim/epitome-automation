import { test, expect } from '@playwright/test';

const API_URL = 'http://localhost:3000';
const SUPABASE_URL = 'https://shhxamprdpobonckiujs.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoaHhhbXByZHBvYm9uY2tpdWpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1Mjg2NDAsImV4cCI6MjEwMDEwNDY0MH0.ktQ_dT3xWgg3FpXZ9Znp3mwLFRg7duFwwmYUmaHNJXo';

const generateUniqueId = () => `e2e-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const createTestResponse = (id: string) => ({
  id,
  surveyId: 'e2e-survey-' + Date.now(),
  dateCreated: new Date().toISOString(),
  dateModified: new Date().toISOString(),
  ipAddress: '127.0.0.1',
  totalTime: 120,
  collectorId: 'e2e-collector',
  responseStatus: 'completed',
  q_288881567: {
    q_2018891726: ['E2E'],
    q_2018891727: ['Test'],
  },
  q_288881568: {
    q_2018891735: ['e2e@test.com'],
  },
  q_288881569: 'E2E Test Org',
  q_288881566: {
    q_2018891718: '1',
    q_2018891719: '2',
    q_2018891720: '3',
    q_2018891724: '4',
  },
  q_288881570: {
    q_2018891746: '4',
    q_2018891747: '3',
    q_2018891748: '2',
    q_2018891822: '1',
  },
  q_288881571: {
    q_2018891753: '2',
    q_2018891823: '1',
    q_2018891754: '4',
    q_2018891755: '3',
  },
  q_288881572: {
    q_2018891760: '3',
    q_2018891824: '4',
    q_2018891761: '1',
    q_2018891762: '2',
  },
  q_288881573: {
    q_2018891767: '1',
    q_2018891768: '4',
    q_2018891769: '2',
    q_2018891825: '3',
  },
  q_288881574: {
    q_2018891826: '2',
    q_2018891774: '3',
    q_2018891827: '1',
    q_2018891775: '4',
  },
  q_288881575: {
    q_2018891780: '3',
    q_2018891782: '1',
    q_2018891781: '2',
    q_2018891828: '4',
  },
  q_288881576: {
    q_2018891789: '4',
    q_2018891829: '2',
    q_2018891830: '1',
    q_2018891790: '3',
  },
  q_288881577: {
    q_2018891797: '2',
    q_2018891799: '4',
    q_2018891798: '1',
    q_2018891831: '3',
  },
  q_288881578: {
    q_2018891833: '4',
    q_2018891806: '1',
    q_2018891832: '2',
    q_2018891807: '3',
  },
  q_288881654: {
    q_2018892275: '3',
    q_2018892273: '1',
    q_2018892276: '2',
    q_2018892274: '4',
  },
  q_288881876: {
    q_2018893544: '2',
    q_2018893542: '4',
    q_2018893545: '1',
    q_2018893543: '3',
  },
});

test.describe('Epitome Assessment E2E', () => {
  test('should process complete survey response end-to-end', async ({
    request,
  }) => {
    const responseId = generateUniqueId();
    const testData = createTestResponse(responseId);

    // Step 1: Submit survey response to API
    const submitResponse = await request.post(`${API_URL}/api/assessments/responses`, {
      data: testData,
    });

    expect(submitResponse.ok()).toBe(true);

    const responseBody = await submitResponse.json();
    expect(responseBody.success).toBe(true);
    expect(responseBody.response_id).toBe(responseId);

    // Step 2: Verify archetype scores are present and valid
    expect(responseBody.archetype_scores).toBeDefined();
    expect(responseBody.archetype_scores).toHaveProperty('Sovereign');
    expect(responseBody.archetype_scores).toHaveProperty('Empress');
    expect(responseBody.archetype_scores).toHaveProperty('Consort');
    expect(responseBody.archetype_scores).toHaveProperty('Seductress');

    // All scores should be positive or zero
    Object.values(responseBody.archetype_scores).forEach((score) => {
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
    });

    // Step 3: Query Supabase to verify data was stored
    const supabaseQuery = await request.get(
      `${SUPABASE_URL}/rest/v1/survey_responses?response_id=eq.${responseId}&select=*`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      },
    );

    expect(supabaseQuery.status()).toBe(200);

    const storedData = await supabaseQuery.json();
    expect(storedData).toHaveLength(1);

    const stored = storedData[0];

    // Step 4: Verify stored structure
    expect(stored.response_id).toBe(responseId);
    expect(stored.contact).toBeDefined();
    expect(stored.contact.first_name).toBe('E2E');
    expect(stored.contact.last_name).toBe('Test');
    expect(stored.contact.email).toBe('e2e@test.com');
    expect(stored.contact.organization).toBe('E2E Test Org');

    // Step 5: Verify all 12 questions stored
    expect(stored.responses).toHaveLength(12);

    // Step 6: Verify each question has 4 answers
    stored.responses.forEach((question) => {
      expect(question.answers).toHaveLength(4);
      expect(question).toHaveProperty('dimension');
      expect(question).toHaveProperty('question_id');

      // Each answer should have all required fields
      question.answers.forEach((answer) => {
        expect(answer).toHaveProperty('subquestion_id');
        expect(answer).toHaveProperty('archetype');
        expect(answer).toHaveProperty('statement');
        expect(answer).toHaveProperty('ranking');

        // Archetype must be one of the four
        expect([
          'Sovereign',
          'Empress',
          'Consort',
          'Seductress',
        ]).toContain(answer.archetype);

        // Ranking must be 1-4 or null
        if (answer.ranking !== null) {
          expect(answer.ranking).toBeGreaterThanOrEqual(1);
          expect(answer.ranking).toBeLessThanOrEqual(4);
        }

        // Statement must be non-empty string
        expect(typeof answer.statement).toBe('string');
        expect(answer.statement.length).toBeGreaterThan(0);
      });
    });

    // Step 7: Verify archetype scores match stored data
    expect(stored.archetype_scores).toEqual(responseBody.archetype_scores);
  });

  test('should reject response missing required fields', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/assessments/responses`, {
      data: {
        surveyId: 'test-only',
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.message).toContain('id');
  });

  test('health endpoint should return ok status', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/assessments/health`);

    expect(response.ok()).toBe(true);

    const body = await response.json();
    expect(body.status).toBe('ok');
  });
});
