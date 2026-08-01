# Plano: Contato no cadastro + lembretes de sessão (AWS SES)

## Objetivo
Permitir cadastrar e-mail/telefone (paciente, responsável ou ambos) no wizard de criação e usar esses dados para enviar e-mails via Amazon SES: confirmação ao agendar, lembrete 24h antes e lembrete manual (agora ou agendado).

## Estado atual (As-Is)
- Wizard tem 4 etapas; sem e-mail/telefone estruturados.
- `patients` não tem colunas de contato; e-mail só em `family_members` (pós-convite).
- `send-session-reminder` existe (manual, agora) e só usa `family_members.email`.
- `create-schedule` não envia e-mail.
- Não há cron de lembrete de sessão 24h.
- SES já configurado (`_shared/aws-ses.ts`, `AWS_SES_*`).

## Arquitetura To-Be

```
Cadastro (step 5) → patients.contact_*
       ↓
Agendar sessão → create-schedule
       ↓
  SES: confirmação (imediato)
  + fila: reminder_24h (send_at = scheduled_at - 24h)
       ↓
pg_cron a cada 15 min → process-session-email-queue → SES
       ↓
Agenda UI → send-session-reminder { mode: now | at }
```

## Etapas de implementação

### 1) DBA — Schema
- Colunas em `patients`:
  - `contact_scope` (`patient` | `responsible` | `both` | null)
  - `email_paciente`, `telefone_paciente`
  - `email_responsavel`, `telefone_responsavel`
- Tabela `session_email_jobs` (fila: booking_confirmation, reminder_24h, reminder_manual)
- Índices pending + unique anti-duplicata para jobs automáticos
- RPC/cron `invoke_process_session_email_queue` (padrão diary reminders)
- RLS: service_role / edge only (sem exposição direta ao client)

### 2) Backend — Edge Functions
- `_shared/session-email-recipients.ts` — resolve destinatários (paciente/responsável + fallback família)
- `_shared/session-email-templates.ts` — templates confirmação / lembrete
- `create-patient` — aceita e persiste contato
- `create-schedule` — envia confirmação + enfileira 24h
- `reschedule-session` — cancela 24h pendente e recria
- `send-session-reminder` — `mode: 'now' | 'at'` + `send_at` opcional
- Nova: `process-session-email-queue` (cron secret)
- `get-daily-sessions` — contact a partir dos novos campos

### 3) AWS SES
- Reutilizar secrets existentes (sem novo serviço).
- Validar `AWS_SES_FROM_EMAIL` verificado no SES.
- SMS: fora do escopo (só e-mail).

### 4) Frontend
- Step 5 wizard: Informações de Contato + seletor escopo + e-mail/telefone
- Rodapé: Concluir só no step 5
- Agenda `DayDetail`: Enviar agora | Agendar horário
- Validação: e-mail obrigatório para cada parte selecionada; telefone opcional

### 5) QA / Deploy
- Migration remota + deploy functions + smoke
- Relatório final com checklist de teste manual

## Ordem de agentes
DBA → Backend → Frontend → QA → (Segurança: LGPD nos e-mails de contato)

## Status da entrega (2026-08-01)
- [x] Migration `20260801150000_patient_contact_and_session_email_jobs.sql` aplicada no remoto
- [x] Cron `process_session_email_queue` (`*/15 * * * *`)
- [x] Edge Functions deployadas: `create-patient`, `create-schedule`, `send-session-reminder`, `process-session-email-queue`, `reschedule-session`, `get-daily-sessions`
- [x] Wizard step 5 (contato) + UI agenda (enviar agora / agendar)
- [ ] Teste manual do usuário (checklist abaixo)

### Checklist de teste manual
1. Cadastrar paciente novo com e-mail na etapa Contato (paciente / responsável / ambos)
2. Agendar sessão → confirmar recebimento do e-mail de confirmação
3. Verificar job `reminder_24h` em `session_email_jobs` com `send_at` ≈ sessão − 24h
4. Na agenda: Enviar lembrete → agora
5. Na agenda: Enviar lembrete → agendar horário (fila processada em até 15 min)
6. Remarcar sessão → job 24h antigo cancelado e novo criado
