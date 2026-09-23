// Módulo Charging Profiles (mod_charging_profiles), implementado server-side
// en el Hub. Field shapes mirror lib/ocpi/chargingProfiles.ts y
// lib/ocpi/schemas/chargingProfile.ts.
//
// Al igual que Commands, no es CRUD simétrico: el eMSP pide una acción
// (GET_ACTIVE_CHARGING_PROFILE / PUT_CHARGING_PROFILE /
// DELETE_CHARGING_PROFILE) sobre una sesión existente, el Hub la reenvía al
// CPO y responde con un ACK inmediato; el resultado final llega async por
// callback y se consulta con getChargingProfile(), cuyo GET vive en
// /chargingprofiles/callback/{id} (no en /chargingprofiles/{session_id}).
//
// `response_url` NO lo genera el SDK: el llamador debe pasar su propio
// callback público, se forwardea tal cual en el body.

export interface OcpiChargingProfilePeriod {
  start_period: number;
  limit: number;
}

export interface OcpiChargingProfile {
  start_date_time?: string;
  duration?: number;
  charging_rate_unit: "W" | "A";
  min_charging_rate?: number;
  charging_profile_period: OcpiChargingProfilePeriod[];
}

export type OcpiChargingProfileAction =
  | "GET_ACTIVE_CHARGING_PROFILE"
  | "PUT_CHARGING_PROFILE"
  | "DELETE_CHARGING_PROFILE";

export type OcpiChargingProfileAckResult = "ACCEPTED" | "REJECTED" | "UNKNOWN_SESSION";

export interface OcpiChargingProfileAck {
  result: OcpiChargingProfileAckResult;
  timeout: number;
}

export type OcpiChargingProfileFinalResult = "ACCEPTED" | "REJECTED" | "FAILED" | "UNKNOWN_SESSION";

/** Respuesta de GET /chargingprofiles/callback/{id}. */
export interface OcpiChargingProfileRequest {
  id: string;
  session_id: string;
  action: OcpiChargingProfileAction;
  ack_result?: OcpiChargingProfileAckResult;
  final_result?: OcpiChargingProfileFinalResult;
  charging_profile?: OcpiChargingProfile;
  final_result_received_at?: string;
  last_updated: string;
}
