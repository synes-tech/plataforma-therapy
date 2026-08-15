import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const CONTACT_SUBJECTS = [
  'duvida_plataforma',
  'problema_tecnico',
  'cobranca',
  'cadastro_acesso',
  'privacidade',
  'comercial',
  'outro',
] as const;

export const ContactFormSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome').max(120),
  email: z
    .string()
    .trim()
    .email('E-mail inválido')
    .max(254)
    .transform((value) => value.toLowerCase()),
  subject: z.enum(CONTACT_SUBJECTS, { errorMap: () => ({ message: 'Selecione um assunto' }) }),
  message: z.string().trim().min(10, 'Descreva com pelo menos 10 caracteres').max(4000),
  website: z.string().max(200).optional().default(''),
});

export type ContactFormInput = z.infer<typeof ContactFormSchema>;
