// Módulo Hub Client Info (mod_hubclientinfo), implementado server-side en el
// Hub. Field shapes mirror lib/ocpi/hubClientInfo.ts (toEntry / STATUS_MAP)
// — status usa "STOPPED" en vez de "DISCONNECTED"/"TERMINATED".

export type OcpiHubClientStatus = "PLANNED" | "CONNECTED" | "SUSPENDED" | "STOPPED";

export interface OcpiHubClientInfoEntry {
  party_id: string;
  country_code: string;
  role: string;
  status: OcpiHubClientStatus;
  last_updated: string;
}
