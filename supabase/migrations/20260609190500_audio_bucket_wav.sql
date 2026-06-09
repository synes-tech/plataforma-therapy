-- ============================================================
-- Áudio em WAV (Gemini Files API) — ajustar limite de tamanho
-- Agentes: DBA + Segurança
--
-- WAV (PCM 16kHz mono) ocupa ~2 MB/min. Aumentamos o teto para acomodar
-- sessões mais longas. O áudio segue privado; download via service_role.
-- ============================================================

update storage.buckets
set file_size_limit = 157286400, -- 150 MB (~75 min de WAV 16kHz mono)
    allowed_mime_types = array['audio/wav', 'audio/x-wav', 'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/flac', 'audio/aac']
where id = 'audio-recordings';
