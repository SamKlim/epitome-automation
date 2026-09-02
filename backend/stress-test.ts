import axios from 'axios';

const API_URL = 'http://localhost:3000/api/assessments/responses';
const API_KEY = 'P4Y/TKeoWVE+jlhrKoTcy0ja7G5J5fWM/RkA1L28TBA=';

interface TimingResult {
  requestNumber: number;
  totalTime: number;
  database?: number;
  pdf?: number;
  email?: number;
  status: string;
}

const results: TimingResult[] = [];

async function sendTestRequest(index: number): Promise<void> {
  // Using sample PDF: backend/reports/epitome-report-sample-corners.pdf
  // Each API request will generate a new PDF based on the archetype scores
  const testPayload = {
    id: `stress-test-${index}-${Date.now()}`,
    surveyId: 'test-survey',
    dateCreated: new Date().toISOString(),
    ipAddress: '127.0.0.1',
    totalTime: 300,
    collectorId: 'test-collector',
    responseStatus: 'completed',
    q_288881567: {
      q_2018891726: `Test`, // first name
      q_2018891727: `User${index}`, // last name
    },
    q_288881568: {
      q_2018891735: `samanthaklimovski+test${index}@gmail.com`, // email
    },
    q_288881569: 'Test Organization',
    // Add minimal archetype response fields
    q_1: 1,
    q_2: 2,
    q_3: 3,
  };

  const startTime = Date.now();

  try {
    const response = await axios.post(API_URL, testPayload, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000, // 2 minute timeout
    });

    const totalTime = Date.now() - startTime;

    const result: TimingResult = {
      requestNumber: index,
      totalTime,
      database: response.data.timing?.database || 0,
      pdf: response.data.timing?.pdf || 0,
      email: response.data.timing?.email || 0,
      status: 'Success',
    };

    results.push(result);
    console.log(
      `✓ Request ${index}: ${totalTime}ms (DB: ${result.database}ms, PDF: ${result.pdf}ms, Email: ${result.email}ms)`,
    );
  } catch (error) {
    const totalTime = Date.now() - startTime;
    const errorMessage = axios.isAxiosError(error)
      ? error.response?.data?.message || error.message
      : String(error);

    results.push({
      requestNumber: index,
      totalTime,
      status: `Failed: ${errorMessage}`,
    });

    console.error(
      `✗ Request ${index} failed after ${totalTime}ms: ${errorMessage}`,
    );
  }
}

async function runStressTest(): Promise<void> {
  const NUM_REQUESTS = 5;

  console.log(`\n📊 Starting stress test with ${NUM_REQUESTS} requests...`);
  console.log(`API: ${API_URL}\n`);

  // Send requests sequentially
  for (let i = 1; i <= NUM_REQUESTS; i++) {
    await sendTestRequest(i);
    // Small delay between requests to avoid overwhelming the server
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Calculate statistics
  const successResults = results.filter((r) => r.status === 'Success');

  if (successResults.length === 0) {
    console.error('\n❌ No successful requests. Check server and credentials.');
    process.exit(1);
  }

  const totalTimes = successResults.map((r) => r.totalTime);
  const dbTimes = successResults.map((r) => r.database || 0);
  const pdfTimes = successResults.map((r) => r.pdf || 0);
  const emailTimes = successResults.map((r) => r.email || 0);

  const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  const max = (arr: number[]) => Math.max(...arr);
  const min = (arr: number[]) => Math.min(...arr);

  console.log('\n' + '='.repeat(70));
  console.log('📈 STRESS TEST RESULTS');
  console.log('='.repeat(70));

  console.log(`\nTotal Requests: ${successResults.length}/${NUM_REQUESTS} successful`);

  console.log('\n⏱️  TIMING BREAKDOWN:');
  console.log(`  Database:  ${min(dbTimes)}ms - ${max(dbTimes)}ms (avg: ${avg(dbTimes)}ms)`);
  console.log(`  PDF:       ${min(pdfTimes)}ms - ${max(pdfTimes)}ms (avg: ${avg(pdfTimes)}ms)`);
  console.log(`  Email:     ${min(emailTimes)}ms - ${max(emailTimes)}ms (avg: ${avg(emailTimes)}ms)`);
  console.log(`  ---`);
  console.log(`  TOTAL:     ${min(totalTimes)}ms - ${max(totalTimes)}ms (avg: ${avg(totalTimes)}ms)`);

  console.log('\n📋 INDIVIDUAL RESULTS:');
  successResults.forEach((r) => {
    console.log(
      `  Request ${r.requestNumber}: ${r.totalTime}ms (DB: ${r.database}ms, PDF: ${r.pdf}ms, Email: ${r.email}ms)`,
    );
  });

  console.log('\n✅ Test completed.');
  console.log('='.repeat(70));
}

runStressTest().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
