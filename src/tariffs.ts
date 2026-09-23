export interface OcpiPriceComponent {
  type: "ENERGY" | "FLAT" | "PARKING_TIME" | "TIME";
  price: number;
  vat?: number;
  step_size: number;
}

export interface OcpiTariffElement {
  price_components: OcpiPriceComponent[];
}

export interface OcpiTariffInput {
  id: string;
  currency: string;
  elements: OcpiTariffElement[];
}

export interface OcpiTariff extends OcpiTariffInput {
  country_code: string;
  party_id: string;
}
