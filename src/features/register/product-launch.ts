/**
 * Controle de fase de lançamento na UI.
 *
 * Enquanto `soloProfessionalOnly` estiver true, escondemos opções de clínica
 * no onboarding e cadastro. Backend, migrations e tipos `corporate` permanecem
 * intactos — reativar clínica = `soloProfessionalOnly: false`.
 */
export const PRODUCT_LAUNCH = {
  soloProfessionalOnly: true,
} as const;
