// Módulo Tokens & Authorisation (mod_tokens), implementado server-side en
// el Hub. Field shapes mirror lib/ocpi/tokens.ts (toPublicToken /
// tokenInputSchema).

import type { OcpiTokenType } from "./sessions.js";

export type { OcpiTokenType } from "./sessions.js";

export type OcpiTokenWhitelist = "NEVER" | "ALLOWED" | "ALLOWED_OFFLINE" | "ALWAYS";

export interface OcpiTokenInput {
  uid: string;
  type: OcpiTokenType;
  contract_id: string;
  visual_number?: string;
  issuer: string;
  group_id?: string;
  valid: boolean;
  whitelist: OcpiTokenWhitelist;
  language?: string;
  default_profile_type?: string;
  energy_contract?: Record<string, unknown>;
}

export interface OcpiToken extends OcpiTokenInput {
  country_code: string;
  party_id: string;
  last_updated: string;
}

/**
 * Respuesta de `POST .../authorize`. `allowed` refleja lo que devuelva el
 * eMSP remoto (valores observados "ALLOWED"/"BLOCKED") — se trata como
 * `string`, no como enum cerrado.
 */
export interface OcpiAuthorizeResult {
  allowed: string;
}
