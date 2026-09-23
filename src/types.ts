/**
 * Tipos genéricos del sobre de respuesta OCPI, replicados a partir de
 * `lib/ocpi/response.ts` en el Hub (proyecto padre).
 */

/** Códigos de status OCPI usados por el Hub. Ver `lib/ocpi/response.ts`. */
export const OCPI_STATUS = {
  SUCCESS: 1000,
  CLIENT_ERROR: 2000,
  INVALID_PARAMETERS: 2001,
  NOT_ENOUGH_INFO: 2002,
  UNKNOWN_TOKEN: 2003,
  SERVER_ERROR: 3000,
  UNABLE_TO_USE_API: 3001,
  UNSUPPORTED_VERSION: 3002,
} as const;

export type OcpiStatusCode = (typeof OCPI_STATUS)[keyof typeof OCPI_STATUS];

/** Sobre genérico de toda respuesta OCPI del Hub. */
export interface OcpiResponse<T> {
  data: T;
  status_code: number;
  status_message: string;
  timestamp: string;
}

/** Roles OCPI soportados por el Hub. */
export type OcpiRole = "CPO" | "EMSP" | "HUB";

export interface OcpiPartyRole {
  role: OcpiRole;
  party_id: string;
  country_code: string;
}

/** Elemento de la lista de versiones OCPI soportadas (`GET /versions`). */
export interface OcpiVersionEntry {
  version: string;
  url: string;
}

/** Endpoint expuesto para una versión OCPI (`GET /versions/2.3.0`). */
export interface OcpiEndpoint {
  identifier: string;
  role: string;
  url: string;
}

export interface OcpiVersionDetails {
  version: string;
  endpoints: OcpiEndpoint[];
}

/** Payload de request para iniciar/renovar el handshake de credenciales. */
export interface OcpiCredentialsPayload {
  token: string;
  url: string;
  roles: OcpiPartyRole[];
}

/** Datos devueltos por el Hub en un handshake de credenciales exitoso. */
export interface OcpiCredentialsData {
  token: string;
  url: string;
  roles: OcpiPartyRole[];
}
