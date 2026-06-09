# Therapy.AI — API Reference

## Base URL
```
Production: https://<project>.supabase.co/functions/v1/
Local:      http://127.0.0.1:54321/functions/v1/
```

## Authentication
All protected endpoints require `Authorization: Bearer <JWT>` header.
JWT is obtained via Supabase Auth (`/auth/v1/token`).

## Response Format
```json
{
  "success": true|false,
  "data": {},
  "error": { "code": "ERROR_CODE", "message": "Human-readable" },
  "meta": { "request_id": "uuid", "timestamp": "ISO8601" }
}
```

---

## Endpoints

### POST /register-clinic
**Auth:** Public (no token required)
**Role:** Creates clinic_admin

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| clinic_name | string | ✅ | 2-200 chars |
| clinic_email | string | ✅ | Valid email |
| clinic_phone | string | ❌ | Phone number |
| clinic_document | string | ❌ | CNPJ |
| admin_name | string | ✅ | 2-100 chars |
| admin_email | string | ✅ | Valid email |
| admin_password | string | ✅ | 8-128 chars |
| plan | enum | ❌ | starter, professional, enterprise |

**Response (201):** `{ clinic_id, admin_user_id, message }`

---

### POST /register-professional
**Auth:** Required (clinic_admin or master)

| Field | Type | Required |
|-------|------|----------|
| name | string | ✅ |
| email | string | ✅ |
| password | string | ✅ |
| specialty | string | ❌ |
| crp | string | ❌ |

**Response (201):** `{ professional_id, user_id, message }`
**Errors:** `QUOTA_EXCEEDED` (clinic hit max professionals)

---

### POST /create-patient
**Auth:** Required (professional)

| Field | Type | Required |
|-------|------|----------|
| name | string | ✅ |
| birth_date | string (YYYY-MM-DD) | ✅ |
| gender | enum | ❌ |
| diagnoses | string[] | ✅ (min 1) |
| clinical_observations | string | ❌ |

**Response (201):** `{ patient_id, message }`
**Errors:** `QUOTA_EXCEEDED` (professional hit max patients)

---

### POST /generate-invite
**Auth:** Required (professional)

| Field | Type | Required |
|-------|------|----------|
| patient_id | UUID | ✅ |
| relationship | string | ❌ (default: "responsável") |
| expires_in_hours | number | ❌ (default: 72, max: 168) |

**Response (201):** `{ invite_id, code, expires_at, patient_name, message }`

---

### POST /validate-invite
**Auth:** Required (any authenticated user)

| Field | Type | Required |
|-------|------|----------|
| code | string (8 chars) | ✅ |
| name | string | ✅ |
| email | string | ❌ |
| phone | string | ❌ |

**Response (200):** `{ family_member_id, patient_id, clinic_id, relationship, message }`
**Errors:** `INVITE_NOT_FOUND`, `INVITE_CONSUMED`, `INVITE_EXPIRED`, `FAMILY_QUOTA_EXCEEDED`

---

### POST /submit-diary
**Auth:** Required (family)

| Field | Type | Required |
|-------|------|----------|
| patient_id | UUID | ✅ |
| entry_date | string (YYYY-MM-DD) | ❌ (default: today) |
| mood_score | int (1-5) | ✅ |
| sleep_quality | int (1-5) | ✅ |
| crisis_occurred | boolean | ✅ |
| crisis_level | int (1-5) | Required if crisis |
| categories | string[] | ❌ |
| notes | string (max 1000) | ❌ |

**Response (201):** `{ diary_entry_id, message }`
**Errors:** `DUPLICATE_ENTRY` (one per patient/day/member)

---

### POST /upload-audio
**Auth:** Required (professional)

| Field | Type | Required |
|-------|------|----------|
| patient_id | UUID | ✅ |
| recording_type | enum (onboarding, post_session, note) | ✅ |
| duration_seconds | int (1-600) | ❌ |

**Response (202 Accepted):** `{ audio_recording_id, upload_url, job_id, message }`
Client must PUT the audio file to `upload_url` (signed Supabase Storage URL).

---

### POST /process-audio *(internal — triggered by job queue)*
**Auth:** Service role (internal)

| Field | Type | Required |
|-------|------|----------|
| audio_recording_id | UUID | ✅ |
| patient_id | UUID | ✅ |
| job_id | UUID | ✅ |

**Response (200):** `{ transcription_id, session_note_id, embeddings_count }`

---

### POST /query-copilot
**Auth:** Required (professional)

| Field | Type | Required |
|-------|------|----------|
| patient_id | UUID | ✅ |
| message | string (3-2000) | ✅ |
| conversation_history | array (max 10) | ❌ |

**Response (200):** `{ answer, sources[], guardrail_triggered, tokens_used, latency_ms }`

---

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| UNAUTHORIZED | 401 | Missing or invalid JWT |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid input payload |
| QUOTA_EXCEEDED | 429 | Tenant quota limit reached |
| CONFLICT | 409 | Resource already exists |
| INVITE_EXPIRED | 410 | Invite code has expired |
| LLM_ERROR | 502 | AI provider returned error |
| INTERNAL_ERROR | 500 | Unexpected server error |
