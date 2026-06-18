# Unithery — Product Overview

## What It Is
A SaaS digital ecosystem for pediatric therapy clinics (focus: ASD/ADHD) with two integrated fronts:
- **Therapist (Web/Tablet):** Data-dense dashboard, intelligent medical records, AI copilot for session planning, and post-consultation audio dictation.
- **Family (Mobile PWA):** Zero-friction routine diary, scheduled tasks/agreements checklist.

## Core Differentiator
A strictly individualized and isolated AI copilot per patient. Each patient has their own cognitive context (embeddings, transcriptions, session notes) that is never shared or contaminated by other patients' data.

## Value Cycle
1. Family fills weekly diary on mobile PWA
2. AI cross-references new data with patient's isolated clinical history
3. AI generates insights and task suggestions for the therapist before the session
4. Therapist conducts the session and dictates evolution notes via audio
5. System transcribes, structures (SOAP format), and generates the evolution report
6. Therapist reviews and approves → isolated patient database is updated
7. New embeddings generated → patient context enriched for next cycle

## Multi-Tenant Hierarchy (4 layers)
1. **Master (Platform SaaS):** Manages all clinics, plans, global limits, feature flags.
2. **Clinic (Tenant):** Manages professionals, quotas (patients per professional, family members per patient), billing.
3. **Professional (Therapist):** Registers patients (within clinic quota), generates invite codes, uses AI copilot, records audio, approves reports.
4. **Family/Patient:** Access via invite code only, fills routine diary, views agreements. Strictly scoped to their linked patient.

## Target Audience
Multidisciplinary therapy clinics and autonomous therapists (Psychologists, Psychopedagogues, Occupational Therapists, Speech Therapists). Initial focus: pediatric neurodivergent population (ASD and ADHD).

## Compliance Requirements
- **LGPD** (Brazil): Explicit consent from legal guardians, right to erasure, data portability, granular consent for audio/AI processing.
- **HIPAA** (US expansion): PHI protection, BAA with providers, 6-year audit retention.
- **CFM** (Brazil): 20-year minimum retention for clinical records, integrity hash on approved reports.
