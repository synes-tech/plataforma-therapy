-- ============================================================
-- Audio Storage — bucket privado + RLS (LGPD)
-- Agentes: DBA + Segurança
--
-- Os áudios de evolução clínica são dados sensíveis (LGPD). Eles ficam em
-- um bucket PRIVADO. O upload/download da pipeline usa service_role (bypassa
-- RLS), mas as policies abaixo são defesa-em-profundidade: garantem que, em
-- acesso direto via cliente autenticado, SOMENTE o terapeuta dono do paciente
-- consegue ler o arquivo.
--
-- Path convention (definido em upload-audio): {clinic_id}/{patient_id}/{ts}.webm
--   storage.foldername(name) => {clinic_id, patient_id}
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'audio-recordings',
  'audio-recordings',
  false,
  52428800, -- 50 MB (~ áudios de até ~5 min em webm/opus)
  array['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Isolamento por terapeuta: só lê áudio de paciente vinculado a ele.
drop policy if exists "audio_recordings_professional_select" on storage.objects;
create policy "audio_recordings_professional_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'audio-recordings'
  and (storage.foldername(name))[2]::uuid in (
    select p.id
    from public.patients p
    join public.professionals prof on p.professional_id = prof.id
    where prof.user_id = auth.uid()
      and prof.deleted_at is null
      and p.deleted_at is null
  )
);

-- Insert direto pelo terapeuta dono (cobre upload client-side futuro;
-- a pipeline atual usa signed upload URL via service_role).
drop policy if exists "audio_recordings_professional_insert" on storage.objects;
create policy "audio_recordings_professional_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'audio-recordings'
  and (storage.foldername(name))[2]::uuid in (
    select p.id
    from public.patients p
    join public.professionals prof on p.professional_id = prof.id
    where prof.user_id = auth.uid()
      and prof.deleted_at is null
      and p.deleted_at is null
  )
);
