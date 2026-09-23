/**
 * Tipos TypeScript para los módulos OCPI del roadmap (aún no implementados
 * server-side en el Hub). Hoy solo queda Charging Profiles — Sessions,
 * CDRs, Tokens & Authorisation, Commands e Invoice Reconciliation ya se
 * implementaron de verdad en el Hub y sus tipos viven en `sessions.ts`,
 * `cdrs.ts`, `tokens.ts`, `commands.ts` e `invoiceReconciliation.ts`
 * respectivamente.
 *
 * NINGUNO de los tipos que quedan acá representa un contrato server
 * confirmado: es un anticipo basado en la documentación pública del
 * roadmap OCPI 2.3.0.
 */

// ---------------------------------------------------------------------------
// Charging Profiles
// ---------------------------------------------------------------------------

export interface OcpiChargingProfile {
  start_date_time: string;
  charging_rate_unit: string;
  limit: number;
}
