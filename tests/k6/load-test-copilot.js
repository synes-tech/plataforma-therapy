/**
 * K6 Load Test: AI Copilot Query
 * Agente QA (5) - Section 4.6: Performance e Carga
 *
 * Scenario: 20 therapists querying copilot with 500+ embeddings patients
 * SLA: Response < 2s (p95)
 *
 * Run: k6 run tests/k6/load-test-copilot.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const responseTime = new Trend('copilot_response_ms');

export const options = {
  stages: [
    { duration: '20s', target: 5 },    // Ramp up
    { duration: '2m', target: 20 },     // 20 concurrent copilot queries
    { duration: '1m', target: 20 },     // Hold
    { duration: '20s', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<4000'],  // SLA: p95 < 2s
    errors: ['rate<0.05'],  // Error rate < 5% (AI can occasionally fail)
  },
};

const BASE_URL = __ENV.SUPABASE_URL || 'http://127.0.0.1:54321';

const QUERIES = [
  'Sugira 3 atividades para a sessão de hoje',
  'Como está a evolução do sono nas últimas semanas?',
  'Há padrões de crise que devo observar?',
  'Resuma o progresso dos últimos 30 dias',
  'Quais combinados a família tem cumprido?',
];

export default function () {
  const query = QUERIES[Math.floor(Math.random() * QUERIES.length)];

  const payload = JSON.stringify({
    patient_id: '00000000-0000-0000-0000-000000000001',
    message: query,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${__ENV.TEST_PROFESSIONAL_TOKEN || 'test-token'}`,
    },
    timeout: '5s',
  };

  const response = http.post(
    `${BASE_URL}/functions/v1/query-copilot`,
    payload,
    params,
  );

  responseTime.add(response.timings.duration);

  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 2000ms': (r) => r.timings.duration < 2000,
    'has answer': (r) => {
      try { return JSON.parse(r.body).data?.answer?.length > 0; } catch { return false; }
    },
  });

  errorRate.add(!success);
  sleep(3);  // Therapists don't query continuously
}
