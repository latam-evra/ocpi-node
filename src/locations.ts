export interface OcpiEvse {
  uid: string;
  evse_id?: string;
  status: string;
  connectors: OcpiConnector[];
}

export interface OcpiConnector {
  id: string;
  standard: string;
  format: "SOCKET" | "CABLE";
  power_type: "AC_1_PHASE" | "AC_2_PHASE" | "AC_2_PHASE_SPLIT" | "AC_3_PHASE" | "DC";
  max_voltage: number;
  max_amperage: number;
  max_electric_power?: number;
  tariff_ids?: string[];
}

export interface OcpiLocationInput {
  id: string;
  publish: boolean;
  address: string;
  city: string;
  country: string;
  coordinates: { latitude: string; longitude: string };
  name?: string;
  evses?: OcpiEvse[];
}

export interface OcpiLocation extends OcpiLocationInput {
  country_code: string;
  party_id: string;
}
