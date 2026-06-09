/**
 * K6 Load Test: Family Diary Submission
 * Agente QA (5) - Section 4.6: Performance e Carga
 *
 * Scenario: 200 families submitting diary entries simultaneously (Sunday night peak)
 * SLA: Response < 500ms (p95)
 *
 * Run: k6 run tests/k6/load-test-diary.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const responseTime = new Trend('response_time_ms');

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 200 },    // Peak: 200 concurrent families
    { duration: '1m', target: 200 },    // Hold peak
    { duration: '30s', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // SLA: p95 < 500ms
    errors: ['rate<0.01'],  // Error rate < 1%
  },
};

const BASE_URL = __ENV.SUPABASE_URL || 'http://127.0.0.1:54321';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || 'your-anon-key';

export default function () {
  const payload = JSON.stringify({
    patient_id: '00000000-0000-0000-0000-000000000001',  // Test patient
    mood_score: Math.floor(Math.random() * 5) + 1,
    sleep_quality: Math.floor(Math.random() * 5) + 1,
    crisis_occurred: Math.random() > 0.8,
    crisis_level: Math.floor(Math.random() * 5) + 1,
    categories: ['sono', 'escola'],
    notes: 'Load test entry',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${__ENV.TEST_FAMILY_TOKEN || 'test-token'}`,
    },
  };

  const response = http.post(
    `${BASE_URL}/functions/v1/submit-diary`,
    payload,
    params,
  );

  responseTime.add(response.timings.duration);

  const success = check(response, {
    'status is 201 or 409 (duplicate)': (r) => r.status === 201 || r.status === 409,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has success field': (r) => {
      try { return JSON.parse(r.body).success !== undefined; } catch { return false; }
    },
  });

  errorRate.add(!success);
  sleep(1);
}
