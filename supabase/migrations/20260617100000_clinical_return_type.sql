-- ============================================================
-- UNITHERY — Add 'clinical_return' recording type
-- Migration: 20260617100000_clinical_return_type.sql
-- Description: Extends audio_recordings.recording_type to support
--              clinical return dictations (free-form transcription
--              without SOAP structuring).
-- ============================================================

-- Drop and recreate the CHECK constraint to include new type
ALTER TABLE audio_recordings
  DROP CONSTRAINT IF EXISTS audio_recordings_recording_type_check;

ALTER TABLE audio_recordings
  ADD CONSTRAINT audio_recordings_recording_type_check
  CHECK (recording_type IN ('onboarding', 'post_session', 'note', 'clinical_return'));
