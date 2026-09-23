// Módulo CDRs (mod_cdrs), implementado server-side en el Hub. Field shapes
// mirror lib/ocpi/cdrs.ts (toPublicCdr / cdrInputSchema). CDRs son
// inmutables: solo POST (creación) y GET, sin PUT/PATCH/DELETE.

import type { OcpiAuthMethod, OcpiCdrToken, OcpiChargingPeriod, OcpiCostAmount } from "./sessions.js";

export type { OcpiAuthMethod, OcpiCdrToken, OcpiChargingPeriod, OcpiChargingPeriodDimension, OcpiCostAmount } from "./sessions.js";

export interface OcpiGeoLocation {
  latitude: string;
  longitude: string;
}

export type OcpiConnectorFormat = "SOCKET" | "CABLE";

export type OcpiConnectorPowerType =
  | "AC_1_PHASE"
  | "AC_2_PHASE"
  | "AC_2_PHASE_SPLIT"
  | "AC_3_PHASE"
  | "DC";

export interface OcpiCdrLocation {
  id: string;
  name?: string;
  address: string;
  city: string;
  postal_code?: string;
  country: string;
  coordinates: OcpiGeoLocation;
  evse_id?: string;
  evse_uid: string;
  connector_id: string;
  connector_standard: string;
  connector_format: OcpiConnectorFormat;
  connector_power_type: OcpiConnectorPowerType;
}

export interface OcpiPriceComponent {
  type: "ENERGY" | "FLAT" | "PARKING_TIME" | "TIME";
  price: number;
  vat?: number;
  step_size: number;
}

export interface OcpiCdrTariffElement {
  price_components: OcpiPriceComponent[];
  restrictions?: Record<string, unknown>;
}

/**
 * Tariff embebido en un CDR — shape propio con `elements`, distinto de
 * `OcpiTariff` (tariffs.ts), que es el recurso independiente del módulo
 * Tariffs.
 */
export interface OcpiCdrTariff {
  country_code: string;
  party_id: string;
  id: string;
  currency: string;
  elements: OcpiCdrTariffElement[];
}

export interface OcpiCdrInput {
  id: string;
  start_date_time: string;
  end_date_time: string;
  session_id?: string;
  cdr_token: OcpiCdrToken;
  auth_method: OcpiAuthMethod;
  authorization_reference?: string;
  cdr_location: OcpiCdrLocation;
  meter_id?: string;
  currency: string;
  tariffs?: OcpiCdrTariff[];
  charging_periods: OcpiChargingPeriod[];
  signed_data?: Record<string, unknown>;
  total_cost: OcpiCostAmount;
  total_fixed_cost?: OcpiCostAmount;
  total_energy: number;
  total_energy_cost?: OcpiCostAmount;
  total_time: number;
  total_time_cost?: OcpiCostAmount;
  total_parking_time?: number;
  total_parking_cost?: OcpiCostAmount;
  total_reservation_cost?: OcpiCostAmount;
  remark?: string;
  invoice_reference_id?: string;
  credit?: boolean;
  credit_reference_id?: string;
}

export interface OcpiCdr extends OcpiCdrInput {
  country_code: string;
  party_id: string;
  last_updated: string;
}
