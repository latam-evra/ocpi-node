/**
 * Tipos TypeScript para los módulos OCPI del roadmap (aún no implementados
 * server-side en el Hub). Se definen a partir de los payloads de ejemplo en
 * `components/ModuleAccordion.tsx` y `docs/object_ocpi_cdr.md` del repo del
 * Hub, de modo que el tipado ya esté listo cuando el backend exista.
 *
 * NINGUNO de estos tipos representa un contrato server confirmado: son un
 * anticipo basado en la documentación pública del roadmap OCPI 2.3.0.
 *
 * Nota: los tipos de Locations, Tariffs y Hub Client Info ya no viven acá —
 * son módulos implementados de verdad en el Hub, ver `locations.ts`,
 * `tariffs.ts` y `hubClientInfo.ts`.
 */

import type { OcpiTariff } from "./tariffs.js";

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export type OcpiSessionStatus =
  | "ACTIVE"
  | "COMPLETED"
  | "INVALID"
  | "PENDING"
  | "RESERVATION";

export interface OcpiSession {
  id: string;
  start_date_time: string;
  end_date_time?: string;
  kwh: number;
  status: OcpiSessionStatus;
}

// ---------------------------------------------------------------------------
// CDRs — ver docs/object_ocpi_cdr.md en el repo del Hub para el objeto completo
// ---------------------------------------------------------------------------

export interface OcpiCdrToken {
  country_code: string;
  party_id: string;
  uid: string;
  type: string;
  contract_id: string;
}

export interface OcpiGeoLocation {
  latitude: string;
  longitude: string;
}

export interface OcpiCdrLocation {
  id: string;
  name?: string;
  address: string;
  city: string;
  postal_code?: string;
  country: string;
  coordinates: OcpiGeoLocation;
  evse_id: string;
  evse_uid: string;
  connector_id: string;
  connector_standard: string;
  connector_format: string;
  connector_power_type: string;
}

export interface OcpiChargingPeriodDimension {
  type: string;
  volume: number;
}

export interface OcpiChargingPeriod {
  start_date_time: string;
  dimensions: OcpiChargingPeriodDimension[];
}

export interface OcpiCostAmount {
  excl_vat: number;
  incl_vat: number;
}

export interface OcpiCdr {
  country_code: string;
  party_id: string;
  id: string;
  start_date_time: string;
  end_date_time: string;
  session_id: string;
  cdr_token: OcpiCdrToken;
  auth_method: string;
  authorization_reference?: string;
  cdr_location: OcpiCdrLocation;
  currency: string;
  tariffs: OcpiTariff[];
  charging_periods: OcpiChargingPeriod[];
  total_cost: OcpiCostAmount;
  total_fixed_cost?: OcpiCostAmount;
  total_energy: number;
  total_energy_cost?: OcpiCostAmount;
  total_time: number;
  total_time_cost?: OcpiCostAmount;
  last_updated: string;
}

// ---------------------------------------------------------------------------
// Tokens & Authorisation
// ---------------------------------------------------------------------------

export interface OcpiToken {
  uid: string;
  type: string;
  contract_id: string;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export type OcpiCommandName =
  | "START_SESSION"
  | "STOP_SESSION"
  | "UNLOCK_CONNECTOR"
  | "RESERVE_NOW"
  | "CANCEL_RESERVATION";

export interface OcpiCommandStartSessionPayload {
  token: Pick<OcpiToken, "uid">;
  location_id: string;
  evse_uid: string;
}

// ---------------------------------------------------------------------------
// Charging Profiles
// ---------------------------------------------------------------------------

export interface OcpiChargingProfile {
  start_date_time: string;
  charging_rate_unit: string;
  limit: number;
}

// ---------------------------------------------------------------------------
// Invoice Reconciliation
// ---------------------------------------------------------------------------

export type OcpiInvoiceReconciliationStatus = "MATCHED" | "MISMATCHED" | "PENDING";

export interface OcpiInvoiceReconciliation {
  cdr_id: string;
  invoice_reference: string;
  status: OcpiInvoiceReconciliationStatus;
}
