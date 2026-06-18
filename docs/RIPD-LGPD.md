# RIPD — Relatório de Impacto à Proteção de Dados Pessoais
## Unithery — Plataforma de Copiloto Clínico com IA

**Versão:** 1.0
**Data:** Junho 2026
**Responsável:** [Nome do DPO/Encarregado]
**Base Legal:** LGPD (Lei 13.709/2018) — Art. 38

---

## 1. DESCRIÇÃO DO TRATAMENTO

### 1.1 Natureza do Tratamento
Coleta, armazenamento, processamento e análise de dados pessoais sensíveis de saúde de pacientes menores de idade (TEA/TDAH) para fins de suporte clínico via Inteligência Artificial.

### 1.2 Finalidade
- Registro e acompanhamento do histórico clínico de pacientes.
- Geração automatizada de relatórios de evolução (SOAP) via IA.
- Sugestão de atividades terapêuticas personalizadas.
- Comunicação estruturada entre terapeuta e família do paciente.

### 1.3 Base Legal
| Dado | Base Legal | Justificativa |
|------|-----------|---------------|
| Dados de saúde do paciente | Art. 11, II, f — Tutela da saúde | Necessário para o exercício da atividade profissional do terapeuta |
| Dados da família (contato) | Art. 7, I — Consentimento | Consentimento explícito do responsável legal |
| Áudios de sessão | Art. 7, I — Consentimento + Art. 11, II, f | Consentimento + tutela da saúde |
| Processamento por IA | Art. 7, I — Consentimento | Consentimento explícito e granular para uso de IA |

---

## 2. DADOS COLETADOS

| Categoria | Dados Específicos | Sensível? | Retenção |
|-----------|-------------------|-----------|----------|
| Identificação do Paciente | Nome, data de nascimento, gênero | Sim (menor) | 20 anos (CFM) |
| Dados Clínicos | Diagnósticos, notas de sessão, planos terapêuticos | Sim (saúde) | 20 anos (CFM) |
| Áudios | Gravações de sessão e pós-consulta | Sim (saúde) | 5 anos (áudio bruto) |
| Transcrições | Texto derivado dos áudios | Sim (saúde) | 20 anos |
| Diário da Família | Humor, sono, crises, observações | Sim (saúde de menor) | Enquanto ativo |
| Embeddings (IA) | Representações vetoriais do histórico | Sim (derivado) | Enquanto ativo |
| Dados de Acesso | Email, senha (hash), IP, user-agent | Não | 6 anos (auditoria) |

---

## 3. FLUXO DE DADOS E COMPARTILHAMENTO

```
[Terapeuta/Família] → [Frontend PWA (HTTPS)] → [Supabase Edge Functions]
                                                        ↓
                                               [PostgreSQL (RLS)]
                                                        ↓
                                          [OpenAI API — Dados anonimizados]
                                                        ↓
                                               [Resposta ao frontend]
```

### 3.1 Terceiros com Acesso
| Terceiro | Dados Compartilhados | Finalidade | Contrato |
|----------|---------------------|-----------|----------|
| Supabase (Hosting) | Todos (at-rest criptografado) | Infraestrutura | DPA assinado |
| OpenAI | Texto anonimizado (sem PII) | Processamento de IA | DPA + Opt-out de treinamento |
| Provedor de CDN | Assets estáticos (sem dados) | Performance | Padrão |

### 3.2 Medidas de Anonimização para IA
- Nomes substituídos por `[PACIENTE]`, `[FAMILIAR_1]`
- CPFs, telefones e emails removidos antes do envio
- Opt-out de uso para treinamento configurado na API OpenAI

---

## 4. RISCOS IDENTIFICADOS E MITIGAÇÕES

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|-------|---------------|---------|-----------|
| R1 | Acesso cross-tenant (vazamento entre clínicas) | Baixa | Crítico | RLS no PostgreSQL + testes automatizados |
| R2 | Contaminação de contexto de IA entre pacientes | Baixa | Crítico | Filtro obrigatório patient_id + testes de isolamento |
| R3 | Vazamento de PII para LLM externo | Média | Alto | Middleware de anonimização + DPA com provedor |
| R4 | Acesso não autorizado por familiar a dados de outro paciente | Baixa | Alto | RLS + vinculação estrita via invite code |
| R5 | Perda de dados clínicos | Muito Baixa | Crítico | PITR 30 dias + backup semanal + soft delete |
| R6 | Brute-force em códigos de convite | Média | Médio | Rate limiting + entropia alta (55^8) + TTL 72h |
| R7 | IA gera diagnóstico ou sugestão de medicação | Média | Alto | Guardrails de output + Human-in-the-Loop obrigatório |

---

## 5. DIREITOS DOS TITULARES

| Direito LGPD | Implementação na Plataforma |
|---|---|
| Acesso (Art. 18, II) | Exportação JSON via painel do profissional/clínica |
| Correção (Art. 18, III) | Edição de dados cadastrais pelo profissional responsável |
| Eliminação (Art. 18, VI) | RPC `anonymize_patient()` — anonimiza PII, deleta embeddings |
| Portabilidade (Art. 18, V) | API de exportação em formato estruturado (JSON/CSV) |
| Revogação de consentimento | Desvinculação do familiar + soft delete de dados |
| Informação sobre compartilhamento | Documentado neste RIPD + termos de uso |

---

## 6. CONSENTIMENTO

### 6.1 Termos Granulares (Coletados separadamente)
- [ ] Consentimento para coleta e tratamento de dados clínicos
- [ ] Consentimento para gravação de áudio de sessões
- [ ] Consentimento para processamento por Inteligência Artificial
- [ ] Consentimento para compartilhamento com familiar vinculado

### 6.2 Responsável Legal
Para pacientes menores de idade, todos os consentimentos devem ser assinados pelo responsável legal (pai, mãe ou tutor) cadastrado na plataforma.

---

## 7. MEDIDAS TÉCNICAS DE SEGURANÇA

- Criptografia em trânsito: TLS 1.3 em todas as conexões
- Criptografia em repouso: AES-256 (Supabase managed) + pgcrypto para colunas sensíveis
- Autenticação: JWT RS256 + MFA (TOTP) para profissionais
- Autorização: RBAC 4 camadas + Row Level Security
- Audit trail: Logs imutáveis (append-only) com retenção de 6 anos
- Isolamento de IA: Filtro obrigatório patient_id em toda query vetorial
- Backup: PITR 30 dias + backup lógico semanal criptografado

---

## 8. ENCARREGADO DE DADOS (DPO)

**Nome:** [A definir]
**Email:** dpo@unithery.com.br
**Canal de atendimento:** Formulário in-app (seção "Meus Dados")

---

*Documento gerado automaticamente. Deve ser revisado por assessoria jurídica antes da publicação.*
