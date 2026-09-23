// Módulo Invoice Reconciliation (mod_invoicereconciliations), implementado
// server-side en el Hub. Field shapes mirror
// lib/ocpi/invoiceReconciliation.ts (toPublicInvoiceReconciliation /
// invoiceReconciliationInputSchema). Solo PUT (upsert) — sin POST, a
// diferencia de CDRs que es POST-only.
//
// Lógica FX (server-side, el SDK solo tipa el resultado): si el body del
// PUT incluye discrepancy_amount, el Hub resuelve la moneda del CDR
// referenciado, convierte a USD vía Frankfurter, y agrega
// discrepancy_currency/discrepancy_amount_usd/exchange_rate_used. Si no,
// esos 3 campos vienen ausentes — son opcionales, no asumir que siempre
// están presentes.

export type OcpiInvoiceReconciliationStatus =
  | "MATCHED"
  | "DISPUTED"
  | "PENDING"
  | "RESOLVED";

export interface OcpiDiscrepancyAmount {
  excl_vat: number;
  incl_vat?: number;
}

export interface OcpiInvoiceReconciliationInput {
  id: string;
  cdr_id: string;
  invoice_reference_id?: string;
  status: OcpiInvoiceReconciliationStatus;
  discrepancy_description?: string;
  discrepancy_amount?: OcpiDiscrepancyAmount;
}

export interface OcpiInvoiceReconciliation extends OcpiInvoiceReconciliationInput {
  country_code: string;
  party_id: string;
  discrepancy_currency?: string;
  discrepancy_amount_usd?: OcpiDiscrepancyAmount;
  exchange_rate_used?: number;
  last_updated: string;
}
