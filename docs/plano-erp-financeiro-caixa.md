# ERP Financeiro Unithery — Contratos MVP Core

## Escopo
Motor de Controle de Caixa para psicólogo autônomo (UI gated `canAccessFinance` = professional solo + master). Schema multi-tenant pronto para clínicas. Empregado de clínica: 403 nas Edge Functions (`requireClinicOwner`).

## Tabelas
- `financeiro_planos_paciente` — acordo avulso/pacote/social
- `financeiro_transacoes` — extrato ENTRADA/SAIDA (valores em cents)
- `financeiro_saldos_pacientes` — crédito de sessões de pacote
- `financeiro_sessoes_cobranca` — ponte agenda ↔ caixa

## RPCs atômicas
- `financeiro_vender_pacote(clinic_id, patient_id, professional_id, qtd, valor_cents, descricao, created_by)`
- `financeiro_consumir_sessao_pacote(clinic_id, patient_id, schedule_id, professional_id, created_by)`
- `financeiro_promover_sessoes_stale()` — cron horário + chamado no dashboard

## Edge Functions (deploy remoto)

Quota do projeto limita ~100 functions. Endpoints consolidados:

| Function | Papel |
|---|---|
| `financeiro-get-dashboard` | Métricas + `include_pending_items` → fila recebimentos |
| `financeiro-list-transacoes` | Extrato |
| `financeiro-upsert-transacao` | Criar/editar lançamento |
| `financeiro-cancel-transacao` | Cancelar lançamento |
| `financeiro-list-patient-plans` | Lista planos; com `patient_id` → ledger do paciente |
| `financeiro-upsert-patient-plan` | `action`: `upsert_plan` \| `confirm_session_payment` \| `reschedule_from_queue` |

Aliases planejados (código local, não deployados por cota):
`financeiro-get-patient-ledger`, `financeiro-list-pending-sessions`, `financeiro-confirm-session-payment`, `financeiro-reschedule-from-queue`.

### Contratos de ação (`financeiro-upsert-patient-plan`)
- `upsert_plan` (default): plano + opcional venda de pacote
- `confirm_session_payment`: `{ schedule_id, payment_action, valor_cents?, forma_pagamento? }`
- `reschedule_from_queue`: `{ schedule_id, new_start }`

Erros: `403 FINANCE_FORBIDDEN`, `409 NO_PACKAGE_BALANCE`.

## Hooks
- `create-patient` → plano comercial opcional
- `approve-session-note` / `complete-schedule-session` → `payment_prompt`
- `get-daily-sessions` → `billing_status` por sessão

## FE
- `containers/financeiro/*` + rota `/financeiro` (`financeOnly`)
- Wizard step Comercial + aba Financeiro no prontuário
- Modal pagamento pós-sessão (`SessionPaymentModal`)
- DayDetail: badge “Cobrança pendente”

## Critérios de aceite
1. Solo owner vê Caixa; empregado não.
2. Cadastro com modelo comercial → editável na aba Financeiro.
3. Pacote pago credita saldo; conclusão consome 1 sem nova ENTRADA.
4. Avulso pede valor e registra ENTRADA.
5. Sessão passada sem movimento → Sessões sem status.
6. Dashboard projetada/realizada/despesas/lucro + alertas.
7. Extrato e ledger sincronizados.
8. Migration + functions deployadas no remoto.

## Custos fixos mensais
- Tabela `financeiro_custos_recorrentes` (dia 1–28)
- RPC `financeiro_gerar_custos_mes` → títulos `SAIDA` PENDENTE com `recorrencia_chave = {id}:{YYYY-MM}`
- Aba **Custos** em `/financeiro`
- Actions em `financeiro-upsert-transacao`: `upsert_custo_recorrente` | `toggle_custo` | `marcar_pago`
- Listagem: `financeiro-list-transacoes` + `mode: 'custos'`

## QA
`node scripts/qa-financeiro-caixa.mjs`  
`node scripts/qa-financeiro-custos.mjs`  
(requer `.env` com SUPABASE_URL, SERVICE_ROLE, DATABASE_URL).
