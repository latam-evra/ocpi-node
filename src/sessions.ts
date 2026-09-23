// Módulo Sessions (mod_sessions), implementado server-side en el Hub. Field
// shapes mirror lib/ocpi/sessions.ts (toPublicSession / sessionInputSchema).

export type OcpiSessionStatus =
  | "ACTIVE"
  | "COMPLETED"
  | "INVALID"
  | "PENDING"
  | "RESERVATION";

export type OcpiTokenType = "AD_HOC_USER" | "APP_USER" | "OTHER" | "RFID";

export type OcpiAuthMethod = "AUTH_REQUEST" | "COMMAND" | "WHITELIST";

export interface OcpiCdrToken {
  country_code: string;
  party_id: string;
  uid: string;
  type: OcpiTokenType;
  contract_id: string;
}

export interface OcpiChargingPeriodDimension {
  type: string;
  volume: number;
}

export interface OcpiChargingPeriod {
  start_date_time: string;
  dimensions: OcpiChargingPeriodDimension[];
  tariff_id?: string;
}

export interface OcpiCostAmount {
  excl_vat: number;
  incl_vat?: number;
}

export interface OcpiSessionInput {
  id: string;
  start_date_time: string;
  end_date_time?: string;
  kwh: number;
  cdr_token: OcpiCdrToken;
  auth_method: OcpiAuthMethod;
  authorization_reference?: string;
  location_id: string;
  evse_uid: string;
  connector_id: string;
  meter_id?: string;
  currency: string;
  charging_periods?: OcpiChargingPeriod[];
  total_cost?: OcpiCostAmount;
  status: OcpiSessionStatus;
}

export interface OcpiSession extends OcpiSessionInput {
  country_code: string;
  party_id: string;
  last_updated: string;
}
